import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/config';
import { IUser, RegisterRequest, RegisterResponse, VerifyEmailResponse, LoginRequest, AuthResponse } from '../dtos/auth.dto';
import logger from '../utils/logger';
import * as userRepo from '../repositories/user.repo';
import * as refreshTokenRepo from '../repositories/refreshToken.repo';
import * as businessRepo from '../repositories/business.repo';
import { UserStatus, UserRole, BusinessStatus, BusinessProvisioningStatus } from '@prisma/client';
import {
  AlreadyExistsError,
  AuthError,
  BadRequestError,
  BusinessSuspendedError,
  EmailNotVerifiedError,
  ExpiredVerificationLinkError,
  ForbiddenError,
  InvalidVerificationLinkError,
  NotFoundError,
  SessionAlreadyActiveError,
} from '../errors/api.errors';
import { EMAIL_VERIFICATION_MESSAGES } from '../constants/emailVerification.constants';
import { BusinessService } from './business.service';
import { findByRawToken, sendVerificationEmail } from './emailVerification.service';
import { BUSINESS_STATUS_ACTION } from '../constants/business.constants';

function buildBusinessSuspendedError(business: { status: BusinessStatus; statusReason: string | null }): BusinessSuspendedError {
  const action = business.status === BusinessStatus.PAUSED ? BUSINESS_STATUS_ACTION.PAUSED : BUSINESS_STATUS_ACTION.REMOVED;
  return new BusinessSuspendedError(action, business.statusReason);
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

  static generateAccessToken(user: IUser, expiresInOverride?: string): string {
    const secret = config.jwt.secret;
    const expiresIn = expiresInOverride || config.jwt.accessTokenExpiresIn;

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
   * Handles both public signup flows behind one endpoint. Neither issues a session: the
   * account is unusable until the emailed link is opened (see verifyEmail).
   * - `slug` provided: join an existing business as a guest (role USER) - used by the
   *   business-locked mobile app's "Create account" flow.
   * - `slug` omitted: new institute owner (role ADMIN). The institute is only created on verify.
   */
  static async register(data: RegisterRequest): Promise<RegisterResponse> {
    const slug = data.slug?.trim();
    return slug ? this.registerGuest(data, slug) : this.registerInstituteOwner(data);
  }

  private static async registerInstituteOwner(data: RegisterRequest): Promise<RegisterResponse> {
    logger.info(`Registering new institute owner: ${data.email}`);
    const { business: instituteDetails } = data;
    if (!instituteDetails) {
      throw new BadRequestError(EMAIL_VERIFICATION_MESSAGES.INSTITUTE_DETAILS_REQUIRED);
    }

    const abandonedOwner = await this.findAbandonedOwner(data.email);
    if (abandonedOwner) {
      await businessRepo.deletePendingBusinessOfUser(abandonedOwner.id);
    }

    const business = await BusinessService.createPendingBusiness(instituteDetails);
    const owner = await this.saveUnverifiedOwner(data, abandonedOwner);
    const emailSent = await sendVerificationEmail(owner, business);

    return { user: this.toRegisteredUser(owner), emailSent };
  }

  /** Returns the earlier unverified signup for this email, or null; throws if a real account owns it. */
  private static async findAbandonedOwner(email: string) {
    const existingUser = await userRepo.findByEmail(email);
    if (!existingUser) return null;

    if (existingUser.emailVerified || existingUser.businessId) {
      logger.warn(`Signup rejected: email already exists`, { email });
      throw new AlreadyExistsError('User with this email already exists');
    }
    return existingUser;
  }

  private static async saveUnverifiedOwner(data: RegisterRequest, abandonedOwner: { id: number } | null) {
    const password = await this.hashPassword(data.password);

    if (abandonedOwner) {
      logger.info(`Re-signup of unverified institute owner`, { userId: abandonedOwner.id });
      return userRepo.updateUser(abandonedOwner.id, {
        name: data.name,
        password,
        ...(data.mobile !== undefined && { mobile: data.mobile }),
      });
    }

    return userRepo.createUser({
      name: data.name,
      email: data.email,
      password,
      mobile: data.mobile,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: false,
    });
  }

  private static async registerGuest(data: RegisterRequest, slug: string): Promise<RegisterResponse> {
    logger.info(`Guest signup attempt for email: ${data.email}`, { slug });

    const business = await businessRepo.findBusinessBySlug(slug);
    if (business?.provisioningStatus !== BusinessProvisioningStatus.ACTIVE) {
      logger.warn(`Guest signup rejected: business not found`, { slug });
      throw new NotFoundError('Business');
    }

    const existingUser = await userRepo.findByBusinessAndEmail(business.id, data.email);
    if (existingUser) {
      logger.warn(`Guest signup rejected: email already exists`, { email: data.email, businessId: business.id });
      throw new AlreadyExistsError('User with this email already exists');
    }

    const guest = await userRepo.createUser({
      name: data.name,
      email: data.email,
      password: await this.hashPassword(data.password),
      mobile: data.mobile,
      role: UserRole.USER,
      businessId: business.id,
      status: UserStatus.ACTIVE,
      emailVerified: false,
    });
    const emailSent = await sendVerificationEmail(guest, business);

    return { user: this.toRegisteredUser(guest), emailSent };
  }

  private static toRegisteredUser(user: { id: number; email: string; name: string; role: UserRole; businessId: number | null }) {
    const { id, email, name, role, businessId } = user;
    return { id, email, name, role, businessId };
  }

  /**
   * Opens a verification link. A new institute owner gets the institute provisioned now and is
   * logged in; a guest is only marked verified. A link that was already used never logs anyone in,
   * since links are otherwise valid credentials until they expire.
   */
  static async verifyEmail(rawToken: string): Promise<VerifyEmailResponse> {
    const verification = await findByRawToken(rawToken);
    if (!verification) {
      logger.warn(`Verify rejected: unknown token`);
      throw new InvalidVerificationLinkError();
    }

    const { user, business } = verification;
    if (user.emailVerified) {
      logger.info(`Verify skipped: already verified`, { userId: user.id });
      return { alreadyVerified: true, slug: business.slug };
    }
    if (new Date() > verification.expiresAt) {
      logger.warn(`Verify rejected: link expired`, { userId: user.id });
      throw new ExpiredVerificationLinkError(user.email);
    }

    // A pending business means a new institute owner; a retry after a failure past provisioning
    // finds the business already active and goes straight to marking the account verified.
    const isNewInstitute = business.provisioningStatus === BusinessProvisioningStatus.PENDING;
    const activeBusiness = isNewInstitute ? await BusinessService.provisionBusiness(business, user.id) : business;
    await userRepo.updateUser(user.id, { emailVerified: true });
    logger.info(`Email verified`, { userId: user.id, businessId: business.id });

    if (!isNewInstitute) {
      return { alreadyVerified: false, slug: business.slug };
    }

    const accessToken = this.generateAccessToken({
      id: user.id,
      email: user.email,
      role: UserRole.ADMIN,
      businessId: activeBusiness.id,
      businessSlug: activeBusiness.slug,
      tenantSchema: activeBusiness.schemaName,
    });
    const refreshToken = await this.generateRefreshToken(user.id);

    return { alreadyVerified: false, slug: activeBusiness.slug, tokens: { accessToken, refreshToken } };
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

      if (candidate.status !== UserStatus.ACTIVE) {
        logger.warn(`Login rejected: account inactive`, { userId: candidate.id, email: candidate.email });
        throw new ForbiddenError('User account is inactive');
      }
      if (candidate.businessId && candidate.business && candidate.business.status !== BusinessStatus.ACTIVE) {
        logger.warn(`Login rejected: business not active`, {
          userId: candidate.id,
          businessId: candidate.businessId,
          businessStatus: candidate.business.status,
        });
        throw buildBusinessSuspendedError(candidate.business);
      }

      if (!candidate.emailVerified) {
        logger.warn(`Login rejected: email not verified`, { userId: candidate.id, email: candidate.email });
        throw new EmailNotVerifiedError(candidate.email);
      }

      // Enforce one active session per account: reject the login outright rather than
      // silently kicking the other session out. The user must log out there first, or
      // wait for that session's refresh token to go idle and expire.
      const activeSession = await refreshTokenRepo.findActiveTokenByUserId(candidate.id);
      if (activeSession) {
        logger.warn(`Login rejected: session already active`, { userId: candidate.id, email: candidate.email });
        throw new SessionAlreadyActiveError();
      }

      const accessToken = this.generateAccessToken({
        id: candidate.id,
        email: candidate.email,
        role: candidate.role,
        businessId: candidate.businessId,
        businessSlug: candidate.business?.slug ?? null,
        tenantSchema: candidate.business?.schemaName ?? null,
      });
      const refreshToken = await this.generateRefreshToken(candidate.id);

      logger.info(`Login successful`, { userId: candidate.id, email: candidate.email, businessId: candidate.businessId });

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

    logger.warn(`Login rejected: invalid credentials`, { email: data.email });
    throw new AuthError('Invalid email or password');
  }

  static async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    const storedToken = await refreshTokenRepo.findByToken(refreshToken);
    if (!storedToken) {
      logger.warn(`Refresh rejected: token not found`);
      throw new AuthError('Invalid refresh token');
    }
    if (storedToken.isRevoked) {
      logger.warn(`Refresh rejected: token already revoked`, { userId: storedToken.userId });
      throw new AuthError('Refresh token has been revoked');
    }
    if (new Date() > storedToken.expiresAt) {
      logger.warn(`Refresh rejected: token expired`, { userId: storedToken.userId });
      throw new AuthError('Refresh token has expired');
    }

    const user = storedToken.user;
    if (user.status !== UserStatus.ACTIVE) {
      logger.warn(`Refresh rejected: account inactive`, { userId: user.id });
      throw new ForbiddenError('User account is inactive');
    }
    if (user.businessId && user.business && user.business.status !== BusinessStatus.ACTIVE) {
      logger.warn(`Refresh rejected: business not active`, { userId: user.id, businessId: user.businessId });
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

    logger.info(`Token refreshed`, { userId: user.id });

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
    // Resolve the user from the refresh token itself, not req.user: the /auth/logout
    // route has no `authenticate` middleware (logout must still work with an expired
    // or missing access token, using only the refresh-token cookie), so req.user is
    // never populated here.
    const stored = await refreshTokenRepo.findByToken(refreshToken);
    if (!stored) {
      logger.warn(`Logout: token not found`);
      return;
    }

    await refreshTokenRepo.revokeAllUserTokens(stored.userId);

    logger.info(`Logout: all sessions revoked`, { userId: stored.userId });
  }
}
