import { ContentType, UserRole } from '@prisma/client';
import { AiKnowledgeBaseService } from '../../../src/services/aiKnowledgeBase.service';
import * as batchRepo from '../../../src/repositories/batch.repo';
import { promises as fs } from 'fs';

jest.mock('../../../src/repositories/batch.repo');
jest.mock('../../../src/utils/logger');

describe('AiKnowledgeBaseService', () => {
  const agentClient = {
    postJson: jest.fn(),
    postForm: jest.fn(),
    postEmpty: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('pdf'));
  });

  it('uploads only PDF content to the agent with course_ids/subject_ids as array fields', async () => {
    agentClient.postForm.mockResolvedValue({ message: 'uploaded' });
    const service = new AiKnowledgeBaseService(agentClient as any, agentClient as any);

    await service.uploadPdfToKnowledgeBase({
      filePath: 'uploads/content/file.pdf',
      businessId: 1,
      courseId: 2,
      subjectId: 3,
      contentType: ContentType.PDF,
    });

    expect(agentClient.postForm).toHaveBeenCalledWith('/llm/upload', expect.any(FormData));
    const formData = agentClient.postForm.mock.calls[0][1] as FormData;
    expect(formData.get('business_id')).toBe('1');
    expect(formData.get('course_ids')).toBe('2');
    expect(formData.get('subject_ids')).toBe('3');
    expect(formData.get('course_id')).toBeNull();

    await service.uploadPdfToKnowledgeBase({
      filePath: 'uploads/content/file.docx',
      businessId: 1,
      courseId: 2,
      subjectId: 3,
      contentType: ContentType.DOC,
    });

    expect(agentClient.postForm).toHaveBeenCalledTimes(1);
  });

  it('skips the agent upload when the content has no subject assigned', async () => {
    const service = new AiKnowledgeBaseService(agentClient as any, agentClient as any);

    const result = await service.uploadPdfToKnowledgeBase({
      filePath: 'uploads/content/file.pdf',
      businessId: 1,
      courseId: 2,
      contentType: ContentType.PDF,
    });

    expect(result).toBeNull();
    expect(agentClient.postForm).not.toHaveBeenCalled();
  });

  it('rejects a student who is not enrolled in any course', async () => {
    (batchRepo.findUserBatchAndCourseMembership as jest.Mock).mockResolvedValue({
      batchIds: [],
      courseIds: [],
    });
    const service = new AiKnowledgeBaseService(agentClient as any, agentClient as any);

    await expect(
      service.queryKnowledgeBase({
        businessId: 1,
        query: 'Explain this',
        jobId: 'job-1',
        user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'You must be enrolled in a course to use Contentkosh AI',
    });

    expect(agentClient.postJson).not.toHaveBeenCalled();
  });

  it('queries the agent with the job id and all enrolled course IDs for enrolled students', async () => {
    (batchRepo.findUserBatchAndCourseMembership as jest.Mock).mockResolvedValue({
      batchIds: [1, 2],
      courseIds: [2, 5],
    });
    agentClient.postJson.mockResolvedValue({ answer: 'Answer' });
    const service = new AiKnowledgeBaseService(agentClient as any, agentClient as any);

    const result = await service.queryKnowledgeBase({
      businessId: 1,
      query: 'Explain this',
      jobId: 'job-1',
      user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
    });

    expect(result).toEqual({ answer: 'Answer' });
    expect(agentClient.postJson).toHaveBeenCalledWith('/llm/kb/query', {
      job_id: 'job-1',
      business_id: '1',
      course_ids: ['2', '5'],
      query: 'Explain this',
    });
  });

  describe('stopQuery', () => {
    it('asks the agent to stop the given job', async () => {
      agentClient.postEmpty.mockResolvedValue({ job_id: 'job-1', status: 'cancelled' });
      const service = new AiKnowledgeBaseService(agentClient as any, agentClient as any);

      await service.stopQuery('job-1');

      expect(agentClient.postEmpty).toHaveBeenCalledWith('/query/job-1/stop');
    });

    it('never throws, even if the agent call fails', async () => {
      agentClient.postEmpty.mockRejectedValue(new Error('agent unreachable'));
      const service = new AiKnowledgeBaseService(agentClient as any, agentClient as any);

      await expect(service.stopQuery('job-1')).resolves.toBeUndefined();
    });
  });
});
