import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import * as z from 'zod/v4';
import type {
  AtestadoInput,
  AtestadoOcrRequest,
  AtestadoOcrResult,
  Role,
} from '@ponto-dcit/shared-types';
import { ANTHROPIC_CLIENT } from './anthropic-client.token';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// Haiku 4.5, not Opus/Sonnet: this is a bounded, well-specified extraction
// task (read four fields off a document photo), not open-ended reasoning —
// the cheapest current model that supports vision + structured outputs is
// the right fit, and it's billed per atestado upload.
const MODEL = 'claude-haiku-4-5';

const EXTRACTION_PROMPT =
  'Extraia os dados deste atestado médico brasileiro: o código CID, o CRM do médico ' +
  '(incluindo a UF, ex: "CRM-MG 12345"), o nome do médico, e a quantidade de dias de ' +
  'afastamento informada. Se um campo não estiver legível ou não estiver presente na ' +
  'imagem, retorne null para ele — não invente valores.';

// zodOutputFormat() requires a zod/v4 schema instance — the shared-types
// package's AtestadoOcrResultSchema is built on classic zod ("zod", i.e.
// zod/v3), a structurally different class hierarchy even though both live
// in the same npm package version. This schema is the zod/v4 twin of that
// shape, kept in sync by hand; AtestadoOcrResult (from shared-types) is
// still the source of truth for the wire type.
const AtestadoExtractionSchema = z.object({
  cid: z.string().nullable(),
  crm: z.string().nullable(),
  medico: z.string().nullable(),
  dias: z.number().int().positive().nullable(),
});

@Injectable()
export class AtestadosService {
  constructor(
    @Inject(ANTHROPIC_CLIENT) private readonly anthropic: Anthropic,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async extract(input: AtestadoOcrRequest): Promise<AtestadoOcrResult> {
    // Structured outputs (output_config.format), not tool-use-as-JSON-hack
    // or prompt-and-hope: it's the API's native constrained-decoding
    // feature, so the response is guaranteed to validate against the
    // schema rather than merely being "probably JSON".
    try {
      const response = await this.anthropic.messages.parse({
        model: MODEL,
        max_tokens: 1024,
        output_config: { format: zodOutputFormat(AtestadoExtractionSchema) },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: input.mediaType,
                  data: input.imageBase64,
                },
              },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      });

      if (!response.parsed_output) {
        throw new InternalServerErrorException(
          'Não foi possível interpretar o atestado automaticamente.',
        );
      }
      return response.parsed_output;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Não foi possível interpretar o atestado automaticamente.',
      );
    }
  }

  async create(userId: string, userName: string, input: AtestadoInput) {
    const atestado = await this.prisma.atestado.create({
      data: {
        userId,
        userName,
        cid: input.cid,
        crm: input.crm,
        medico: input.medico,
        dias: input.dias,
        photoDataUrl: input.photoDataUrl,
      },
    });
    await this.notifications.sendDocumentSubmitted('atestado', userId, userName);
    return atestado;
  }

  // photoDataUrl excluded here too — a list response is never the right
  // place for a base64 image, even the caller's own; getPhoto is the
  // one-at-a-time path for actually viewing it.
  listMine(userId: string) {
    return this.prisma.atestado.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        userName: true,
        cid: true,
        crm: true,
        medico: true,
        dias: true,
        status: true,
        reviewNote: true,
        createdAt: true,
      },
    });
  }

  // Clinical detail (CID/CRM/médico) is only for RH's eyes — a gestor sees
  // who's out, for how long, and the approval status, matching the spec's
  // gestor/RH visibility split. Masked server-side now, not just hidden in
  // the mobile UI, so the data never leaves the API for a non-RH caller.
  //
  // photoDataUrl is deliberately left out of this `select` for both roles —
  // it's the same clinical-sensitivity data as cid/crm/medico (often the
  // diagnosis is legible right on the photo), so it never belongs in a bulk
  // list response. RH fetches it one at a time via getPhoto, only when
  // actually reviewing a specific atestado.
  async listTeam(viewerRole: Role) {
    const atestados = await this.prisma.atestado.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        userName: true,
        cid: true,
        crm: true,
        medico: true,
        dias: true,
        status: true,
        reviewNote: true,
        createdAt: true,
      },
    });
    if (viewerRole === 'rh') {
      return atestados;
    }
    return atestados.map((atestado) => ({
      ...atestado,
      cid: null,
      crm: null,
      medico: null,
    }));
  }

  // RH-only, same LGPD-driven boundary as the clinical text fields above —
  // returns null (never throws) for a non-RH viewer, a missing atestado, or
  // an atestado that simply has no photo on file.
  async getPhoto(id: string, viewerRole: Role): Promise<string | null> {
    if (viewerRole !== 'rh') {
      return null;
    }
    const atestado = await this.prisma.atestado.findUnique({
      where: { id },
      select: { photoDataUrl: true },
    });
    return atestado?.photoDataUrl ?? null;
  }

  async updateStatus(
    id: string,
    status: 'em_analise' | 'aprovado' | 'recusado',
    reviewNote?: string,
  ) {
    const updated = await this.prisma.atestado.update({
      where: { id },
      data: { status, reviewNote: status === 'recusado' ? reviewNote : null },
    });
    // Reverting to em_analise (undoing a prior decision) is a quiet action —
    // no notification, same reasoning as why creating an atestado doesn't
    // notify the colaborador themself.
    if (status !== 'em_analise') {
      await this.notifications.sendDocumentStatusChanged('atestado', updated.userId, status);
    }
    return updated;
  }
}
