import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = [
  'getTasks',
  'toggleTask',
  'listTeamProgress',
  'toggleAccessItem',
  'grantFullAccess',
  'myStatus',
] as const;

describe('OnboardingController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OnboardingController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });

  it('applies RolesGuard(gestor, rh) to listTeamProgress', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OnboardingController.prototype.listTeamProgress,
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OnboardingController.prototype.listTeamProgress,
    ) as unknown[] | undefined;

    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies RolesGuard(gestor, rh) to grantFullAccess', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OnboardingController.prototype.grantFullAccess,
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OnboardingController.prototype.grantFullAccess,
    ) as unknown[] | undefined;

    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('does NOT apply RolesGuard to myStatus (any authenticated role checks their own)', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OnboardingController.prototype.myStatus,
    ) as unknown[] | undefined;

    expect(guards).not.toContain(RolesGuard);
  });
});

describe('OnboardingController', () => {
  let controller: OnboardingController;
  const serviceMock = {
    getTasks: jest.fn(),
    toggleTask: jest.fn(),
    listTeamProgress: jest.fn(),
    toggleAccessItem: jest.fn(),
    grantFullAccess: jest.fn(),
    isUnlocked: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [{ provide: OnboardingService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(OnboardingController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & {
      user: AuthenticatedUser;
    };
  }

  it('gets tasks for the authenticated user', async () => {
    serviceMock.getTasks.mockResolvedValue({ tasks: [], completedTaskIds: [] });

    await controller.getTasks(requestAs('user-1'));

    expect(serviceMock.getTasks).toHaveBeenCalledWith('user-1');
  });

  it('toggles a task for the authenticated user', async () => {
    serviceMock.toggleTask.mockResolvedValue({ completed: true });

    await controller.toggleTask('task-1', requestAs('user-1'));

    expect(serviceMock.toggleTask).toHaveBeenCalledWith('user-1', 'task-1', 'Test User');
  });

  it('lists onboarding progress across the team', async () => {
    serviceMock.listTeamProgress.mockResolvedValue([
      { userId: 'user-1', userName: 'Ana', completedCount: 2, totalCount: 5 },
    ]);

    const result = await controller.listTeamProgress();

    expect(result).toEqual([
      { userId: 'user-1', userName: 'Ana', completedCount: 2, totalCount: 5 },
    ]);
    expect(serviceMock.listTeamProgress).toHaveBeenCalledWith();
  });

  it('toggles a valid access item for the authenticated user', async () => {
    serviceMock.toggleAccessItem.mockResolvedValue({ completed: true });

    const result = await controller.toggleAccessItem('teams', requestAs('user-1'));

    expect(serviceMock.toggleAccessItem).toHaveBeenCalledWith('user-1', 'teams');
    expect(result).toEqual({ completed: true });
  });

  it('rejects an invalid access item without calling the service', () => {
    expect(() => controller.toggleAccessItem('not-a-real-item', requestAs('user-1'))).toThrow(
      'item de acesso inválido',
    );

    expect(serviceMock.toggleAccessItem).not.toHaveBeenCalled();
  });

  it('grants full access for the given userId, passing the granter name', async () => {
    serviceMock.grantFullAccess.mockResolvedValue({
      grantedAt: new Date('2026-09-07'),
      source: 'manual',
      grantedByName: 'Test User',
    });

    const result = await controller.grantFullAccess('user-2', requestAs('user-1'));

    expect(serviceMock.grantFullAccess).toHaveBeenCalledWith('user-2', 'Test User');
    expect(result).toEqual({ grantedAt: new Date('2026-09-07'), source: 'manual', grantedByName: 'Test User' });
  });

  it("gets the authenticated user's own onboarding unlock status", async () => {
    serviceMock.isUnlocked.mockResolvedValue(true);

    const result = await controller.myStatus(requestAs('user-1'));

    expect(serviceMock.isUnlocked).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ unlocked: true });
  });
});
