import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { IUser, UserRole } from '../dtos/auth.dto';
import logger from '../utils/logger';

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
      if (!isMatch) {
        logger.warn('Password verification failed');
      }
      return isMatch;
    } catch (error) {
      logger.error(`Error verifying password: ${error}`);
      throw error;
    }
  }

  static generateToken(user: IUser): string {
    try {
      const secret = config.jwt.secret;
      const expiresIn = user.role === UserRole.ADMIN ? '36500d' : '24h'; // ~100 years for admin

      const token = jwt.sign({
        id: user.id,
        businessId: user.businessId,
        role: user.role
      }, secret, {
        expiresIn,
        algorithm: 'HS256'
      });

      logger.info(`Token generated for user: ${user.email} (Role: ${user.role})`);
      return token;
    } catch (error) {
      logger.error(`Error generating token for user ${user.id}: ${error}`);
      throw error;
    }
  }

  static verifyToken(token: string): IUser | null {
    try {
      const secret = config.jwt.secret;
      const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as IUser;
      // logger.debug(`Token verified for user: ${decoded.id}`);
      return decoded;
    } catch (error) {
      logger.warn(`Token verification failed: ${error}`);
      return null;
    }
  }
}
