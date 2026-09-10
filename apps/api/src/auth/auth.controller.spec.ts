import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth-guard';

describe('AuthController.changePassword', () => {
  it('applies only AuthGuard (no role restriction)', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AuthController.prototype.changePassword,
    ) as unknown[] | undefined;
    expect(guards).toEqual([AuthGuard]);
  });

  describe('behavior', () => {
    let controller: AuthController;
    const serviceMock = { changePassword: jest.fn() };
    const AUTH_REQ = { user: { sub: 'user-1', role: 'colaborador', name: 'Ana' } } as never;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        controllers: [AuthController],
        providers: [{ provide: AuthService, useValue: serviceMock }],
      })
        .overrideGuard(AuthGuard)
        .useValue({ canActivate: () => true })
        .compile();

      controller = module.get(AuthController);
    });

    it('changes the password with a valid payload', async () => {
      serviceMock.changePassword.mockResolvedValue(undefined);

      const result = await controller.changePassword(
        { currentPassword: 'senha-antiga', newPassword: 'senha-nova-123' },
        AUTH_REQ,
      );

      expect(result).toEqual({ ok: true });
      expect(serviceMock.changePassword).toHaveBeenCalledWith(
        'user-1',
        'senha-antiga',
        'senha-nova-123',
      );
    });

    it('rejects a new password shorter than 8 characters before calling the service', async () => {
      await expect(
        controller.changePassword(
          { currentPassword: 'senha-antiga', newPassword: 'curta' },
          AUTH_REQ,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(serviceMock.changePassword).not.toHaveBeenCalled();
    });

    it('rejects a missing currentPassword before calling the service', async () => {
      await expect(
        controller.changePassword({ newPassword: 'senha-nova-123' }, AUTH_REQ),
      ).rejects.toThrow(BadRequestException);
      expect(serviceMock.changePassword).not.toHaveBeenCalled();
    });
  });
});
