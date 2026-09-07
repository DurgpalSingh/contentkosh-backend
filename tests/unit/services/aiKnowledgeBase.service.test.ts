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

  it('uploads only PDF content to the agent with course_ids as an array field', async () => {
    agentClient.postForm.mockResolvedValue({ message: 'uploaded' });
    const service = new AiKnowledgeBaseService(agentClient as any);

    await service.uploadPdfToKnowledgeBase({
      filePath: 'uploads/content/file.pdf',
      businessId: 1,
      courseId: 2,
      contentType: ContentType.PDF,
    });

    expect(agentClient.postForm).toHaveBeenCalledWith('/llm/upload', expect.any(FormData));
    const formData = agentClient.postForm.mock.calls[0][1] as FormData;
    expect(formData.get('business_id')).toBe('1');
    expect(formData.get('course_ids')).toBe('2');
    expect(formData.get('course_id')).toBeNull();

    await service.uploadPdfToKnowledgeBase({
      filePath: 'uploads/content/file.docx',
      businessId: 1,
      courseId: 2,
      contentType: ContentType.DOC,
    });

    expect(agentClient.postForm).toHaveBeenCalledTimes(1);
  });

  it('rejects a student who is not enrolled in any course', async () => {
    (batchRepo.findUserBatchAndCourseMembership as jest.Mock).mockResolvedValue({
      batchIds: [],
      courseIds: [],
    });
    const service = new AiKnowledgeBaseService(agentClient as any);

    await expect(
      service.queryKnowledgeBase({
        businessId: 1,
        query: 'Explain this',
        user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'You must be enrolled in a course to use Contentkosh AI',
    });

    expect(agentClient.postJson).not.toHaveBeenCalled();
  });

  it('queries the agent with all enrolled course IDs for enrolled students', async () => {
    (batchRepo.findUserBatchAndCourseMembership as jest.Mock).mockResolvedValue({
      batchIds: [1, 2],
      courseIds: [2, 5],
    });
    agentClient.postJson.mockResolvedValue({ answer: 'Answer' });
    const service = new AiKnowledgeBaseService(agentClient as any);

    const result = await service.queryKnowledgeBase({
      businessId: 1,
      query: 'Explain this',
      user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
    });

    expect(result).toEqual({ answer: 'Answer' });
    expect(agentClient.postJson).toHaveBeenCalledWith('/llm/kb/query', {
      business_id: '1',
      course_ids: ['2', '5'],
      query: 'Explain this',
    });
  });
});
