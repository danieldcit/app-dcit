import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Issuer, generators, type Client } from 'openid-client';
import type { Role } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { OIDC_CLIENT_CONFIG, type OidcClientConfig } from './oidc-client.token';

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

type LoginOrigin = 'web' | 'mobile';
type PendingLogin = {
  nonce: string;
  origin: LoginOrigin;
  mobileRedirectUri?: string;
};

// Identity mapping today because the mock IdP already emits our exact
// role strings. When a real IdP is wired up, its claim shape (e.g. Entra
// ID group GUIDs) is unknown yet — this is the one place to update the
// mapping without touching any other code, per design spec §6.
const CLAIM_TO_ROLE = new Map<string, Role>([
  ['colaborador', 'colaborador'],
  ['gestor', 'gestor'],
  ['rh', 'rh'],
]);

@Injectable()
export class AuthService {
  private readonly pendingLogins = new Map<string, PendingLogin>();
  private clientPromise: Promise<Client> | null = null;

  constructor(
    @Inject(OIDC_CLIENT_CONFIG) private readonly config: OidcClientConfig,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // OIDC discovery hits the IdP over the network, so it can't run at module
  // init / app boot without making the whole API's startup (including
  // /health) depend on the IdP being reachable. Instead it's deferred to the
  // first real login attempt and memoized here so subsequent logins reuse
  // the same client rather than re-discovering every time.
  private getClient(): Promise<Client> {
    if (!this.clientPromise) {
      this.clientPromise = Issuer.discover(this.config.issuerUrl).then(
        (issuer) =>
          new issuer.Client({
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            redirect_uris: [this.config.redirectUri],
            response_types: ['code'],
          }),
      );
    }
    return this.clientPromise;
  }

  async buildAuthorizationUrl(
    origin: LoginOrigin,
    mobileRedirectUri?: string,
  ): Promise<string> {
    const client = await this.getClient();
    const state = generators.state();
    const nonce = generators.nonce();
    this.pendingLogins.set(state, { nonce, origin, mobileRedirectUri });

    return client.authorizationUrl({
      scope: 'openid profile email',
      state,
      nonce,
      // Without this, the IdP's own session cookie silently re-authenticates
      // whoever was last signed in, so logging out of the app and signing
      // back in lands right back on the same account/role instead of
      // letting the user pick which one to enter as.
      prompt: 'login',
    });
  }

  async handleCallback(
    redirectUri: string,
    params: Record<string, string>,
  ): Promise<{
    sessionToken: string;
    origin: LoginOrigin;
    mobileRedirectUri?: string;
    role: Role;
  }> {
    const pending = params.state
      ? this.pendingLogins.get(params.state)
      : undefined;
    if (!pending) {
      throw new BadRequestException('Unknown or expired login attempt');
    }
    this.pendingLogins.delete(params.state);

    const client = await this.getClient();
    const tokenSet = await client.callback(redirectUri, params, {
      state: params.state,
      nonce: pending.nonce,
    });
    const { sub } = tokenSet.claims();
    // The id_token from a plain `response_type=code` exchange only carries
    // the required OpenID claims (sub, iss, aud, ...); scope-derived profile
    // claims like name/dcit_role are only available from the UserInfo
    // endpoint, so they must be fetched separately rather than read off the
    // id_token's claims.
    const userinfo = (await client.userinfo(tokenSet)) as {
      name?: string;
      dcit_role?: unknown;
    };
    const role = this.resolveRole(userinfo.dcit_role);

    const sessionToken = this.jwt.sign({
      sub,
      role,
      name: userinfo.name,
    });

    return {
      sessionToken,
      origin: pending.origin,
      mobileRedirectUri: pending.mobileRedirectUri,
      role,
    };
  }

  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<{ sessionToken: string; role: Role; name: string }> {
    const employee = await this.prisma.employee.findUnique({ where: { email } });
    // Same generic message whether the email doesn't exist, has no password
    // set (SSO-only account), or the password is simply wrong — telling
    // those apart would let an attacker enumerate real accounts.
    if (!employee || !employee.passwordHash) {
      throw new UnauthorizedException('Email ou senha incorretos.');
    }
    const matches = await bcrypt.compare(password, employee.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Email ou senha incorretos.');
    }

    const role = this.resolveRole(employee.role);
    const sessionToken = this.jwt.sign({ sub: employee.userId, role, name: employee.name });
    return { sessionToken, role, name: employee.name };
  }

  // Always resolves, even for an unknown identifier — returning {} (no
  // devCode) rather than throwing keeps the controller's response
  // indistinguishable from "code sent", so this never reveals whether an
  // email/phone has an account (see AuthController.forgotPassword).
  async requestPasswordReset(identifier: string): Promise<{ devCode?: string }> {
    const employee = await this.prisma.employee.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
    if (!employee) {
      return {};
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.passwordResetCode.create({
      data: {
        userId: employee.userId,
        code,
        expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
      },
    });

    // Dev mode: no real email/SMS provider is configured (see design spec
    // §7), so the code is handed straight back instead of silently going
    // nowhere. Swap this for an actual delivery integration before
    // production.
    return { devCode: code };
  }

  async resetPassword(
    identifier: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    const invalidCode = () =>
      new BadRequestException('Código inválido ou expirado.');

    const employee = await this.prisma.employee.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
    if (!employee) {
      throw invalidCode();
    }

    const resetCode = await this.prisma.passwordResetCode.findFirst({
      where: {
        userId: employee.userId,
        code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!resetCode) {
      throw invalidCode();
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.passwordResetCode.update({
        where: { id: resetCode.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.employee.update({
        where: { userId: employee.userId },
        data: { passwordHash },
      }),
    ]);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee || !employee.passwordHash) {
      throw new BadRequestException(
        'Esta conta não usa login por senha.',
      );
    }
    const matches = await bcrypt.compare(currentPassword, employee.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.employee.update({
      where: { userId },
      data: { passwordHash },
    });
  }

  private resolveRole(claim: unknown): Role {
    const role =
      typeof claim === 'string' ? CLAIM_TO_ROLE.get(claim) : undefined;
    if (!role) {
      throw new BadRequestException(
        `Unrecognized role claim: ${String(claim)}`,
      );
    }
    return role;
  }
}
