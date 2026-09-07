process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { ADMISSION_DOCUMENT_KINDS, ONBOARDING_ACCESS_ITEMS } from '@ponto-dcit/shared-types';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// One AdmissionDocument per fixed kind — the minimum needed for the
// requiresUpload task to be considered complete (see mergeDerivedCompletion:
// *every* kind must be present, not just one).
function allAdmissionDocumentsData(userId: string) {
  return ADMISSION_DOCUMENT_KINDS.map((kind) => ({
    userId,
    kind,
    title: kind,
    photoUri: 'data:image/jpeg;base64,Zm9v',
  }));
}

describe('OnboardingService', () => {
  let service: OnboardingService;
  let prisma: PrismaService;
  const notificationsMock = {
    sendOnboardingTaskCompleted: jest.fn(),
    sendFullAccessGranted: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnboardingService, PrismaService, { provide: NotificationsService, useValue: notificationsMock }],
    }).compile();

    service = module.get(OnboardingService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.admissionDocument.deleteMany({
      where: {
        userId: { in: ['user-upload-a', 'user-upload-b-no-docs', 'user-upload-c', 'user-upload-d'] },
      },
    });
    await prisma.onboardingAccessItem.deleteMany({
      where: { userId: { in: ['user-access-a', 'user-access-b', 'user-access-c'] } },
    });
    await prisma.onboardingAccessGrant.deleteMany({
      where: { userId: { in: ['user-grant-a', 'user-grant-b', 'user-grant-c', 'user-grant-d'] } },
    });
    await prisma.onboardingProgress.deleteMany();
    await prisma.onboardingTask.deleteMany();
    await prisma.employee.deleteMany({
      where: { userId: { in: ['user-c', 'user-d', 'onboarding-trash-e', 'user-upload-d', 'user-grant-d'] } },
    });
    await prisma.onModuleDestroy();
  });

  it('returns tasks ordered and marks completed ones for the user', async () => {
    const task1 = await prisma.onboardingTask.create({
      data: {
        icon: 'document-outline',
        title: 'Contrato',
        description: 'Assine o contrato',
        order: 2,
      },
    });
    const task2 = await prisma.onboardingTask.create({
      data: {
        icon: 'key-outline',
        title: 'Acessos',
        description: 'Configure acessos',
        order: 1,
      },
    });
    await prisma.onboardingProgress.create({
      data: { userId: 'user-a', taskId: task1.id },
    });

    const result = await service.getTasks('user-a');

    expect(result.tasks.map((t) => t.id)).toEqual([task2.id, task1.id]);
    expect(result.completedTaskIds).toEqual([task1.id]);
  });

  it('toggles task completion on and off, any number of times', async () => {
    const task = await prisma.onboardingTask.create({
      data: {
        icon: 'videocam-outline',
        title: 'Vídeo',
        description: 'Assista ao vídeo',
        order: 3,
      },
    });

    const toggledOn = await service.toggleTask('user-b', task.id, 'Bruno');
    expect(toggledOn).toEqual({ completed: true });

    const toggledOff = await service.toggleTask('user-b', task.id, 'Bruno');
    expect(toggledOff).toEqual({ completed: false });

    // Undo isn't a one-shot — toggling back and forth repeatedly must keep working.
    const toggledOnAgain = await service.toggleTask('user-b', task.id, 'Bruno');
    expect(toggledOnAgain).toEqual({ completed: true });
    const toggledOffAgain = await service.toggleTask('user-b', task.id, 'Bruno');
    expect(toggledOffAgain).toEqual({ completed: false });
  });

  it('notifies gestor/rh only on the transition into completed, never on undo, and again on re-completion', async () => {
    const task = await prisma.onboardingTask.create({
      data: {
        icon: 'document-outline',
        title: 'Assinar contrato',
        description: 'Assine o contrato',
        order: 4,
      },
    });

    await service.toggleTask('user-notify', task.id, 'Nina Notificada');
    expect(notificationsMock.sendOnboardingTaskCompleted).toHaveBeenCalledTimes(1);
    expect(notificationsMock.sendOnboardingTaskCompleted).toHaveBeenCalledWith(
      'Assinar contrato',
      'user-notify',
      'Nina Notificada',
    );

    await service.toggleTask('user-notify', task.id, 'Nina Notificada');
    expect(notificationsMock.sendOnboardingTaskCompleted).toHaveBeenCalledTimes(1); // still 1 — undo didn't notify

    await service.toggleTask('user-notify', task.id, 'Nina Notificada');
    expect(notificationsMock.sendOnboardingTaskCompleted).toHaveBeenCalledTimes(2); // re-completed — notifies again
  });

  it("summarizes each employee's onboarding progress against the total task count", async () => {
    const task = await prisma.onboardingTask.create({
      data: {
        icon: 'document-outline',
        title: 'Contrato',
        description: 'Assine o contrato',
        order: 1,
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'user-c',
        name: 'Carla Onboarding',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'user-d',
        name: 'Davi Onboarding',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    await prisma.onboardingProgress.create({
      data: { userId: 'user-c', taskId: task.id },
    });

    const results = await service.listTeamProgress();

    const carla = results.find((r) => r.userId === 'user-c');
    const davi = results.find((r) => r.userId === 'user-d');
    expect(carla?.completedCount).toBe(1);
    expect(davi?.completedCount).toBe(0);
    expect(carla?.totalCount).toBe(davi?.totalCount);
    expect(carla?.completedTaskIds).toEqual([task.id]);
    expect(davi?.completedTaskIds).toEqual([]);
    expect(carla?.tasks.map((t) => t.id)).toContain(task.id);
  });

  it('excludes a soft-deleted employee from listTeamProgress', async () => {
    // Uses a fixture id distinct from the plain 'user-e' pattern used by
    // other spec files (solicitacoes, documentos): those run as separate
    // Jest worker processes against this same shared test.db, and a
    // same-named Employee insert here raced with theirs intermittently.
    await prisma.employee.create({
      data: {
        userId: 'onboarding-trash-e',
        name: 'Elisa Excluida',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
        deletedAt: new Date('2026-08-01'),
      },
    });

    const results = await service.listTeamProgress();

    expect(
      results.find((r) => r.userId === 'onboarding-trash-e'),
    ).toBeUndefined();
  });

  describe('derived completion for requiresUpload tasks', () => {
    // Each case below creates its own requiresUpload-flagged task, and the
    // production logic (mergeDerivedCompletion) assumes exactly one such
    // task exists system-wide — true in production, where only "Enviar
    // documentos" is flagged. Without this reset, the flagged tasks from
    // earlier cases in this describe block would still be in the table when
    // a later case runs, and `.find((t) => t.requiresUpload)` would resolve
    // to whichever one was created first instead of the current case's own.
    beforeEach(async () => {
      await prisma.onboardingTask.deleteMany();
    });

    it('does NOT mark a requiresUpload task complete with only one of the five fixed kinds submitted', async () => {
      const task = await prisma.onboardingTask.create({
        data: {
          icon: 'cloud-upload-outline',
          title: 'Enviar documentos',
          description: 'RG, CPF...',
          order: 1,
          requiresUpload: true,
        },
      });
      await prisma.admissionDocument.create({
        data: { userId: 'user-upload-a', kind: 'rg', title: 'RG', photoUri: 'data:image/jpeg;base64,Zm9v' },
      });

      const result = await service.getTasks('user-upload-a');

      expect(result.completedTaskIds).not.toContain(task.id);
    });

    it('marks a requiresUpload task complete once all five fixed kinds are submitted, without an OnboardingProgress row', async () => {
      const task = await prisma.onboardingTask.create({
        data: {
          icon: 'cloud-upload-outline',
          title: 'Enviar documentos 1b',
          description: 'RG, CPF...',
          order: 1,
          requiresUpload: true,
        },
      });
      await prisma.admissionDocument.createMany({ data: allAdmissionDocumentsData('user-upload-a2') });

      const result = await service.getTasks('user-upload-a2');

      expect(result.completedTaskIds).toContain(task.id);

      await prisma.admissionDocument.deleteMany({ where: { userId: 'user-upload-a2' } });
    });

    it('does not mark a requiresUpload task complete for a user with zero admission documents', async () => {
      const task = await prisma.onboardingTask.create({
        data: {
          icon: 'cloud-upload-outline',
          title: 'Enviar documentos 2',
          description: 'RG, CPF...',
          order: 1,
          requiresUpload: true,
        },
      });

      const result = await service.getTasks('user-upload-b-no-docs');

      expect(result.completedTaskIds).not.toContain(task.id);
    });

    it('does not double-count when both an OnboardingProgress row and all five admission documents exist', async () => {
      const task = await prisma.onboardingTask.create({
        data: {
          icon: 'cloud-upload-outline',
          title: 'Enviar documentos 3',
          description: 'RG, CPF...',
          order: 1,
          requiresUpload: true,
        },
      });
      await prisma.onboardingProgress.create({ data: { userId: 'user-upload-c', taskId: task.id } });
      await prisma.admissionDocument.createMany({ data: allAdmissionDocumentsData('user-upload-c') });

      const result = await service.getTasks('user-upload-c');

      expect(result.completedTaskIds.filter((id) => id === task.id)).toHaveLength(1);
    });

    it('factors derived completion into listTeamProgress too', async () => {
      const task = await prisma.onboardingTask.create({
        data: {
          icon: 'cloud-upload-outline',
          title: 'Enviar documentos 4',
          description: 'RG, CPF...',
          order: 1,
          requiresUpload: true,
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'user-upload-d',
          name: 'Dara Onboarding',
          role: 'colaborador',
          hireDate: new Date('2024-03-15'),
        },
      });
      await prisma.admissionDocument.createMany({ data: allAdmissionDocumentsData('user-upload-d') });

      const results = await service.listTeamProgress();

      const dara = results.find((r) => r.userId === 'user-upload-d');
      expect(dara?.completedTaskIds).toContain(task.id);
    });
  });

  describe('derived completion for requiresAccessChecklist tasks, and toggleAccessItem', () => {
    // Same per-case reset reasoning as the requiresUpload describe block
    // above: mergeDerivedCompletion assumes exactly one requiresAccessChecklist
    // task exists system-wide.
    beforeEach(async () => {
      await prisma.onboardingTask.deleteMany();
    });

    it('toggles an access item on and off, any number of times', async () => {
      const toggledOn = await service.toggleAccessItem('user-access-a', 'teams');
      expect(toggledOn).toEqual({ completed: true });

      const toggledOff = await service.toggleAccessItem('user-access-a', 'teams');
      expect(toggledOff).toEqual({ completed: false });

      const toggledOnAgain = await service.toggleAccessItem('user-access-a', 'teams');
      expect(toggledOnAgain).toEqual({ completed: true });

      await prisma.onboardingAccessItem.deleteMany({ where: { userId: 'user-access-a' } });
    });

    it('does NOT mark requiresAccessChecklist complete with only some items checked', async () => {
      const task = await prisma.onboardingTask.create({
        data: {
          icon: 'key-outline',
          title: 'Configurar seus acessos',
          description: 'E-mail, Teams...',
          order: 1,
          requiresAccessChecklist: true,
        },
      });
      for (const item of ONBOARDING_ACCESS_ITEMS.slice(0, 2)) {
        await service.toggleAccessItem('user-access-b', item);
      }

      const result = await service.getTasks('user-access-b');

      expect(result.completedAccessItems).toHaveLength(2);
      expect(result.completedTaskIds).not.toContain(task.id);
    });

    it('marks requiresAccessChecklist complete once every fixed item is checked', async () => {
      const task = await prisma.onboardingTask.create({
        data: {
          icon: 'key-outline',
          title: 'Configurar seus acessos 2',
          description: 'E-mail, Teams...',
          order: 1,
          requiresAccessChecklist: true,
        },
      });
      for (const item of ONBOARDING_ACCESS_ITEMS) {
        await service.toggleAccessItem('user-access-c', item);
      }

      const result = await service.getTasks('user-access-c');

      expect(result.completedAccessItems).toEqual(expect.arrayContaining([...ONBOARDING_ACCESS_ITEMS]));
      expect(result.completedTaskIds).toContain(task.id);

      // Unchecking any single item must flip the derived task back to incomplete.
      await service.toggleAccessItem('user-access-c', ONBOARDING_ACCESS_ITEMS[0]);
      const afterUncheck = await service.getTasks('user-access-c');
      expect(afterUncheck.completedTaskIds).not.toContain(task.id);
    });
  });

  describe('grantFullAccess', () => {
    // Same per-case reset reasoning as the describe blocks above: getTasks
    // (which this reads completion from) sees every OnboardingTask row
    // system-wide, so each case needs a controlled, single-task table.
    beforeEach(async () => {
      await prisma.onboardingTask.deleteMany();
    });

    it('rejects with pending tasks, without notifying', async () => {
      await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Assinar o contrato', description: '...', order: 1 },
      });

      await expect(service.grantFullAccess('user-grant-a')).rejects.toThrow(
        'Ainda há tarefas de onboarding pendentes.',
      );
      expect(notificationsMock.sendFullAccessGranted).not.toHaveBeenCalled();
    });

    it('grants access, persists it, and notifies the colaborador once every task is complete', async () => {
      const task = await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Assistir ao vídeo', description: '...', order: 1 },
      });
      await prisma.onboardingProgress.create({ data: { userId: 'user-grant-b', taskId: task.id } });

      const result = await service.grantFullAccess('user-grant-b');

      expect(result.grantedAt).toBeInstanceOf(Date);
      expect(notificationsMock.sendFullAccessGranted).toHaveBeenCalledWith('user-grant-b');

      const stored = await prisma.onboardingAccessGrant.findUnique({ where: { userId: 'user-grant-b' } });
      expect(stored).not.toBeNull();
    });

    it('is idempotent — calling it again returns the same grant without re-notifying', async () => {
      const task = await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Assistir ao vídeo', description: '...', order: 1 },
      });
      await prisma.onboardingProgress.create({ data: { userId: 'user-grant-c', taskId: task.id } });

      const first = await service.grantFullAccess('user-grant-c');
      const second = await service.grantFullAccess('user-grant-c');

      expect(second.grantedAt).toEqual(first.grantedAt);
      expect(notificationsMock.sendFullAccessGranted).toHaveBeenCalledTimes(1);
    });

    it('reflects fullAccessGrantedAt (null, then set) in listTeamProgress', async () => {
      const task = await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Assistir ao vídeo', description: '...', order: 1 },
      });
      await prisma.employee.create({
        data: {
          userId: 'user-grant-d',
          name: 'Grant Colaborador',
          role: 'colaborador',
          hireDate: new Date('2024-03-15'),
        },
      });

      const beforeGrant = await service.listTeamProgress();
      expect(beforeGrant.find((r) => r.userId === 'user-grant-d')?.fullAccessGrantedAt).toBeNull();

      await prisma.onboardingProgress.create({ data: { userId: 'user-grant-d', taskId: task.id } });
      await service.grantFullAccess('user-grant-d');

      const afterGrant = await service.listTeamProgress();
      expect(afterGrant.find((r) => r.userId === 'user-grant-d')?.fullAccessGrantedAt).not.toBeNull();
    });
  });
});
