import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getTasks(userId: string) {
    const [tasks, progress, admissionDocumentCount] = await Promise.all([
      this.prisma.onboardingTask.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.onboardingProgress.findMany({ where: { userId } }),
      this.prisma.admissionDocument.count({ where: { userId } }),
    ]);
    return {
      tasks,
      completedTaskIds: this.mergeDerivedCompletion(tasks, progress.map((p) => p.taskId), admissionDocumentCount),
    };
  }

  async listTeamProgress() {
    const [tasks, employees, progress] = await Promise.all([
      this.prisma.onboardingTask.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.employee.findMany({ where: { deletedAt: null } }),
      this.prisma.onboardingProgress.findMany(),
    ]);
    const completedByUser = new Map<string, string[]>();
    for (const entry of progress) {
      const completed = completedByUser.get(entry.userId) ?? [];
      completed.push(entry.taskId);
      completedByUser.set(entry.userId, completed);
    }
    const admissionDocumentCounts = await this.prisma.admissionDocument.groupBy({
      by: ['userId'],
      _count: { userId: true },
      where: { userId: { in: employees.map((e) => e.userId) } },
    });
    const admissionDocumentCountByUser = new Map(
      admissionDocumentCounts.map((row) => [row.userId, row._count.userId]),
    );
    return employees.map((employee) => {
      const rawCompletedTaskIds = completedByUser.get(employee.userId) ?? [];
      const completedTaskIds = this.mergeDerivedCompletion(
        tasks,
        rawCompletedTaskIds,
        admissionDocumentCountByUser.get(employee.userId) ?? 0,
      );
      return {
        userId: employee.userId,
        userName: employee.name,
        completedCount: completedTaskIds.length,
        totalCount: tasks.length,
        tasks,
        completedTaskIds,
      };
    });
  }

  // A task flagged requiresUpload (today, always "Enviar documentos") is
  // never toggled by hand — it's derived from whether the colaborador has
  // sent at least one admission document, from anywhere (the Documentos
  // tab or the Onboarding task embedding the same upload boxes). This is
  // additive to (never a replacement for) the OnboardingProgress-backed
  // completion the other 4 tasks still use.
  private mergeDerivedCompletion(
    tasks: { id: string; requiresUpload: boolean }[],
    progressTaskIds: string[],
    admissionDocumentCount: number,
  ): string[] {
    if (admissionDocumentCount === 0) return progressTaskIds;
    const uploadTask = tasks.find((t) => t.requiresUpload);
    if (!uploadTask || progressTaskIds.includes(uploadTask.id)) return progressTaskIds;
    return [...progressTaskIds, uploadTask.id];
  }

  async toggleTask(userId: string, taskId: string) {
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
    return { completed: true };
  }
}
