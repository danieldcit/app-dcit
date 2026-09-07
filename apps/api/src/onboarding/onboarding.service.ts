import { BadRequestException, Injectable } from '@nestjs/common';
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
    const [tasks, progress, admissionDocuments, accessItems] = await Promise.all([
      this.prisma.onboardingTask.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.onboardingProgress.findMany({ where: { userId } }),
      this.prisma.admissionDocument.findMany({ where: { userId }, select: { kind: true } }),
      this.prisma.onboardingAccessItem.findMany({ where: { userId } }),
    ]);
    const submittedKinds = admissionDocuments.map((d) => d.kind);
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
    const grantedAtByUser = new Map(accessGrants.map((g) => [g.userId, g.grantedAt]));
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
      select: { userId: true, kind: true },
    });
    const submittedKindsByUser = new Map<string, (string | null)[]>();
    for (const doc of admissionDocuments) {
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
      return {
        userId: employee.userId,
        userName: employee.name,
        completedCount: completedTaskIds.length,
        totalCount: tasks.length,
        tasks,
        completedTaskIds,
        fullAccessGrantedAt: grantedAtByUser.get(employee.userId) ?? null,
      };
    });
  }

  // Manual, one-time action gestor/rh takes after every onboarding task is
  // done — not derived like the two tasks above, and not reversible: once
  // granted, re-calling this is a no-op (returns the existing grant) rather
  // than re-notifying the colaborador.
  async grantFullAccess(userId: string) {
    const { tasks, completedTaskIds } = await this.getTasks(userId);
    if (tasks.length === 0 || completedTaskIds.length < tasks.length) {
      throw new BadRequestException('Ainda há tarefas de onboarding pendentes.');
    }

    const existing = await this.prisma.onboardingAccessGrant.findUnique({ where: { userId } });
    if (existing) {
      return { grantedAt: existing.grantedAt };
    }

    const grant = await this.prisma.onboardingAccessGrant.create({ data: { userId } });
    await this.notifications.sendFullAccessGranted(userId);
    return { grantedAt: grant.grantedAt };
  }

  // Called after any mutation that could complete the track (the two
  // toggles below, plus DocumentosService's admission-document and
  // signed-contract writes — see Task 6). Idempotent: does nothing if a
  // grant already exists (auto or manual) or the track isn't complete yet.
  async checkAutoUnlock(userId: string): Promise<void> {
    const { tasks, completedTaskIds } = await this.getTasks(userId);
    if (tasks.length === 0 || completedTaskIds.length < tasks.length) return;

    const existing = await this.prisma.onboardingAccessGrant.findUnique({ where: { userId } });
    if (existing) return;

    await this.prisma.onboardingAccessGrant.create({ data: { userId, source: 'auto' } });
    await this.notifications.sendFullAccessGranted(userId);
  }

  // Checks both signals rather than trusting the grant row alone — same
  // defensive-derivation spirit as mergeDerivedCompletion treating
  // completion as a fact to recompute, not just stored state.
  async isUnlocked(userId: string): Promise<boolean> {
    const grant = await this.prisma.onboardingAccessGrant.findUnique({ where: { userId } });
    if (grant) return true;
    const { tasks, completedTaskIds } = await this.getTasks(userId);
    return tasks.length > 0 && completedTaskIds.length === tasks.length;
  }

  // Two tasks are never toggled by hand, derived instead — both require
  // *every* fixed item to be present, not just one:
  // - requiresUpload ("Enviar documentos"): all 5 ADMISSION_DOCUMENT_KINDS
  //   have been submitted (from anywhere — the Documentos tab or this
  //   Onboarding task embed both write the same AdmissionDocument rows).
  //   Sending only one of the five (e.g. just RG) must NOT complete this.
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
    await this.checkAutoUnlock(userId);
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
    await this.checkAutoUnlock(userId);
    return { completed: true };
  }
}
