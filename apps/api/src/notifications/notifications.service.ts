import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';
import { PagamentoCategoria } from '@ponto-dcit/shared-types';
import { formatDateOnlyBR } from '../common/sao-paulo-time';

const PAGAMENTO_MESSAGE: Record<PagamentoCategoria, string> = {
  salario: 'Seu salário foi depositado.',
  auxilio_home_office: 'Seu auxílio home office foi depositado.',
  vale_transporte: 'Seu vale-transporte foi depositado.',
  vale_alimentacao: 'Seu vale-alimentação foi depositado.',
};

export type PontoPerdidoTipo = 'saida_esquecida' | 'ausencia';

const PONTO_PERDIDO_MESSAGE_COLABORADOR: Record<PontoPerdidoTipo, (dateBR: string) => string> = {
  saida_esquecida: (dateBR) => `Você esqueceu de bater o ponto de saída em ${dateBR}.`,
  ausencia: (dateBR) => `Não identificamos nenhum ponto registrado em ${dateBR}.`,
};

const PONTO_PERDIDO_MESSAGE_GESTOR: Record<PontoPerdidoTipo, (name: string, dateBR: string) => string> = {
  saida_esquecida: (name, dateBR) => `${name} esqueceu de bater o ponto de saída em ${dateBR}.`,
  ausencia: (name, dateBR) => `${name} não registrou nenhum ponto em ${dateBR}.`,
};

const muralMessage = (title: string) => `"${title}" foi publicado no mural.`;

const careerLevelUpMessage = (subNivel: string, novoSalario: number, notaFinal: number) =>
  `🚀 Parabéns! Você avançou para ${subNivel}. Novo salário: R$ ${novoSalario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Sua nota final: ${notaFinal.toFixed(1).replace('.', ',')}/10.`;

export type DocumentKind = 'atestado' | 'admissional';

const documentStatusMessage = (kind: DocumentKind, status: 'aprovado' | 'recusado') => {
  const noun = kind === 'atestado' ? 'atestado' : 'documento admissional';
  return status === 'aprovado' ? `Seu ${noun} foi aprovado.` : `Seu ${noun} foi reprovado.`;
};

const DOCUMENT_STATUS_LINK: Record<DocumentKind, string> = {
  atestado: '/documentos?categoria=atestados',
  admissional: '/documentos?categoria=admissionais',
};

const DOCUMENT_SUBMITTED_LABEL: Record<DocumentKind, string> = {
  atestado: 'um atestado',
  admissional: 'um documento admissional',
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPush: ExpoPushService,
  ) {}

  async sendPagamento(category: PagamentoCategoria, userIds: string[]) {
    const message = PAGAMENTO_MESSAGE[category];
    const created = await this.prisma.notification.createManyAndReturn({
      data: userIds.map((userId) => ({ userId, type: 'pagamento', category, message })),
    });
    void Promise.all(
      created.map((n) =>
        this.expoPush.sendToUser(n.userId, {
          title: 'Ponto DCIT',
          body: n.message,
          data: { notificationId: n.id, link: n.link },
        }),
      ),
    );
  }

  // start/end: "YYYY-MM-DD" strings computed by the caller (same pattern as
  // /banco-de-horas/equipe) — this service never decides "what month is it
  // now" itself.
  async pagamentoStatus(category: PagamentoCategoria, start: string, end: string) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        type: 'pagamento',
        category,
        // start/end are São Paulo date-only strings (UTC-3, no DST) — anchor
        // both ends to São Paulo wall-clock, not bare UTC, so a notification
        // sent late evening BRT (already "tomorrow" in UTC) isn't dropped
        // just outside the window. Same convention as
        // BancoDeHorasService.getSummary's queryStart.
        createdAt: {
          gte: new Date(`${start}T03:00:00.000Z`),
          lte: new Date(`${end}T23:59:59.999-03:00`),
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, createdAt: true },
    });
    // A colaborador may have been notified more than once in the range
    // (resend) — keep only the most recent per userId; the desc orderBy
    // above guarantees the first match per userId is already the latest.
    const seen = new Map<string, string>();
    for (const n of notifications) {
      if (!seen.has(n.userId)) seen.set(n.userId, n.createdAt.toISOString());
    }
    return Array.from(seen, ([userId, sentAt]) => ({ userId, sentAt }));
  }

  listMine(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(id: string, userId: string) {
    // Compound where (id + userId) instead of a separate ownership check:
    // updateMany with this where affects nothing if the id belongs to a
    // different userId, so a user can't mark someone else's notification
    // read just by guessing its id.
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async sendPontoPerdido(
    tipo: PontoPerdidoTipo,
    employeeUserId: string,
    employeeName: string,
    dateOnly: string,
  ): Promise<void> {
    const dateBR = formatDateOnlyBR(dateOnly);
    const managers = await this.prisma.employee.findMany({
      where: {
        role: { in: ['gestor', 'rh'] },
        deletedAt: null,
        userId: { not: employeeUserId },
      },
    });

    const recipients = [
      {
        userId: employeeUserId,
        message: PONTO_PERDIDO_MESSAGE_COLABORADOR[tipo](dateBR),
        link: '/historico' as string | null,
      },
      ...managers.map((m) => ({
        userId: m.userId,
        message: PONTO_PERDIDO_MESSAGE_GESTOR[tipo](employeeName, dateBR),
        link: null as string | null,
      })),
    ];

    const created = await this.prisma.notification.createManyAndReturn({
      data: recipients.map((r) => ({
        userId: r.userId,
        type: 'ponto_perdido',
        category: tipo,
        message: r.message,
        link: r.link,
      })),
    });

    void Promise.all(
      created.map((n) =>
        this.expoPush.sendToUser(n.userId, {
          title: 'Ponto DCIT',
          body: n.message,
          data: { notificationId: n.id, link: n.link },
        }),
      ),
    );
  }

  async sendMural(postTitle: string, posterUserId: string): Promise<void> {
    const recipients = await this.prisma.employee.findMany({
      where: { deletedAt: null, userId: { not: posterUserId } },
      select: { userId: true },
    });

    const created = await this.prisma.notification.createManyAndReturn({
      data: recipients.map((r) => ({
        userId: r.userId,
        type: 'mural',
        category: null,
        message: muralMessage(postTitle),
        link: '/mural',
      })),
    });

    void Promise.all(
      created.map((n) =>
        this.expoPush.sendToUser(n.userId, {
          title: 'Ponto DCIT',
          body: n.message,
          data: { notificationId: n.id, link: n.link },
        }),
      ),
    );
  }

  async sendDocumentStatusChanged(
    kind: DocumentKind,
    userId: string,
    status: 'aprovado' | 'recusado',
  ): Promise<void> {
    const message = documentStatusMessage(kind, status);
    const created = await this.prisma.notification.create({
      data: {
        userId,
        type: 'documento_status',
        category: kind,
        message,
        link: DOCUMENT_STATUS_LINK[kind],
      },
    });

    void this.expoPush.sendToUser(created.userId, {
      title: 'Ponto DCIT',
      body: created.message,
      data: { notificationId: created.id, link: created.link },
    });
  }

  async sendDocumentSubmitted(
    kind: DocumentKind,
    submitterUserId: string,
    submitterName: string,
  ): Promise<void> {
    const recipients = await this.prisma.employee.findMany({
      where: { role: { in: ['gestor', 'rh'] }, deletedAt: null },
      select: { userId: true },
    });

    const created = await this.prisma.notification.createManyAndReturn({
      data: recipients.map((r) => ({
        userId: r.userId,
        type: 'documento_enviado',
        category: kind,
        message: `${submitterName} enviou ${DOCUMENT_SUBMITTED_LABEL[kind]}.`,
        link: '/documentos',
      })),
    });

    void Promise.all(
      created.map((n) =>
        this.expoPush.sendToUser(n.userId, {
          title: 'Ponto DCIT',
          body: n.message,
          data: { notificationId: n.id, link: n.link },
        }),
      ),
    );
  }

  async sendCareerLevelUp(userId: string, subNivel: string, novoSalario: number, notaFinal: number): Promise<void> {
    const created = await this.prisma.notification.create({
      data: {
        userId,
        type: 'carreira',
        category: null,
        message: careerLevelUpMessage(subNivel, novoSalario, notaFinal),
        link: null,
      },
    });

    void this.expoPush.sendToUser(created.userId, {
      title: 'Ponto DCIT',
      body: created.message,
      data: { notificationId: created.id, link: created.link },
    });
  }
}
