import { UserRole } from '@prisma/client';
import { editorImageService } from '../../../src/services/editorImage.service';
import { BadRequestError } from '../../../src/errors/api.errors';

const teacherInBusiness1 = { id: 5, email: 't@x.com', role: UserRole.TEACHER, businessId: 1 };
const superAdmin = { id: 99, email: 's@x.com', role: UserRole.SUPERADMIN };

describe('EditorImageService.deleteImage', () => {
  it("refuses to delete another business's image, by path or by absolute URL", () => {
    expect(() => editorImageService.deleteImage('/uploads/editor/2/editor-1.webp', teacherInBusiness1)).toThrow(BadRequestError);
    expect(() =>
      editorImageService.deleteImage('https://api.contentkosh.in/uploads/editor/2/editor-1.webp', teacherInBusiness1),
    ).toThrow(BadRequestError);
  });

  it('refuses paths outside the editor folder', () => {
    expect(() => editorImageService.deleteImage('/uploads/content/file-1.pdf', teacherInBusiness1)).toThrow('Invalid file path');
    expect(() => editorImageService.deleteImage('/uploads/editor/../../.env', teacherInBusiness1)).toThrow('Invalid file path');
  });

  it('allows own-business, legacy flat and super admin deletes (missing files are a no-op)', () => {
    expect(() => editorImageService.deleteImage('http://localhost:8080/uploads/editor/1/missing.webp', teacherInBusiness1)).not.toThrow();
    expect(() => editorImageService.deleteImage('/uploads/editor/legacy-missing.webp', teacherInBusiness1)).not.toThrow();
    expect(() => editorImageService.deleteImage('/uploads/editor/2/missing.webp', superAdmin)).not.toThrow();
  });
});
