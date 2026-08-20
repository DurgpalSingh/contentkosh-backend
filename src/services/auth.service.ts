import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/config';
import { IUser, RegisterRequest, LoginRequest, AuthResponse } from '../dtos/auth.dto';
import logger from '../utils/logger';
import * as userRepo from '../repositories/user.repo';
import * as refreshTokenRepo from '../repositories/refreshToken.repo';
import * as businessRepo from '../repositories/business.repo';
import { UserStatus, UserRole, BusinessStatus } from '@prisma/client';
import { AlreadyExistsError, AuthError, BusinessSuspendedError, ForbiddenError, NotFoundError } from '../errors/api.errors';

function buildBusinessSuspendedError(business: { status: BusinessStatus; statusReason: string | null }): BusinessSuspendedError {
  const action = business.status === BusinessStatus.PAUSED ? 'paused' : 'removed';
  const reason = business.statusReason ? ` Reason: ${business.statusReason}` : '';
  return new BusinessSuspendedError(`This institute has been ${action} by the administrator.${reason}`);
}
import { publicPrisma } from '../config/database';

function resolveLoginSlug(data: LoginRequest): string | undefined {
  return data.slug?.trim() || data.businessSlug?.trim() || undefined;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    return hash;
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateAccessToken(user: IUser): string {
    const secret = config.jwt.secret;
    const expiresIn = config.jwt.accessTokenExpiresIn;

    return jwt.sign(
      {
        id: user.id,
        businessId: user.businessId,
        businessSlug: user.businessSlug,
        tenantSchema: user.tenantSchema,
        role: user.role,
        email: user.email,
      },
      secret,
      {
        expiresIn: expiresIn || '15m',
        algorithm: 'HS256',
      } as jwt.SignOptions
    );
  }

  static async generateRefreshToken(userId: number): Promise<string> {
    try {
      // Generate a random token
      const token = crypto.randomBytes(64).toString('hex');

      const expiresIn = config.jwt.refreshTokenExpiresIn;
      const expiresAt = new Date(Date.now() + expiresIn);
      // Store in database
      await refreshTokenRepo.createRefreshToken(userId, token, expiresAt);

      logger.info(`Refresh token generated for user: ${userId}`);
      return token;
    } catch (error) {
      logger.error(`Error generating refresh token for user ${userId}: ${error}`);
      throw error;
    }
  }

  static verifyAccessToken(token: string): IUser | null {
    try {
      const secret = config.jwt.secret;
      return jwt.verify(token, secret, { algorithms: ['HS256'] }) as IUser;
    } catch (error) {
      logger.warn(`Token verification failed: ${error}`);
      return null;
    }
  }

  static generateToken(user: IUser): string {
    return this.generateAccessToken(user);
  }

  static verifyToken(token: string): IUser | null {
    return this.verifyAccessToken(token);
  }

  /**
   * Handles both public signup flows behind one endpoint:
   * - `slug` provided: join an existing business as a guest (role USER) — used by the
   *   business-locked mobile app's "Create account" flow.
   * - `slug` omitted: bootstrap a new institute owner (role ADMIN, no business yet) — the
   *   caller creates the Business separately via POST /api/business.
   */
  static async register(data: RegisterRequest): Promise<AuthResponse> {
    const slug = data.slug?.trim();
    if (slug) {
      return this.registerGuestForBusiness(data, slug);
    }

    logger.info(`Registering new public user: ${data.email}`);
    const existingUser = await userRepo.findByEmail(data.email);
    if (existingUser) {
      throw new AlreadyExistsError('User with this email already exists');
    }

    const hashedPassword = await this.hashPassword(data.password);
    const newUser = await userRepo.createUser({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      mobile: data.mobile,
      role: data.role || UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    return this.issueAuthResponse({ ...newUser, businessId: newUser.businessId ?? null });
  }

  private static async registerGuestForBusiness(data: RegisterRequest, slug: string): Promise<AuthResponse> {
    logger.info(`Guest signup attempt for email: ${data.email}`, { slug });

    const business = await businessRepo.findBusinessBySlug(slug);
    if (!business) {
      throw new NotFoundError('Business');
    }

    const existingUser = await userRepo.findByBusinessAndEmail(business.id, data.email);
    if (existingUser) {
      throw new AlreadyExistsError('User with this email already exists');
    }

    const hashedPassword = await this.hashPassword(data.password);
    const newUser = await userRepo.createUser({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      mobile: data.mobile,
      role: UserRole.USER,
      businessId: business.id,
      status: UserStatus.ACTIVE,
    });

    return this.issueAuthResponse({ ...newUser, businessId: newUser.businessId ?? null }, business);
  }

  private static async issueAuthResponse(
    user: { id: number; email: string; name: string; role: UserRole; businessId: number | null },
    business?: { slug: string | null; schemaName: string | null },
  ): Promise<AuthResponse> {
    const accessToken = this.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
      businessSlug: business?.slug ?? null,
      tenantSchema: business?.schemaName ?? null,
    });
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        businessId: user.businessId,
      },
    };
  }

  static async login(data: LoginRequest): Promise<AuthResponse> {
    logger.info(`Login attempt for email: ${data.email}`);
    const slug = resolveLoginSlug(data);
    let businessId: number | undefined;

    if (slug) {
      const business = await businessRepo.findBusinessBySlug(slug);
      if (!business) throw new AuthError('Invalid institute or password');
      businessId = business.id;
    }

    const candidates = await publicPrisma.user.findMany({
      where: {
        email: data.email.toLowerCase().trim(),
        ...(businessId !== undefined ? { businessId } : {}),
      },
      include: {
        business: { select: { id: true, slug: true, schemaName: true, status: true, statusReason: true } },
      },
    });

    for (const candidate of candidates) {
      const isMatch = await this.verifyPassword(data.password, candidate.password);
      if (!isMatch) continue;
      if (candidate.status !== UserStatus.ACTIVE)
        throw new ForbiddenError('User account is inactive');
      if (candidate.businessId && candidate.business && candidate.business.status !== BusinessStatus.ACTIVE)
        throw buildBusinessSuspendedError(candidate.business);

      const accessToken = this.generateAccessToken({
        id: candidate.id,
        email: candidate.email,
        role: candidate.role,
        businessId: candidate.businessId,
        businessSlug: candidate.business?.slug ?? null,
        tenantSchema: candidate.business?.schemaName ?? null,
      });
      const refreshToken = await this.generateRefreshToken(candidate.id);
      return {
        accessToken,
        refreshToken,
        user: {
          id: candidate.id,
          email: candidate.email,
          name: candidate.name,
          role: candidate.role,
          businessId: candidate.businessId,
        },
      };
    }

    throw new AuthError('Invalid email or password');
  }

  static async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    const storedToken = await refreshTokenRepo.findByToken(refreshToken);
    if (!storedToken) throw new AuthError('Invalid refresh token');
    if (storedToken.isRevoked) throw new AuthError('Refresh token has been revoked');
    if (new Date() > storedToken.expiresAt) throw new AuthError('Refresh token has expired');

    const user = storedToken.user;
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('User account is inactive');
    }
    if (user.businessId && user.business && user.business.status !== BusinessStatus.ACTIVE) {
      throw buildBusinessSuspendedError(user.business);
    }

    await refreshTokenRepo.revokeToken(refreshToken);

    const accessToken = this.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
      businessSlug: user.business?.slug ?? null,
      tenantSchema: user.business?.schemaName ?? null,
    });
    const newRefreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role,
        businessId: user.businessId,
      },
    };
  }

  static async logout(refreshToken: string): Promise<void> {
    await refreshTokenRepo.revokeToken(refreshToken);
  }
}
