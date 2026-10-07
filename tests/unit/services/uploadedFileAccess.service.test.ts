import { UserRole } from '@prisma/client';
import { canViewUploadedFile } from '../../../src/services/uploadedFileAccess.service';
import * as userRepo from '../../../src/repositories/user.repo';
import * as businessRepo from '../../../src/repositories/business.repo';
import * as courseRepo from '../../../src/repositories/course.repo';
import * as testQuestionRepo from '../../../src/repositories/testQuestion.repo';

jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/repositories/business.repo');
jest.mock('../../../src/repositories/course.repo');
jest.mock('../../../src/repositories/testQuestion.repo');

const viewerInBusiness1 = { id: 5, email: 'a@x.com', role: UserRole.TEACHER, businessId: 1 };
const superAdmin = { id: 99, email: 's@x.com', role: UserRole.SUPERADMIN };

describe('canViewUploadedFile', () => {
  it('never serves content files directly (only via the content API)', async () => {
    expect(await canViewUploadedFile(viewerInBusiness1, '/content/file-1.pdf')).toBe(false);
  });

  it('allows profile pictures of the same business and blocks other businesses', async () => {
    (userRepo.findProfilePictureOwner as jest.Mock).mockResolvedValueOnce({ id: 7, businessId: 1 });
    expect(await canViewUploadedFile(viewerInBusiness1, '/profile/p.png')).toBe(true);
    expect(userRepo.findProfilePictureOwner).toHaveBeenCalledWith('/uploads/profile/p.png');

    (userRepo.findProfilePictureOwner as jest.Mock).mockResolvedValueOnce({ id: 8, businessId: 2 });
    expect(await canViewUploadedFile(viewerInBusiness1, '/profile/p.png')).toBe(false);
  });

  it('allows only the business that owns a logo', async () => {
    (businessRepo.findBusinessByLogoPath as jest.Mock).mockResolvedValueOnce({ id: 1 });
    expect(await canViewUploadedFile(viewerInBusiness1, '/business/logo.png')).toBe(true);
    (businessRepo.findBusinessByLogoPath as jest.Mock).mockResolvedValueOnce({ id: 2 });
    expect(await canViewUploadedFile(viewerInBusiness1, '/business/logo.png')).toBe(false);
  });

  it('allows course thumbnails and question media found in the viewer tenant', async () => {
    (courseRepo.findCourseByThumbnailPath as jest.Mock).mockResolvedValueOnce({ id: 3 });
    expect(await canViewUploadedFile(viewerInBusiness1, '/courses/t.png')).toBe(true);
    (testQuestionRepo.findQuestionMediaReference as jest.Mock).mockResolvedValueOnce(null);
    expect(await canViewUploadedFile(viewerInBusiness1, '/questions/q.png')).toBe(false);
  });

  it('scopes new editor images to their business folder and keeps old flat ones readable', async () => {
    expect(await canViewUploadedFile(viewerInBusiness1, '/editor/1/editor-1.webp')).toBe(true);
    expect(await canViewUploadedFile(viewerInBusiness1, '/editor/2/editor-1.webp')).toBe(false);
    expect(await canViewUploadedFile(viewerInBusiness1, '/editor/editor-legacy.webp')).toBe(true);
  });

  it('rejects traversal attempts and unknown folders', async () => {
    expect(await canViewUploadedFile(viewerInBusiness1, '/editor/../../.env')).toBe(false);
    expect(await canViewUploadedFile(viewerInBusiness1, '/editor/%2e%2e/secret')).toBe(false);
    expect(await canViewUploadedFile(viewerInBusiness1, '/bulk-upload/x.docx')).toBe(false);
  });

  it('lets a super admin view any business file but still not content files', async () => {
    expect(await canViewUploadedFile(superAdmin, '/business/other-logo.png')).toBe(true);
    expect(await canViewUploadedFile(superAdmin, '/content/file-1.pdf')).toBe(false);
  });
});
