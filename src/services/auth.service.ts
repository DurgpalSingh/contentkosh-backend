// src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/config';
import { IUser, RegisterRequest, LoginRequest, AuthResponse } from '../dtos/auth.dto';
import logger from '../utils/logger';
import * as userRepo from '../repositories/user.repo';
import * as refreshTokenRepo from '../repositories/refreshToken.repo';
import { UserStatus, UserRole } from '@prisma/client';
import { AuthError, ForbiddenError } from '../errors/api.errors';

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    try {
      const hash = await bcrypt.hash(password, saltRounds);
      return hash;
    } catch (error) {
      logger.error(`Error hashing password: ${error}`);
      throw error;
    }
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      const isMatch = await bcrypt.compare(password, hashedPassword);
      return isMatch;
    } catch (error) {
      logger.error(`Error verifying password: ${error}`);
      throw error;
    }
  }

  static generateAccessToken(user: IUser): string {
    try {
      const secret = config.jwt.secret;
      const expiresIn = config.jwt.accessTokenExpiresIn;

      const token = jwt.sign({
        id: user.id,
        businessId: user.businessId,
        role: user.role,
        email: user.email
      }, secret, {
        expiresIn: expiresIn || '15m',
        algorithm: 'HS256'
      } as jwt.SignOptions);

      logger.info(`Access token generated for user: ${user.email}`);
      return token;
    } catch (error) {
      logger.error(`Error generating access token for user ${user.id}: ${error}`);
      throw error;
    }
  }

  static async generateRefreshToken(userId: number): Promise<string> {
    try {
      // Generate a random token
      const token = crypto.randomBytes(64).toString('hex');

      const expiresIn = config.jwt.refreshTokenExpiresIn; // in ms
      const expiresAt = new Date(Date.now() + (typeof expiresIn === 'number' ? expiresIn : 604800000));
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
      const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as IUser;
      return decoded;
    } catch (error) {
      logger.warn(`Token verification failed: ${error}`);
      return null;
    }
  }

  // Legacy method for backward compatibility - will be removed in future
  static generateToken(user: IUser): string {
    return this.generateAccessToken(user);
  }

  // Legacy method for backward compatibility - will be removed in future
  static verifyToken(token: string): IUser | null {
    return this.verifyAccessToken(token);
  }

  static async register(data: RegisterRequest): Promise<AuthResponse> {
    const hashedPassword = await this.hashPassword(data.password);

    // Note: Creating user without businessId initially. 
    // Users are associated with a business when an admin adds them to a business-specific entity (like Batch),
    // or if the registration flow identifies the business context (not currently in RegisterRequest).
    const newUser = await userRepo.createUser({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      mobile: data.mobile,
      role: data.role || UserRole.ADMIN,
      status: UserStatus.ACTIVE
    });

    const accessToken = this.generateAccessToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      businessId: newUser.businessId
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
        businessId: newUser.businessId
      }
    };
  }

  static async login(data: LoginRequest): Promise<AuthResponse> {
    const user = await userRepo.findByEmailWithBusinesses(data.email);

    if (!user) {
      throw new AuthError('Invalid email or password');
    }

    const isMatch = await this.verifyPassword(data.password, user.password);
    if (!isMatch) {
      throw new AuthError('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('User account is inactive');
    }

    const accessToken = this.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId
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
        businessId: user.businessId
      }
    };
  }

  static async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    // Find the refresh token in database
    const storedToken = await refreshTokenRepo.findByToken(refreshToken);

    if (!storedToken) {
      throw new AuthError('Invalid refresh token');
    }

    // Check if token is revoked
    if (storedToken.isRevoked) {
      throw new AuthError('Refresh token has been revoked');
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      throw new AuthError('Refresh token has expired');
    }

    // Check if user is still active
    const user = storedToken.user;
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('User account is inactive');
    }

    // Revoke the old refresh token (rotation for security)
    await refreshTokenRepo.revokeToken(refreshToken);

    // Generate new tokens
    const newAccessToken = this.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId
    });

    const newRefreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role,
        businessId: user.businessId
      }
    };
  }

  static async logout(refreshToken: string): Promise<void> {
    try {
      await refreshTokenRepo.revokeToken(refreshToken);
      logger.info('Refresh token revoked on logout');
    } catch (error) {
      logger.warn(`Error revoking refresh token on logout: ${error}`);
      // Don't throw - logout should succeed even if token is already invalid
    }
  }

  static async logoutAll(userId: number): Promise<void> {
    await refreshTokenRepo.revokeAllUserTokens(userId);
    logger.info(`All refresh tokens revoked for user: ${userId}`);
  }
}
