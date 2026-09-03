import { ContentStatus, ContentType, UserRole } from '@prisma/client';
import { ContentService } from '../../../src/services/content.service';
import * as batchRepo from '../../../src/repositories/batch.repo';
import * as contentRepo from '../../../src/repositories/content.repo';
import { promises as fs } from 'fs';

jest.mock('../../../src/repositories/batch.repo');
jest.mock('../../../src/repositories/content.repo');

describe('ContentService AI ingestion', () => {
  const aiKnowledgeBaseService = {
    uploadPdfToKnowledgeBase: jest.fn(),
  };

  const user = {
    id: 10,
    email: 'teacher@test.com',
    role: UserRole.TEACHER,
    businessId: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);
    (batchRepo.findBatchById as jest.Mock).mockResolvedValue({
      id: 3,
      courseId: 4,
      course: { exam: { businessId: 1 } },
    });
    (contentRepo.createContent as jest.Mock).mockResolvedValue({
      id: 20,
      title: 'PDF',
      type: ContentType.PDF,
      filePath: 'uploads/content/file.pdf',
      fileSize: 100,
      status: ContentStatus.ACTIVE,
      batchId: 3,
      uploadedBy: 10,
    });
  });

  it('calls the agent before creating PDF content', async () => {
    aiKnowledgeBaseService.uploadPdfToKnowledgeBase.mockResolvedValue({ message: 'uploaded' });
    const service = new ContentService(aiKnowledgeBaseService as any);

    await service.createContent(
      3,
      {
        title: 'PDF',
        type: ContentType.PDF,
        filePath: 'uploads/content/file.pdf',
        fileSize: 100,
      },
      user,
    );

    expect(aiKnowledgeBaseService.uploadPdfToKnowledgeBase).toHaveBeenCalledWith({
      filePath: 'uploads/content/file.pdf',
      businessId: 1,
      courseId: 4,
      contentType: ContentType.PDF,
    });
    expect(contentRepo.createContent).toHaveBeenCalled();
  });

  it('does not create content and removes the local file when PDF agent upload fails', async () => {
    aiKnowledgeBaseService.uploadPdfToKnowledgeBase.mockRejectedValue(new Error('agent down'));
    const service = new ContentService(aiKnowledgeBaseService as any);

    await expect(
      service.createContent(
        3,
        {
          title: 'PDF',
          type: ContentType.PDF,
          filePath: 'uploads/content/file.pdf',
          fileSize: 100,
        },
        user,
      ),
    ).rejects.toThrow('agent down');

    expect(contentRepo.createContent).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalledWith('uploads/content/file.pdf');
  });

  it('keeps non-PDF uploads on the normal content path', async () => {
    aiKnowledgeBaseService.uploadPdfToKnowledgeBase.mockResolvedValue(null);
    const service = new ContentService(aiKnowledgeBaseService as any);

    await service.createContent(
      3,
      {
        title: 'Doc',
        type: ContentType.DOC,
        filePath: 'uploads/content/file.docx',
        fileSize: 100,
      },
      user,
    );

    expect(aiKnowledgeBaseService.uploadPdfToKnowledgeBase).toHaveBeenCalledWith({
      filePath: 'uploads/content/file.docx',
      businessId: 1,
      courseId: 4,
      contentType: ContentType.DOC,
    });
    expect(contentRepo.createContent).toHaveBeenCalled();
  });
});
