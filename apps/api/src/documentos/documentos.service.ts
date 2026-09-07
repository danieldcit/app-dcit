import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ADMISSION_DOCUMENT_KIND_LABELS,
  type AdmissionDocumentInput,
  type CertificationInput,
  type PayslipInput,
  type PayslipUpdate,
  type Role,
} from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildPayslipPdf } from './payslip-pdf';

function parseDateBR(value: string): Date {
  const [day, month, year] = value.split('/').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: ExpoPushService,
    private readonly notifications: NotificationsService,
  ) {}

  listPayslips(userId: string) {
    return this.prisma.payslip.findMany({ where: { userId } });
  }

  async createPayslip(input: PayslipInput) {
    const payslip = await this.prisma.payslip.create({ data: input });
    const notification = await this.prisma.notification.create({
      data: {
        userId: payslip.userId,
        type: 'holerite',
        category: null,
        message: `Novo holerite disponível: ${payslip.label}.`,
        link: '/holerites',
      },
    });
    void this.push.sendToUser(payslip.userId, {
      title: 'Ponto DCIT',
      body: notification.message,
      data: { notificationId: notification.id, link: notification.link },
    });
    return payslip;
  }

  async updatePayslip(id: string, input: PayslipUpdate) {
    const existing = await this.prisma.payslip.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Holerite não encontrado.');
    }
    return this.prisma.payslip.update({ where: { id }, data: input });
  }

  // Idempotent — calling this twice, or on an id that never existed, must
  // not throw. Same pattern as ConvencoesService.delete.
  deletePayslip(id: string) {
    return this.prisma.payslip.deleteMany({ where: { id } });
  }

  async listAllPayslips() {
    const payslips = await this.prisma.payslip.findMany();
    return this.withRequesterNames(payslips);
  }

  // Same access rule as getSignedContractFile: the owner can always download
  // their own holerite, gestor/rh can download anyone's. Returns null for
  // both "not found" and "forbidden" so the controller can't leak which.
  async getPayslipFile(id: string, viewerRole: Role, viewerUserId: string): Promise<Buffer | null> {
    const payslip = await this.prisma.payslip.findUnique({ where: { id } });
    if (!payslip) return null;
    const isReviewer = viewerRole === 'gestor' || viewerRole === 'rh';
    if (!isReviewer && payslip.userId !== viewerUserId) return null;
    const employee = await this.prisma.employee.findUnique({ where: { userId: payslip.userId } });
    return buildPayslipPdf(payslip, employee?.name ?? payslip.userId);
  }

  // One row per (userId, kind) — the "caixinha" for a fixed document type
  // can be resubmitted (e.g. after a "Reprovado"), which replaces its photos
  // and puts it back to "enviado" for re-review, rather than piling up a new
  // row per attempt.
  async createAdmissionDocument(userId: string, userName: string, input: AdmissionDocumentInput) {
    const title = ADMISSION_DOCUMENT_KIND_LABELS[input.kind];
    const [photoUri = null, photoUri2 = null, photoUri3 = null] = input.photos;
    const document = await this.prisma.admissionDocument.upsert({
      where: { userId_kind: { userId, kind: input.kind } },
      create: { userId, kind: input.kind, title, photoUri, photoUri2, photoUri3 },
      update: {
        title,
        photoUri,
        photoUri2,
        photoUri3,
        status: 'enviado',
        reviewNote: null,
        submittedAt: new Date(),
      },
    });
    await this.notifications.sendDocumentSubmitted('admissional', userId, userName);
    return document;
  }

  // photo columns excluded here — same reasoning as Atestado.photoDataUrl: a
  // base64 image never belongs in a bulk list response, even the caller's
  // own. getAdmissionDocumentPhotos is the one-at-a-time path for viewing them.
  listAdmissionDocuments(userId: string) {
    return this.prisma.admissionDocument.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      select: { id: true, kind: true, title: true, status: true, reviewNote: true, submittedAt: true },
    });
  }

  async listAllAdmissionDocuments() {
    const documents = await this.prisma.admissionDocument.findMany({
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        kind: true,
        title: true,
        status: true,
        reviewNote: true,
        submittedAt: true,
      },
    });
    return this.withRequesterNames(documents);
  }

  // Unlike the atestado's clinical fields, an admissional document (RG,
  // comprovante...) has no medical-privacy boundary — gestor and rh can both
  // view it, not just rh. The document's own owner can always view their
  // own photos too. Returns only the populated slots (1 to 3), in order.
  async getAdmissionDocumentPhotos(
    id: string,
    viewerRole: Role,
    viewerUserId: string,
  ): Promise<string[] | null> {
    const document = await this.prisma.admissionDocument.findUnique({
      where: { id },
      select: { photoUri: true, photoUri2: true, photoUri3: true, userId: true },
    });
    if (!document) return null;
    const isReviewer = viewerRole === 'gestor' || viewerRole === 'rh';
    if (!isReviewer && document.userId !== viewerUserId) return null;
    return [document.photoUri, document.photoUri2, document.photoUri3].filter(
      (uri): uri is string => uri !== null,
    );
  }

  async updateAdmissionDocumentStatus(
    id: string,
    status: 'em_analise' | 'aprovado' | 'recusado',
    reviewNote?: string,
  ) {
    const updated = await this.prisma.admissionDocument.update({
      where: { id },
      data: { status, reviewNote: status === 'recusado' ? reviewNote : null },
    });
    if (status !== 'em_analise') {
      await this.notifications.sendDocumentStatusChanged('admissional', updated.userId, status);
    }
    return updated;
  }

  // One row per userId — resubmitting replaces the previous file and bumps
  // submittedAt, same upsert-by-owner pattern as createAdmissionDocument.
  async submitSignedContract(userId: string, userName: string, fileDataUrl: string) {
    const contract = await this.prisma.signedContract.upsert({
      where: { userId },
      create: { userId, fileDataUrl },
      update: { fileDataUrl, submittedAt: new Date() },
    });
    await this.notifications.sendDocumentSubmitted('contrato', userId, userName);
    return { submittedAt: contract.submittedAt };
  }

  // Always resolves to an object, never a bare null — same reasoning as
  // getAdmissionDocumentPhotos wrapping its result in { photos }: a
  // controller returning a bare null serializes as an empty HTTP body,
  // which breaks a caller's res.json()/JSON.parse().
  async getMySignedContract(userId: string): Promise<{ submittedAt: Date | null }> {
    const contract = await this.prisma.signedContract.findUnique({
      where: { userId },
      select: { submittedAt: true },
    });
    return { submittedAt: contract?.submittedAt ?? null };
  }

  // Same access rule as getAdmissionDocumentPhotos: the owner can always see
  // their own file, gestor/rh can see anyone's — no other colaborador can.
  async getSignedContractFile(
    contractUserId: string,
    viewerRole: Role,
    viewerUserId: string,
  ): Promise<string | null> {
    const isReviewer = viewerRole === 'gestor' || viewerRole === 'rh';
    if (!isReviewer && contractUserId !== viewerUserId) return null;
    const contract = await this.prisma.signedContract.findUnique({
      where: { userId: contractUserId },
      select: { fileDataUrl: true },
    });
    return contract?.fileDataUrl ?? null;
  }

  async listTeamSignedContracts() {
    const [employees, contracts] = await Promise.all([
      this.prisma.employee.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
      this.prisma.signedContract.findMany({ select: { userId: true, submittedAt: true } }),
    ]);
    const submittedAtByUserId = new Map(contracts.map((c) => [c.userId, c.submittedAt]));
    return employees.map((employee) => ({
      userId: employee.userId,
      userName: employee.name,
      submittedAt: submittedAtByUserId.get(employee.userId) ?? null,
    }));
  }

  createCertification(userId: string, input: CertificationInput) {
    return this.prisma.certification.create({
      data: {
        userId,
        name: input.name,
        institution: input.institution,
        validUntil: parseDateBR(input.validUntil),
      },
    });
  }

  listCertifications(userId: string) {
    return this.prisma.certification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAllCertifications() {
    const certifications = await this.prisma.certification.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return this.withRequesterNames(certifications);
  }

  // Shared by every listAll* method: joins each record against Employee for
  // a display name, falling back to the bare userId when no Employee row
  // exists — same pattern as SolicitacoesService.withRequesterNames.
  private async withRequesterNames<T extends { userId: string }>(
    records: T[],
  ): Promise<(T & { userName: string })[]> {
    const employees = await this.prisma.employee.findMany({
      where: { userId: { in: records.map((record) => record.userId) } },
    });
    const nameByUserId = new Map(
      employees.map((employee) => [employee.userId, employee.name]),
    );
    return records.map((record) => ({
      ...record,
      userName: nameByUserId.get(record.userId) ?? record.userId,
    }));
  }
}
