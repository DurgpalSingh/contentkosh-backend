import { UserRole } from '@prisma/client';
import { AuthService } from '../../../src/services/auth.service';
import * as emailVerificationService from '../../../src/services/emailVerification.service';
import * as userRepo from '../../../src/repositories/user.repo';
import * as businessRepo from '../../../src/repositories/business.repo';
import * as refreshTokenRepo from '../../../src/repositories/refreshToken.repo';
import * as tokenRepo from '../../../src/repositories/emailVerificationToken.repo';
import { BusinessService } from '../../../src/services/business.service';
import { sendMail } from '../../../src/services/mail.service';
import { publicPrisma } from '../../../src/config/database';
import {
  AlreadyExistsError,
  BadRequestError,
  EmailNotVerifiedError,
  VerificationLinkExpiredError,
  VerificationLinkInvalidError,
} from '../../../src/errors/api.errors';
import { EMAIL_VERIFICATION } from '../../../src/constants/emailVerification.constants';

jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/repositories/business.repo');
jest.mock('../../../src/repositories/refreshToken.repo');
jest.mock('../../../src/repositories/emailVerificationToken.repo');
jest.mock('../../../src/services/business.service');
jest.mock('../../../src/services/mail.service');
jest.mock('../../../src/config/database', () => ({
  publicPrisma: { user: { findMany: jest.fn() } },
  prisma: {},
}));

const businessDto = { instituteName: 'Test Institute', slug: 'test-institute' };
const pendingBusiness = { instituteName: 'Test Institute', slug: 'test-institute', logo: null };
const createdBusiness = { id: 7, slug: 'test-institute', schemaName: 'test_institute', instituteName: 'Test Institute' };

const signupData = {
  name: 'Owner',
  email: 'owner@test.com',
  password: 'password123',
  business: businessDto,
} as any;

const ownerRow = { id: 1, name: 'Owner', email: 'owner@test.com', role: UserRole.ADMIN, businessId: null };

function tokenRecord(overrides: Record<string, unknown> = {}) {
  return {
    userId: 1,
    expiresAt: new Date(Date.now() + 60_000),
    lastSentAt: new Date(),
    verifiedAt: null,
    pendingBusiness,
    user: { ...ownerRow, status: 'ACTIVE', emailVerified: false },
    ...overrides,
  };
}

describe('Email verification', () => {
  beforeEach(() => {
    (BusinessService.toCreateInput as jest.Mock).mockImplementation((dto: unknown) => ({ ...(dto as object), logo: null }));
    (BusinessService.checkSlugExists as jest.Mock).mockResolvedValue(false);
    (tokenRepo.upsertForUser as jest.Mock).mockResolvedValue({});
    (sendMail as jest.Mock).mockResolvedValue(undefined);
    (businessRepo.findBusinessById as jest.Mock).mockResolvedValue(null);
    (refreshTokenRepo.createRefreshToken as jest.Mock).mockResolvedValue({});
  });

  describe('AuthService.register (institute owner)', () => {
    it('creates an unverified owner, stores the pending business, sends the mail and issues no session', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);
      (userRepo.createUser as jest.Mock).mockResolvedValue(ownerRow);

      const result = await AuthService.register(signupData);

      expect(userRepo.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: UserRole.ADMIN, emailVerified: false }));
      expect(BusinessService.createBusiness).not.toHaveBeenCalled();
      expect(tokenRepo.upsertForUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, pendingBusiness: expect.objectContaining({ slug: 'test-institute' }) }),
      );
      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@test.com' }));
      expect(refreshTokenRepo.createRefreshToken).not.toHaveBeenCalled();
      expect(result).toEqual({ user: expect.objectContaining({ id: 1, email: 'owner@test.com' }), emailSent: true });
    });

    it('stores only a hash of the token and puts the raw token in the emailed link', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);
      (userRepo.createUser as jest.Mock).mockResolvedValue(ownerRow);

      await AuthService.register(signupData);

      const { tokenHash, expiresAt } = (tokenRepo.upsertForUser as jest.Mock).mock.calls[0][0];
      const html: string = (sendMail as jest.Mock).mock.calls[0][0].html;
      const rawToken = /verify-email\?token=([0-9a-f]+)/.exec(html)?.[1] ?? '';

      expect(rawToken).toHaveLength(EMAIL_VERIFICATION.TOKEN_BYTES * 2);
      expect(tokenHash).toBe(emailVerificationService.hashToken(rawToken));
      expect(tokenHash).not.toBe(rawToken);
      expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(EMAIL_VERIFICATION.LINK_EXPIRY_MS);
    });

    it('still succeeds with emailSent=false when the mail cannot be sent', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);
      (userRepo.createUser as jest.Mock).mockResolvedValue(ownerRow);
      (sendMail as jest.Mock).mockRejectedValue(new Error('gmail down'));

      const result = await AuthService.register(signupData);

      expect(result.emailSent).toBe(false);
    });

    it('rejects a signup without business details', async () => {
      await expect(AuthService.register({ ...signupData, business: undefined })).rejects.toBeInstanceOf(BadRequestError);
      expect(userRepo.createUser).not.toHaveBeenCalled();
    });

    it('rejects a slug that is already taken before creating anything', async () => {
      (BusinessService.checkSlugExists as jest.Mock).mockResolvedValue(true);

      await expect(AuthService.register(signupData)).rejects.toBeInstanceOf(AlreadyExistsError);
      expect(userRepo.createUser).not.toHaveBeenCalled();
    });

    it('rejects an email that already belongs to a verified account', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue({ ...ownerRow, emailVerified: true });

      await expect(AuthService.register(signupData)).rejects.toBeInstanceOf(AlreadyExistsError);
    });

    it('takes over an abandoned unverified signup instead of blocking the email', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue({ ...ownerRow, emailVerified: false });
      (userRepo.updateUser as jest.Mock).mockResolvedValue(ownerRow);

      const result = await AuthService.register(signupData);

      expect(userRepo.createUser).not.toHaveBeenCalled();
      expect(userRepo.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Owner' }));
      expect(result.emailSent).toBe(true);
    });
  });

  describe('AuthService.register (guest)', () => {
    it('creates an unverified guest and sends a mail without a session', async () => {
      (businessRepo.findBusinessBySlug as jest.Mock).mockResolvedValue({ id: 3, slug: 'vidit' });
      (businessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 3, instituteName: 'Vidit' });
      (userRepo.findByBusinessAndEmail as jest.Mock).mockResolvedValue(null);
      (userRepo.createUser as jest.Mock).mockResolvedValue({ id: 5, name: 'Guest', email: 'g@test.com', role: UserRole.USER, businessId: 3 });

      const result = await AuthService.register({ name: 'Guest', email: 'g@test.com', password: 'password123', slug: 'vidit' } as any);

      expect(userRepo.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: UserRole.USER, emailVerified: false }));
      // Guests have no pending business: the token row must not carry one
      expect(tokenRepo.upsertForUser).toHaveBeenCalledWith(expect.not.objectContaining({ pendingBusiness: expect.anything() }));
      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining('Vidit') }));
      expect(refreshTokenRepo.createRefreshToken).not.toHaveBeenCalled();
      expect(result.emailSent).toBe(true);
    });
  });

  describe('AuthService.verifyEmail', () => {
    it('rejects an unknown token', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(null);

      await expect(AuthService.verifyEmail('nope')).rejects.toBeInstanceOf(VerificationLinkInvalidError);
    });

    it('rejects an expired link and reports the email for the resend page', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(tokenRecord({ expiresAt: new Date(Date.now() - 1) }));

      await expect(AuthService.verifyEmail('old')).rejects.toMatchObject({
        constructor: VerificationLinkExpiredError,
        email: 'owner@test.com',
      });
      expect(BusinessService.createBusiness).not.toHaveBeenCalled();
      expect(userRepo.updateUser).not.toHaveBeenCalled();
    });

    it('creates the business, verifies the owner and logs them in on first use', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(tokenRecord());
      (BusinessService.createBusiness as jest.Mock).mockResolvedValue(createdBusiness);
      (userRepo.updateUser as jest.Mock).mockResolvedValue({});

      const result = await AuthService.verifyEmail('good');

      expect(BusinessService.createBusiness).toHaveBeenCalledWith(pendingBusiness, 1);
      expect(userRepo.updateUser).toHaveBeenCalledWith(1, { emailVerified: true });
      expect(tokenRepo.markVerified).toHaveBeenCalledWith(1);
      expect(result).toMatchObject({ verified: true, autoLogin: true, alreadyVerified: false, slug: 'test-institute' });
      expect(result.tokens).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    });

    it('does not mark the owner verified when the business cannot be created', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(tokenRecord());
      (BusinessService.createBusiness as jest.Mock).mockRejectedValue(new AlreadyExistsError("Business with slug 'test-institute' already exists"));

      await expect(AuthService.verifyEmail('good')).rejects.toBeInstanceOf(AlreadyExistsError);
      expect(userRepo.updateUser).not.toHaveBeenCalled();
      expect(tokenRepo.markVerified).not.toHaveBeenCalled();
    });

    it('reuses the business created by an earlier partially failed attempt', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(
        tokenRecord({ user: { ...ownerRow, businessId: 7, status: 'ACTIVE', emailVerified: false } }),
      );
      (businessRepo.findBusinessById as jest.Mock).mockResolvedValue(createdBusiness);
      (userRepo.updateUser as jest.Mock).mockResolvedValue({});

      const result = await AuthService.verifyEmail('good');

      expect(BusinessService.createBusiness).not.toHaveBeenCalled();
      expect(result.autoLogin).toBe(true);
    });

    it('only verifies a guest, without issuing a session', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(
        tokenRecord({
          pendingBusiness: null,
          user: { id: 5, name: 'Guest', email: 'g@test.com', role: UserRole.USER, businessId: 3, status: 'ACTIVE', emailVerified: false },
        }),
      );
      (businessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 3, slug: 'vidit', schemaName: 'vidit' });
      (userRepo.updateUser as jest.Mock).mockResolvedValue({});

      const result = await AuthService.verifyEmail('good');

      expect(result).toEqual({ verified: true, alreadyVerified: false, autoLogin: false, slug: 'vidit' });
      expect(refreshTokenRepo.createRefreshToken).not.toHaveBeenCalled();
    });

    it('never logs anyone in with a link that was already used', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(tokenRecord({ verifiedAt: new Date() }));

      const result = await AuthService.verifyEmail('used');

      expect(result).toMatchObject({ verified: true, alreadyVerified: true, autoLogin: false });
      expect(result.tokens).toBeUndefined();
      expect(BusinessService.createBusiness).not.toHaveBeenCalled();
      expect(refreshTokenRepo.createRefreshToken).not.toHaveBeenCalled();
    });

    it('treats an expired but already used link as already verified', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(
        tokenRecord({ verifiedAt: new Date(), expiresAt: new Date(Date.now() - 1) }),
      );

      const result = await AuthService.verifyEmail('used-and-old');

      expect(result.alreadyVerified).toBe(true);
    });
  });

  describe('AuthService.login (verification gate)', () => {
    const candidate = (emailVerified: boolean) => ({
      id: 1,
      email: 'owner@test.com',
      name: 'Owner',
      password: '$hashed',
      role: UserRole.ADMIN,
      status: 'ACTIVE',
      businessId: 7,
      emailVerified,
      business: { id: 7, slug: 'test-institute', schemaName: 'test_institute', status: 'ACTIVE', statusReason: null },
    });

    beforeEach(() => {
      jest.spyOn(AuthService, 'verifyPassword').mockResolvedValue(true);
      (refreshTokenRepo.findActiveTokenByUserId as jest.Mock).mockResolvedValue(null);
    });

    it('blocks an unverified account after the password matched, before any session is issued', async () => {
      (publicPrisma.user.findMany as jest.Mock).mockResolvedValue([candidate(false)]);

      await expect(AuthService.login({ email: 'owner@test.com', password: 'password123' } as any)).rejects.toMatchObject({
        constructor: EmailNotVerifiedError,
        email: 'owner@test.com',
      });
      expect(refreshTokenRepo.createRefreshToken).not.toHaveBeenCalled();
    });

    it('does not reveal verification state when the password is wrong', async () => {
      jest.spyOn(AuthService, 'verifyPassword').mockResolvedValue(false);
      (publicPrisma.user.findMany as jest.Mock).mockResolvedValue([candidate(false)]);

      const error = await AuthService.login({ email: 'owner@test.com', password: 'wrong' } as any).catch((e) => e);

      expect(error).not.toBeInstanceOf(EmailNotVerifiedError);
      expect(error.message).toBe('Invalid email or password');
    });

    it('lets a verified account log in', async () => {
      (publicPrisma.user.findMany as jest.Mock).mockResolvedValue([candidate(true)]);

      const result = await AuthService.login({ email: 'owner@test.com', password: 'password123' } as any);

      expect(result.user.email).toBe('owner@test.com');
    });
  });

  describe('resendVerificationEmail', () => {
    const unverified = { id: 1, name: 'Owner', email: 'owner@test.com', role: UserRole.ADMIN, businessId: null };

    it('sends nothing and reveals nothing for an unknown or already verified email', async () => {
      (userRepo.findUnverifiedByEmail as jest.Mock).mockResolvedValue([]);

      await expect(emailVerificationService.resendVerificationEmail('x@test.com')).resolves.toBeUndefined();
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('skips while the cooldown is active', async () => {
      (userRepo.findUnverifiedByEmail as jest.Mock).mockResolvedValue([unverified]);
      (tokenRepo.findByUserId as jest.Mock).mockResolvedValue({ lastSentAt: new Date(Date.now() - 10_000) });

      await emailVerificationService.resendVerificationEmail('owner@test.com');

      expect(sendMail).not.toHaveBeenCalled();
      expect(tokenRepo.upsertForUser).not.toHaveBeenCalled();
    });

    it('issues a fresh link after the cooldown and keeps the pending business', async () => {
      (userRepo.findUnverifiedByEmail as jest.Mock).mockResolvedValue([unverified]);
      (tokenRepo.findByUserId as jest.Mock).mockResolvedValue({
        lastSentAt: new Date(Date.now() - EMAIL_VERIFICATION.RESEND_COOLDOWN_MS - 1000),
      });

      await emailVerificationService.resendVerificationEmail('owner@test.com');

      expect(sendMail).toHaveBeenCalledTimes(1);
      // pendingBusiness is left untouched so the signup details survive the resend
      expect(tokenRepo.upsertForUser).toHaveBeenCalledWith(expect.not.objectContaining({ pendingBusiness: expect.anything() }));
    });

    it('skips an owner who has neither a stored signup nor a business', async () => {
      (userRepo.findUnverifiedByEmail as jest.Mock).mockResolvedValue([unverified]);
      (tokenRepo.findByUserId as jest.Mock).mockResolvedValue(null);

      await emailVerificationService.resendVerificationEmail('owner@test.com');

      expect(sendMail).not.toHaveBeenCalled();
    });
  });
});
