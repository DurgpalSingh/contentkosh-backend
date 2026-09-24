import { ContentAgentUploadStatus, ContentStatus, ContentType, UserRole } from '@prisma/client';
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

  it('creates PDF content immediately and starts agent processing in the background', async () => {
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

    expect(contentRepo.createContent).toHaveBeenCalled();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(aiKnowledgeBaseService.uploadPdfToKnowledgeBase).toHaveBeenCalledWith({
      filePath: 'uploads/content/file.pdf',
      businessId: 1,
      courseId: 4,
      contentType: ContentType.PDF,
    });
    expect(contentRepo.updateAgentUploadStatus).toHaveBeenCalledWith(
      20,
      1,
      ContentAgentUploadStatus.SUCCEEDED,
    );
  });

  it('keeps content created and records a failed agent job when agent upload fails', async () => {
    aiKnowledgeBaseService.uploadPdfToKnowledgeBase.mockRejectedValue(new Error('agent down'));
    const service = new ContentService(aiKnowledgeBaseService as any);

    await service.createContent(3, {
      title: 'PDF',
      type: ContentType.PDF,
      filePath: 'uploads/content/file.pdf',
      fileSize: 100,
    }, user);

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(contentRepo.createContent).toHaveBeenCalled();
    expect(contentRepo.updateAgentUploadStatus).toHaveBeenCalledWith(
      20,
      1,
      ContentAgentUploadStatus.FAILED,
      'agent down',
    );
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('keeps non-PDF uploads on the normal content path', async () => {
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

    expect(aiKnowledgeBaseService.uploadPdfToKnowledgeBase).not.toHaveBeenCalled();
    expect(contentRepo.createContent).toHaveBeenCalled();
  });
});
