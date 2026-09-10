// AuthService.changePassword tests below need a real Prisma-backed test
// database — set before any import so PrismaService's PrismaClient picks it
// up (same convention as notifications.service.spec.ts).
process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import { Issuer } from 'openid-client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { OIDC_CLIENT_CONFIG, type OidcClientConfig } from './oidc-client.token';
import { PrismaService } from '../prisma/prisma.service';

// Discovery is deferred to first use (see AuthService.getClient), so unit
// tests never make a real network call — Issuer.discover is mocked to
// resolve a fake issuer whose `Client` constructor hands back our stub.
jest.mock('openid-client', () => {
  const actual =
    jest.requireActual<typeof import('openid-client')>('openid-client');
  return {
    ...actual,
    Issuer: { discover: jest.fn() },
  };
});

describe('AuthService', () => {
  let service: AuthService;
  let jwt: { sign: jest.Mock };

  const clientMock = {
    authorizationUrl: jest.fn<string, [Record<string, unknown>]>(),
    callback: jest.fn(),
    userinfo: jest.fn(),
  };

  const config: OidcClientConfig = {
    issuerUrl: 'https://mock-idp.test',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };

    (Issuer.discover as jest.Mock).mockResolvedValue({
      Client: jest.fn().mockImplementation(() => clientMock),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OIDC_CLIENT_CONFIG, useValue: config },
        { provide: JwtService, useValue: jwt },
        // Never exercised by the OIDC-flow tests below — AuthService's
        // constructor just needs something injectable here (see the
        // dedicated 'AuthService.changePassword' describe block further
        // down for real Prisma-backed coverage of the password path).
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('discovers the IdP lazily on first use and memoizes the client', async () => {
    clientMock.authorizationUrl.mockReturnValue(
      'https://mock-idp/auth?state=abc',
    );
    // Passed to jest's expect() as a mock reference, never called unbound.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(Issuer.discover).not.toHaveBeenCalled();

    await service.buildAuthorizationUrl('web');
    await service.buildAuthorizationUrl('web');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(Issuer.discover).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(Issuer.discover).toHaveBeenCalledWith(config.issuerUrl);
  });

  it('builds an authorization URL requesting openid/profile/email', async () => {
    clientMock.authorizationUrl.mockReturnValue(
      'https://mock-idp/auth?state=abc',
    );

    const url = await service.buildAuthorizationUrl('web');

    expect(url).toBe('https://mock-idp/auth?state=abc');
    expect(clientMock.authorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'openid profile email' }),
    );
  });

  it('exchanges a valid callback and issues a session JWT with the resolved role', async () => {
    clientMock.authorizationUrl.mockReturnValue('https://mock-idp/auth');
    await service.buildAuthorizationUrl('mobile');
    const { state } = clientMock.authorizationUrl.mock.calls[0][0];

    clientMock.callback.mockResolvedValue({
      claims: () => ({ sub: 'user-1' }),
    });
    clientMock.userinfo.mockResolvedValue({
      name: 'Ana Colaboradora',
      dcit_role: 'colaborador',
    });

    const result = await service.handleCallback(
      'http://localhost:3000/auth/callback',
      {
        state: state as string,
        code: 'auth-code-123',
      },
    );

    expect(result).toEqual({
      sessionToken: 'signed.jwt.token',
      origin: 'mobile',
      role: 'colaborador',
    });
    expect(jwt.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      role: 'colaborador',
      name: 'Ana Colaboradora',
    });
  });

  it('threads the mobile redirect URI from login through to the callback result', async () => {
    clientMock.authorizationUrl.mockReturnValue('https://mock-idp/auth');
    await service.buildAuthorizationUrl(
      'mobile',
      'exp://192.168.1.16:8081/--/auth-callback',
    );
    const { state } = clientMock.authorizationUrl.mock.calls[0][0];

    clientMock.callback.mockResolvedValue({
      claims: () => ({ sub: 'user-1' }),
    });
    clientMock.userinfo.mockResolvedValue({
      name: 'Ana Colaboradora',
      dcit_role: 'colaborador',
    });

    const result = await service.handleCallback(
      'http://localhost:3000/auth/callback',
      {
        state: state as string,
        code: 'auth-code-123',
      },
    );

    expect(result.mobileRedirectUri).toBe(
      'exp://192.168.1.16:8081/--/auth-callback',
    );
  });

  it('rejects a callback with an unknown or expired state', async () => {
    await expect(
      service.handleCallback('http://localhost:3000/auth/callback', {
        state: 'never-issued',
        code: 'x',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a callback whose role claim is not one of the known roles', async () => {
    clientMock.authorizationUrl.mockReturnValue('https://mock-idp/auth');
    await service.buildAuthorizationUrl('web');
    const { state } = clientMock.authorizationUrl.mock.calls[0][0];

    clientMock.callback.mockResolvedValue({
      claims: () => ({ sub: 'user-2' }),
    });
    clientMock.userinfo.mockResolvedValue({ name: 'X', dcit_role: 'admin' });

    await expect(
      service.handleCallback('http://localhost:3000/auth/callback', {
        state: state as string,
        code: 'y',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // Regression test: CLAIM_TO_ROLE used to be a plain object literal, so
  // bracket-indexing it with an IdP-controlled claim string resolved
  // Object.prototype members (e.g. `{}['constructor']`) instead of
  // `undefined`, which is truthy and bypassed the `!role` guard — a fail-open
  // auth bug. It's now a Map, whose `.get()` has no prototype-chain lookup
  // surface, so these claims must be rejected exactly like any other unknown
  // role claim.
  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'rejects a callback whose role claim is the Object.prototype member %j',
    async (claim) => {
      clientMock.authorizationUrl.mockReturnValue('https://mock-idp/auth');
      await service.buildAuthorizationUrl('web');
      const { state } = clientMock.authorizationUrl.mock.calls[0][0];

      clientMock.callback.mockResolvedValue({
        claims: () => ({ sub: 'user-3' }),
      });
      clientMock.userinfo.mockResolvedValue({ name: 'X', dcit_role: claim });

      await expect(
        service.handleCallback('http://localhost:3000/auth/callback', {
          state: state as string,
          code: 'z',
        }),
      ).rejects.toThrow(BadRequestException);
    },
  );
});

describe('AuthService.changePassword', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const config: OidcClientConfig = {
    issuerUrl: 'https://mock-idp.test',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OIDC_CLIENT_CONFIG, useValue: config },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        PrismaService,
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    await prisma.employee.deleteMany({ where: { userId: { startsWith: 'user-change-pw-' } } });
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('changes the password when the current password matches', async () => {
    const passwordHash = await bcrypt.hash('senha-antiga', 10);
    await prisma.employee.create({
      data: {
        userId: 'user-change-pw-1',
        name: 'Ana',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
        email: 'ana@dev.local',
        passwordHash,
      },
    });

    await service.changePassword('user-change-pw-1', 'senha-antiga', 'senha-nova-123');

    const updated = await prisma.employee.findUniqueOrThrow({ where: { userId: 'user-change-pw-1' } });
    expect(await bcrypt.compare('senha-nova-123', updated.passwordHash!)).toBe(true);
  });

  it('rejects when the current password is wrong', async () => {
    const passwordHash = await bcrypt.hash('senha-antiga', 10);
    await prisma.employee.create({
      data: {
        userId: 'user-change-pw-2',
        name: 'Ana',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
        email: 'ana2@dev.local',
        passwordHash,
      },
    });

    await expect(
      service.changePassword('user-change-pw-2', 'senha-errada', 'senha-nova-123'),
    ).rejects.toThrow('Senha atual incorreta.');

    const untouched = await prisma.employee.findUniqueOrThrow({ where: { userId: 'user-change-pw-2' } });
    expect(untouched.passwordHash).toBe(passwordHash);
  });

  it('rejects when the account has no password set (SSO-only)', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-change-pw-3',
        name: 'Ana',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });

    await expect(
      service.changePassword('user-change-pw-3', 'qualquer', 'senha-nova-123'),
    ).rejects.toThrow('Esta conta não usa login por senha.');
  });
});
