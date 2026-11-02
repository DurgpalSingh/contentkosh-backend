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
  ExpiredVerificationLinkError,
  InvalidVerificationLinkError,
  NotFoundError,
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

const institute = { instituteName: 'Test Institute', slug: 'test-institute' };
const pendingBusiness = { id: 7, ...institute, schemaName: 'test_institute', provisioningStatus: 'PENDING' };
const activeBusiness = { ...pendingBusiness, provisioningStatus: 'ACTIVE' };

const signupData = { name: 'Owner', email: 'owner@test.com', password: 'password123', business: institute } as any;

const ownerRow = { id: 1, name: 'Owner', email: 'owner@test.com', role: UserRole.ADMIN, businessId: null };

const ownerUser = { id: 1, name: 'Owner', email: 'owner@test.com', emailVerified: false };
const guestUser = { id: 5, name: 'Guest', email: 'g@test.com', emailVerified: false };
const vidit = { id: 3, slug: 'vidit', instituteName: 'Vidit', schemaName: 'vidit', provisioningStatus: 'ACTIVE' };

function verificationRecord(overrides: Record<string, unknown> = {}) {
  return { expiresAt: new Date(Date.now() + 60_000), business: pendingBusiness, user: ownerUser, ...overrides };
}

describe('Email verification', () => {
  beforeEach(() => {
    (BusinessService.createPendingBusiness as jest.Mock).mockResolvedValue(pendingBusiness);
    (tokenRepo.upsertForUser as jest.Mock).mockResolvedValue({});
    (sendMail as jest.Mock).mockResolvedValue(undefined);
    (refreshTokenRepo.createRefreshToken as jest.Mock).mockResolvedValue({});
  });

  describe('AuthService.register (institute owner)', () => {
    it('creates an unverified owner with a pending institute, sends the mail and issues no session', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);
      (userRepo.createUser as jest.Mock).mockResolvedValue(ownerRow);

      const result = await AuthService.register(signupData);

      expect(userRepo.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: UserRole.ADMIN, emailVerified: false }));
      expect(BusinessService.createPendingBusiness).toHaveBeenCalledWith(institute);
      expect(BusinessService.provisionBusiness).not.toHaveBeenCalled();
      expect(tokenRepo.upsertForUser).toHaveBeenCalledWith(1, expect.objectContaining({ businessId: 7 }));
      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@test.com' }));
      expect(refreshTokenRepo.createRefreshToken).not.toHaveBeenCalled();
      expect(result).toEqual({ user: expect.objectContaining({ id: 1, email: 'owner@test.com' }), emailSent: true });
    });

    it('does not leak the password hash in the response', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);
      (userRepo.createUser as jest.Mock).mockResolvedValue({ ...ownerRow, password: '$hashed' });

      const result = await AuthService.register(signupData);

      expect(result.user).not.toHaveProperty('password');
    });

    it('stores only a hash of the token and puts the raw token in the emailed link', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);
      (userRepo.createUser as jest.Mock).mockResolvedValue(ownerRow);

      await AuthService.register(signupData);

      const { tokenHash, expiresAt } = (tokenRepo.upsertForUser as jest.Mock).mock.calls[0][1];
      const html: string = (sendMail as jest.Mock).mock.calls[0][0].html;
      const rawToken = /verify-email\?token=([0-9a-f]+)/.exec(html)?.[1] ?? '';

      expect(rawToken).toHaveLength(EMAIL_VERIFICATION.TOKEN_BYTES * 2);
      expect(tokenHash).toBe(emailVerificationService.hashToken(rawToken));
      expect(tokenHash).not.toBe(rawToken);
      expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(EMAIL_VERIFICATION.TOKEN_TTL_MS);
    });

    it('still succeeds with emailSent=false when the mail cannot be sent', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);
      (userRepo.createUser as jest.Mock).mockResolvedValue(ownerRow);
      (sendMail as jest.Mock).mockRejectedValue(new Error('smtp down'));

      const result = await AuthService.register(signupData);

      expect(result.emailSent).toBe(false);
    });

    it('rejects a signup without institute details', async () => {
      await expect(AuthService.register({ ...signupData, business: undefined })).rejects.toBeInstanceOf(BadRequestError);
      expect(userRepo.createUser).not.toHaveBeenCalled();
    });

    it('rejects a slug that is already taken before creating the user', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);
      (BusinessService.createPendingBusiness as jest.Mock).mockRejectedValue(new AlreadyExistsError('slug taken'));

      await expect(AuthService.register(signupData)).rejects.toBeInstanceOf(AlreadyExistsError);
      expect(userRepo.createUser).not.toHaveBeenCalled();
    });

    it('rejects an email that already belongs to a verified account without touching any institute', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue({ ...ownerRow, emailVerified: true });

      await expect(AuthService.register(signupData)).rejects.toBeInstanceOf(AlreadyExistsError);
      expect(businessRepo.deletePendingBusinessOfUser).not.toHaveBeenCalled();
      expect(BusinessService.createPendingBusiness).not.toHaveBeenCalled();
    });

    it('takes over an abandoned unverified signup and discards its earlier pending institute', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue({ ...ownerRow, emailVerified: false });
      (userRepo.updateUser as jest.Mock).mockResolvedValue(ownerRow);

      const result = await AuthService.register(signupData);

      expect(businessRepo.deletePendingBusinessOfUser).toHaveBeenCalledWith(1);
      expect(userRepo.createUser).not.toHaveBeenCalled();
      expect(userRepo.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Owner' }));
      expect(result.emailSent).toBe(true);
    });
  });

  describe('AuthService.register (guest)', () => {
    it('creates an unverified guest and sends a mail without a session', async () => {
      (businessRepo.findBusinessBySlug as jest.Mock).mockResolvedValue(vidit);
      (userRepo.findByBusinessAndEmail as jest.Mock).mockResolvedValue(null);
      (userRepo.createUser as jest.Mock).mockResolvedValue({ id: 5, name: 'Guest', email: 'g@test.com', role: UserRole.USER, businessId: 3 });

      const result = await AuthService.register({ name: 'Guest', email: 'g@test.com', password: 'password123', slug: 'vidit' } as any);

      expect(userRepo.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: UserRole.USER, emailVerified: false }));
      expect(tokenRepo.upsertForUser).toHaveBeenCalledWith(5, expect.objectContaining({ businessId: 3 }));
      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining('Vidit') }));
      expect(refreshTokenRepo.createRefreshToken).not.toHaveBeenCalled();
      expect(result.emailSent).toBe(true);
    });

    it('cannot join an institute that is not provisioned yet', async () => {
      (businessRepo.findBusinessBySlug as jest.Mock).mockResolvedValue({ ...vidit, provisioningStatus: 'PENDING' });

      await expect(
        AuthService.register({ name: 'Guest', email: 'g@test.com', password: 'password123', slug: 'vidit' } as any),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(userRepo.createUser).not.toHaveBeenCalled();
    });
  });

  describe('AuthService.verifyEmail', () => {
    it('rejects an unknown token', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(null);

      await expect(AuthService.verifyEmail('nope')).rejects.toBeInstanceOf(InvalidVerificationLinkError);
    });

    it('rejects an expired link and reports the email for the resend page', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(verificationRecord({ expiresAt: new Date(Date.now() - 1) }));

      await expect(AuthService.verifyEmail('old')).rejects.toMatchObject({
        constructor: ExpiredVerificationLinkError,
        email: 'owner@test.com',
      });
      expect(BusinessService.provisionBusiness).not.toHaveBeenCalled();
      expect(userRepo.updateUser).not.toHaveBeenCalled();
    });

    it('provisions the pending institute, verifies the owner and logs them in on first use', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(verificationRecord());
      (BusinessService.provisionBusiness as jest.Mock).mockResolvedValue(activeBusiness);
      (userRepo.updateUser as jest.Mock).mockResolvedValue({});

      const result = await AuthService.verifyEmail('good');

      expect(BusinessService.provisionBusiness).toHaveBeenCalledWith(pendingBusiness, 1);
      expect(userRepo.updateUser).toHaveBeenCalledWith(1, { emailVerified: true });
      expect(result).toMatchObject({ alreadyVerified: false, slug: 'test-institute' });
      expect(result.tokens).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    });

    it('does not mark the owner verified when the institute cannot be provisioned', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(verificationRecord());
      (BusinessService.provisionBusiness as jest.Mock).mockRejectedValue(new Error('schema failed'));

      await expect(AuthService.verifyEmail('good')).rejects.toThrow('schema failed');
      expect(userRepo.updateUser).not.toHaveBeenCalled();
    });

    it('does not provision again when an earlier attempt already activated the institute', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(verificationRecord({ business: activeBusiness }));
      (userRepo.updateUser as jest.Mock).mockResolvedValue({});

      const result = await AuthService.verifyEmail('good');

      expect(BusinessService.provisionBusiness).not.toHaveBeenCalled();
      expect(userRepo.updateUser).toHaveBeenCalledWith(1, { emailVerified: true });
      expect(result.tokens).toBeUndefined();
    });

    it('only verifies a guest, without issuing a session', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(verificationRecord({ business: vidit, user: guestUser }));
      (userRepo.updateUser as jest.Mock).mockResolvedValue({});

      const result = await AuthService.verifyEmail('good');

      expect(result).toEqual({ alreadyVerified: false, slug: 'vidit' });
      expect(userRepo.updateUser).toHaveBeenCalledWith(5, { emailVerified: true });
      expect(BusinessService.provisionBusiness).not.toHaveBeenCalled();
      expect(refreshTokenRepo.createRefreshToken).not.toHaveBeenCalled();
    });

    it('never logs anyone in with a link that was already used', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(
        verificationRecord({ business: activeBusiness, user: { ...ownerUser, emailVerified: true } }),
      );

      const result = await AuthService.verifyEmail('used');

      expect(result).toEqual({ alreadyVerified: true, slug: 'test-institute' });
      expect(BusinessService.provisionBusiness).not.toHaveBeenCalled();
      expect(refreshTokenRepo.createRefreshToken).not.toHaveBeenCalled();
    });

    it('treats an expired but already used link as already verified', async () => {
      (tokenRepo.findByTokenHash as jest.Mock).mockResolvedValue(
        verificationRecord({ expiresAt: new Date(Date.now() - 1), user: { ...ownerUser, emailVerified: true } }),
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
    const pending = (sentMsAgo: number, business = pendingBusiness) => ({
      expiresAt: new Date(Date.now() - sentMsAgo + EMAIL_VERIFICATION.TOKEN_TTL_MS),
      business,
      user: { id: 1, name: 'Owner', email: 'owner@test.com' },
    });
    const afterCooldown = EMAIL_VERIFICATION.RESEND_COOLDOWN_MS + 1000;

    it('sends nothing and reveals nothing for an unknown or already verified email', async () => {
      (tokenRepo.findUnverifiedByEmail as jest.Mock).mockResolvedValue([]);

      await expect(emailVerificationService.resendVerificationEmail('x@test.com')).resolves.toBeUndefined();
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('skips while the cooldown is active', async () => {
      (tokenRepo.findUnverifiedByEmail as jest.Mock).mockResolvedValue([pending(10_000)]);

      await emailVerificationService.resendVerificationEmail('owner@test.com');

      expect(sendMail).not.toHaveBeenCalled();
      expect(tokenRepo.upsertForUser).not.toHaveBeenCalled();
    });

    it('issues a fresh link for the same institute after the cooldown', async () => {
      (tokenRepo.findUnverifiedByEmail as jest.Mock).mockResolvedValue([pending(afterCooldown)]);

      await emailVerificationService.resendVerificationEmail('owner@test.com');

      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining('Test Institute') }));
      expect(tokenRepo.upsertForUser).toHaveBeenCalledWith(1, expect.objectContaining({ businessId: 7 }));
    });
  });
});
