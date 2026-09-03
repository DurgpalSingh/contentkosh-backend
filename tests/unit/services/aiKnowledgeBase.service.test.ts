import { ContentType, UserRole } from '@prisma/client';
import { AiKnowledgeBaseService } from '../../../src/services/aiKnowledgeBase.service';
import * as batchRepo from '../../../src/repositories/batch.repo';
import { promises as fs } from 'fs';

jest.mock('../../../src/repositories/batch.repo');

describe('AiKnowledgeBaseService', () => {
  const agentClient = {
    postJson: jest.fn(),
    postForm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('pdf'));
  });

  it('uploads only PDF content to the agent', async () => {
    agentClient.postForm.mockResolvedValue({ message: 'uploaded' });
    const service = new AiKnowledgeBaseService(agentClient as any);

    await service.uploadPdfToKnowledgeBase({
      filePath: 'uploads/content/file.pdf',
      businessId: 1,
      courseId: 2,
      contentType: ContentType.PDF,
    });

    expect(agentClient.postForm).toHaveBeenCalledWith('/llm/upload', expect.any(FormData));

    await service.uploadPdfToKnowledgeBase({
      filePath: 'uploads/content/file.docx',
      businessId: 1,
      courseId: 2,
      contentType: ContentType.DOC,
    });

    expect(agentClient.postForm).toHaveBeenCalledTimes(1);
  });

  it('rejects a student who is not enrolled in the requested course', async () => {
    (batchRepo.isActiveUserInCourse as jest.Mock).mockResolvedValue(false);
    const service = new AiKnowledgeBaseService(agentClient as any);

    await expect(
      service.queryKnowledgeBase({
        businessId: 1,
        courseId: 9,
        query: 'Explain this',
        user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'You must be enrolled in this course to use Contentkosh AI',
    });

    expect(agentClient.postJson).not.toHaveBeenCalled();
  });

  it('queries the agent for enrolled students', async () => {
    (batchRepo.isActiveUserInCourse as jest.Mock).mockResolvedValue(true);
    agentClient.postJson.mockResolvedValue({ answer: 'Answer' });
    const service = new AiKnowledgeBaseService(agentClient as any);

    const result = await service.queryKnowledgeBase({
      businessId: 1,
      courseId: 2,
      query: 'Explain this',
      user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
    });

    expect(result).toEqual({ answer: 'Answer' });
    expect(agentClient.postJson).toHaveBeenCalledWith('/llm/kb/query', {
      business_id: '1',
      course_id: '2',
      query: 'Explain this',
    });
  });
});
