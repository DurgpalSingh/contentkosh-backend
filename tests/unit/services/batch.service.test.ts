import { UserRole } from '@prisma/client';
import { BatchService } from '../../../src/services/batch.service';
import * as batchRepo from '../../../src/repositories/batch.repo';
import { ForbiddenError, NotFoundError } from '../../../src/errors/api.errors';
import { IUser } from '../../../src/dtos/auth.dto';

jest.mock('../../../src/repositories/batch.repo');
jest.mock('../../../src/utils/logger');

function buildUser(overrides: Partial<IUser> = {}): IUser {
    return {
        id: 5,
        email: 'guest@example.com',
        role: UserRole.USER,
        businessId: 1,
        businessSlug: 'acme',
        tenantSchema: 'tenant_acme',
        ...overrides,
    } as IUser;
}

const batchWithExam = {
    id: 10,
    course: { exam: { businessId: 1 } },
};

describe('BatchService', () => {
    let batchService: BatchService;

    beforeEach(() => {
        jest.clearAllMocks();
        batchService = new BatchService();
    });

    describe('validateBatchAccess', () => {
        it('throws NotFoundError if the batch does not exist', async () => {
            (batchRepo.findBatchById as jest.Mock).mockResolvedValue(null);

            await expect(batchService.validateBatchAccess(10, buildUser())).rejects.toThrow(NotFoundError);
        });

        it('throws ForbiddenError if the batch belongs to a different business', async () => {
            (batchRepo.findBatchById as jest.Mock).mockResolvedValue(batchWithExam);

            await expect(
                batchService.validateBatchAccess(10, buildUser({ businessId: 2 })),
            ).rejects.toThrow(ForbiddenError);
        });

        it('blocks a guest (USER) who is not enrolled in the batch', async () => {
            (batchRepo.findBatchById as jest.Mock).mockResolvedValue(batchWithExam);
            (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(false);

            await expect(
                batchService.validateBatchAccess(10, buildUser({ role: UserRole.USER })),
            ).rejects.toThrow(ForbiddenError);
            expect(batchRepo.isActiveUserInBatch).toHaveBeenCalledWith(5, 10);
        });

        it('blocks a STUDENT who is not enrolled in this specific batch', async () => {
            (batchRepo.findBatchById as jest.Mock).mockResolvedValue(batchWithExam);
            (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(false);

            await expect(
                batchService.validateBatchAccess(10, buildUser({ role: UserRole.STUDENT })),
            ).rejects.toThrow(ForbiddenError);
        });

        it('allows a STUDENT who is actively enrolled in the batch', async () => {
            (batchRepo.findBatchById as jest.Mock).mockResolvedValue(batchWithExam);
            (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);

            await expect(
                batchService.validateBatchAccess(10, buildUser({ role: UserRole.STUDENT })),
            ).resolves.toBeUndefined();
        });

        it('allows ADMIN without checking batch membership', async () => {
            (batchRepo.findBatchById as jest.Mock).mockResolvedValue(batchWithExam);

            await expect(
                batchService.validateBatchAccess(10, buildUser({ role: UserRole.ADMIN })),
            ).resolves.toBeUndefined();
            expect(batchRepo.isActiveUserInBatch).not.toHaveBeenCalled();
        });

        it('allows SUPERADMIN across businesses without checking batch membership', async () => {
            (batchRepo.findBatchById as jest.Mock).mockResolvedValue(batchWithExam);

            await expect(
                batchService.validateBatchAccess(10, buildUser({ role: UserRole.SUPERADMIN, businessId: 999 })),
            ).resolves.toBeUndefined();
            expect(batchRepo.isActiveUserInBatch).not.toHaveBeenCalled();
        });
    });

    describe('getUsersByBatch', () => {
        const mockUsers = [
            { id: 1, userId: 100, batchId: 10, isActive: true, user: { id: 100, name: 'Jane', email: 'jane@example.com', role: 'STUDENT' } },
        ];

        it('strips email for a STUDENT caller', async () => {
            (batchRepo.findUsersByBatchId as jest.Mock).mockResolvedValue(mockUsers);

            const result = await batchService.getUsersByBatch(10, buildUser({ role: UserRole.STUDENT }));

            expect(result[0].user).not.toHaveProperty('email');
            expect(result[0].user).toMatchObject({ id: 100, name: 'Jane' });
        });

        it('strips email for a USER (guest) caller', async () => {
            (batchRepo.findUsersByBatchId as jest.Mock).mockResolvedValue(mockUsers);

            const result = await batchService.getUsersByBatch(10, buildUser({ role: UserRole.USER }));

            expect(result[0].user).not.toHaveProperty('email');
        });

        it('keeps email for an ADMIN caller', async () => {
            (batchRepo.findUsersByBatchId as jest.Mock).mockResolvedValue(mockUsers);

            const result = await batchService.getUsersByBatch(10, buildUser({ role: UserRole.ADMIN }));

            expect(result[0].user).toHaveProperty('email', 'jane@example.com');
        });

        it('keeps email for a TEACHER caller', async () => {
            (batchRepo.findUsersByBatchId as jest.Mock).mockResolvedValue(mockUsers);

            const result = await batchService.getUsersByBatch(10, buildUser({ role: UserRole.TEACHER }));

            expect(result[0].user).toHaveProperty('email', 'jane@example.com');
        });

        it('keeps email for a SUPERADMIN caller', async () => {
            (batchRepo.findUsersByBatchId as jest.Mock).mockResolvedValue(mockUsers);

            const result = await batchService.getUsersByBatch(10, buildUser({ role: UserRole.SUPERADMIN }));

            expect(result[0].user).toHaveProperty('email', 'jane@example.com');
        });
    });
});
