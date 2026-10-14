import { UserRole } from '@prisma/client';
import { editorImageService } from '../../../src/services/editorImage.service';
import { BadRequestError } from '../../../src/errors/api.errors';

const teacherInBusiness1 = { id: 5, email: 't@x.com', role: UserRole.TEACHER, businessId: 1 };
const superAdmin = { id: 99, email: 's@x.com', role: UserRole.SUPERADMIN };

describe('EditorImageService.deleteImage', () => {
  it("refuses to delete another business's image, by path or by absolute URL", async () => {
    await expect(editorImageService.deleteImage('/uploads/editor/2/editor-1.webp', teacherInBusiness1)).rejects.toThrow(BadRequestError);
    await expect(
      editorImageService.deleteImage('https://api.contentkosh.in/uploads/editor/2/editor-1.webp', teacherInBusiness1),
    ).rejects.toThrow(BadRequestError);
  });

  it('refuses paths outside the editor folder', async () => {
    await expect(editorImageService.deleteImage('/uploads/content/file-1.pdf', teacherInBusiness1)).rejects.toThrow('Invalid file path');
    await expect(editorImageService.deleteImage('/uploads/editor/../../.env', teacherInBusiness1)).rejects.toThrow('Invalid file path');
  });

  it('answers a malformed url with 400 instead of crashing', async () => {
    await expect(editorImageService.deleteImage('/uploads/editor/1/%E0%A4%A.webp', teacherInBusiness1)).rejects.toThrow(BadRequestError);
    await expect(editorImageService.deleteImage('http://[bad-host/uploads/editor/1/x.webp', teacherInBusiness1)).rejects.toThrow(
      BadRequestError,
    );
    await expect(editorImageService.deleteImage('', teacherInBusiness1)).rejects.toThrow('url is required');
  });

  it('allows own-business, legacy flat and super admin deletes (missing files are a no-op)', async () => {
    await expect(
      editorImageService.deleteImage('http://localhost:8080/uploads/editor/1/missing.webp', teacherInBusiness1),
    ).resolves.toBeUndefined();
    await expect(editorImageService.deleteImage('/uploads/editor/legacy-missing.webp', teacherInBusiness1)).resolves.toBeUndefined();
    await expect(editorImageService.deleteImage('/uploads/editor/2/missing.webp', superAdmin)).resolves.toBeUndefined();
  });
});
