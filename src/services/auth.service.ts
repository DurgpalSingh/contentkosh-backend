import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/config';
import { IUser, RegisterRequest, LoginRequest, AuthResponse } from '../dtos/auth.dto';
import logger from '../utils/logger';
import * as userRepo from '../repositories/user.repo';
import * as refreshTokenRepo from '../repositories/refreshToken.repo';
import * as businessRepo from '../repositories/business.repo';
import { UserStatus, UserRole } from '@prisma/client';
import { AlreadyExistsError, AuthError, ForbiddenError } from '../errors/api.errors';
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
    const token = crypto.randomBytes(64).toString('hex');
    const expiresIn = config.jwt.refreshTokenExpiresIn;
    const expiresAt = new Date(Date.now() + (typeof expiresIn === 'number' ? expiresIn : 604800000));
    await refreshTokenRepo.createRefreshToken(userId, token, expiresAt);
    return token;
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

  static async register(data: RegisterRequest): Promise<AuthResponse> {
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

    const accessToken = this.generateAccessToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      businessId: newUser.businessId ?? null,
    });
    const refreshToken = await this.generateRefreshToken(newUser.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        businessId: newUser.businessId,
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
        business: { select: { id: true, slug: true, schemaName: true } },
      },
    });

    for (const candidate of candidates) {
      const isMatch = await this.verifyPassword(data.password, candidate.password);
      if (!isMatch) continue;
      if (candidate.status !== UserStatus.ACTIVE)
        throw new ForbiddenError('User account is inactive');

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
