import { Injectable } from '@nestjs/common';
import { ADMISSION_DOCUMENT_KINDS, ONBOARDING_ACCESS_ITEMS } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getTasks(userId: string) {
    const [tasks, progress, admissionDocuments, accessItems, grant] = await Promise.all([
      this.prisma.onboardingTask.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.onboardingProgress.findMany({ where: { userId } }),
      this.prisma.admissionDocument.findMany({ where: { userId }, select: { kind: true, status: true } }),
      this.prisma.onboardingAccessItem.findMany({ where: { userId } }),
      this.prisma.onboardingAccessGrant.findUnique({ where: { userId } }),
    ]);
    // A rejected document doesn't count toward "submitted" — resubmission
    // is required, same as it never counted before it was ever reviewed.
    // "em_analise" (not yet reviewed) still counts, same as today: only a
    // reviewer's rejection un-counts it.
    const submittedKinds = admissionDocuments.filter((d) => d.status !== 'recusado').map((d) => d.kind);
    const completedAccessItems = accessItems.map((item) => item.itemKey);
    return {
      tasks,
      completedTaskIds: this.mergeDerivedCompletion(
        tasks,
        progress.map((p) => p.taskId),
        submittedKinds,
        completedAccessItems,
      ),
      completedAccessItems,
      fullAccessGrantedAt: grant?.grantedAt ?? null,
    };
  }

  async listTeamProgress() {
    const [tasks, employees, progress, accessItems, accessGrants] = await Promise.all([
      this.prisma.onboardingTask.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.employee.findMany({ where: { deletedAt: null } }),
      this.prisma.onboardingProgress.findMany(),
      this.prisma.onboardingAccessItem.findMany(),
      this.prisma.onboardingAccessGrant.findMany(),
    ]);
    const grantByUser = new Map(accessGrants.map((g) => [g.userId, g]));
    const completedByUser = new Map<string, string[]>();
    for (const entry of progress) {
      const completed = completedByUser.get(entry.userId) ?? [];
      completed.push(entry.taskId);
      completedByUser.set(entry.userId, completed);
    }
    const accessItemsByUser = new Map<string, string[]>();
    for (const item of accessItems) {
      const keys = accessItemsByUser.get(item.userId) ?? [];
      keys.push(item.itemKey);
      accessItemsByUser.set(item.userId, keys);
    }
    const admissionDocuments = await this.prisma.admissionDocument.findMany({
      where: { userId: { in: employees.map((e) => e.userId) } },
      select: { userId: true, kind: true, status: true },
    });
    // Same "rejected doesn't count as submitted" rule as getTasks.
    const submittedKindsByUser = new Map<string, (string | null)[]>();
    for (const doc of admissionDocuments) {
      if (doc.status === 'recusado') continue;
      const kinds = submittedKindsByUser.get(doc.userId) ?? [];
      kinds.push(doc.kind);
      submittedKindsByUser.set(doc.userId, kinds);
    }
    return employees.map((employee) => {
      const rawCompletedTaskIds = completedByUser.get(employee.userId) ?? [];
      const completedTaskIds = this.mergeDerivedCompletion(
        tasks,
        rawCompletedTaskIds,
        submittedKindsByUser.get(employee.userId) ?? [],
        accessItemsByUser.get(employee.userId) ?? [],
      );
      const grant = grantByUser.get(employee.userId);
      return {
        userId: employee.userId,
        userName: employee.name,
        completedCount: completedTaskIds.length,
        totalCount: tasks.length,
        tasks,
        completedTaskIds,
        fullAccessGrantedAt: grant?.grantedAt ?? null,
        fullAccessGrantSource: grant?.source ?? null,
        fullAccessGrantedByName: grant?.grantedByName ?? null,
      };
    });
  }

  // The only way full access is ever granted — completing every onboarding
  // task no longer unlocks by itself (reverted per explicit request: gestor/rh
  // must always take this action, whether the colaborador has finished
  // everything yet or not). A gestor/rh calling this after the colaborador
  // already finished is the normal "formalize it" path; calling it before
  // is the early exception. Idempotent: once a grant exists, re-calling
  // this returns it unchanged rather than re-notifying or overwriting it.
  async grantFullAccess(userId: string, granterName: string) {
    const existing = await this.prisma.onboardingAccessGrant.findUnique({ where: { userId } });
    if (existing) {
      return { grantedAt: existing.grantedAt, source: existing.source, grantedByName: existing.grantedByName };
    }

    const grant = await this.prisma.onboardingAccessGrant.create({
      data: { userId, source: 'manual', grantedByName: granterName },
    });
    await this.notifications.sendFullAccessGranted(userId);
    return { grantedAt: grant.grantedAt, source: grant.source, grantedByName: grant.grantedByName };
  }

  // Access is unlocked only once gestor/rh explicitly grants it — finishing
  // every task no longer unlocks on its own (see grantFullAccess).
  async isUnlocked(userId: string): Promise<boolean> {
    const grant = await this.prisma.onboardingAccessGrant.findUnique({ where: { userId } });
    return grant !== null;
  }

  // Two tasks are never toggled by hand, derived instead — both require
  // *every* fixed item to be present, not just one:
  // - requiresUpload ("Enviar documentos"): all 5 ADMISSION_DOCUMENT_KINDS
  //   have been submitted (from anywhere — the Documentos tab or this
  //   Onboarding task embed both write the same AdmissionDocument rows).
  //   Sending only one of the five (e.g. just RG) must NOT complete this.
  //   Callers pre-filter out any kind whose current status is "recusado"
  //   (see getTasks/listTeamProgress) — a rejected document needs
  //   resubmission before it counts again, same as never having been sent.
  // - requiresAccessChecklist ("Configurar seus acessos"): every fixed
  //   ONBOARDING_ACCESS_ITEMS key has its own OnboardingAccessItem row.
  // Both are additive to (never a replacement for) the OnboardingProgress-
  // backed completion the other tasks still use.
  private mergeDerivedCompletion(
    tasks: { id: string; requiresUpload: boolean; requiresAccessChecklist: boolean }[],
    progressTaskIds: string[],
    submittedAdmissionKinds: (string | null)[],
    completedAccessItemKeys: string[],
  ): string[] {
    let result = progressTaskIds;

    const allDocumentsSubmitted = ADMISSION_DOCUMENT_KINDS.every((kind) =>
      submittedAdmissionKinds.includes(kind),
    );
    if (allDocumentsSubmitted) {
      const uploadTask = tasks.find((t) => t.requiresUpload);
      if (uploadTask && !result.includes(uploadTask.id)) {
        result = [...result, uploadTask.id];
      }
    }

    const allAccessItemsDone = ONBOARDING_ACCESS_ITEMS.every((key) => completedAccessItemKeys.includes(key));
    if (allAccessItemsDone) {
      const accessTask = tasks.find((t) => t.requiresAccessChecklist);
      if (accessTask && !result.includes(accessTask.id)) {
        result = [...result, accessTask.id];
      }
    }

    return result;
  }

  // Freely reversible — a colaborador can toggle a task on and off as many
  // times as they like. Only the transition *into* completed notifies
  // gestor/rh (see NotificationsService.sendOnboardingTaskCompleted);
  // undoing never does, so toggling back and forth doesn't spam them either
  // — each re-completion after an undo does notify again, since from
  // gestor/rh's perspective that's a genuine new "done" event.
  async toggleTask(userId: string, taskId: string, userName: string) {
    const existing = await this.prisma.onboardingProgress.findUnique({
      where: { userId_taskId: { userId, taskId } },
    });

    if (existing) {
      await this.prisma.onboardingProgress.delete({
        where: { id: existing.id },
      });
      return { completed: false };
    }

    await this.prisma.onboardingProgress.create({ data: { userId, taskId } });
    const task = await this.prisma.onboardingTask.findUnique({ where: { id: taskId } });
    if (task) {
      await this.notifications.sendOnboardingTaskCompleted(task.title, userId, userName);
    }
    return { completed: true };
  }

  // Same freely-reversible toggle as toggleTask, but for one access item
  // rather than a whole task — no notification here, same as an individual
  // admission-document upload doesn't notify on its own (the notification
  // fires from the action that produced it, not from the derived task
  // completion this contributes to).
  async toggleAccessItem(userId: string, itemKey: string) {
    const existing = await this.prisma.onboardingAccessItem.findUnique({
      where: { userId_itemKey: { userId, itemKey } },
    });

    if (existing) {
      await this.prisma.onboardingAccessItem.delete({ where: { id: existing.id } });
      return { completed: false };
    }

    await this.prisma.onboardingAccessItem.create({ data: { userId, itemKey } });
    return { completed: true };
  }
}
