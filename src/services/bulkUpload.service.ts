import crypto from 'crypto';
import { prisma } from '../config/database';
import { ParsedQuestion, PreviewResponse } from '../dtos/bulkUpload.dto';
import { ApiError, NotFoundError } from '../errors/api.errors';
import { QuestionType } from '../constants/test-enums';
import { DocParserService } from './docParser.service';
import { ExcelParserService } from './excelParser.service';
import { QuestionValidatorService } from './questionValidator.service';
import { bulkUploadSessionStore } from '../utils/bulkUploadSession.store';
import { sanitizeRequiredQuillHtml, sanitizeOptionalQuillHtml } from '../utils/sanitizeHtml';
import logger from '../utils/logger';

const CHOICE_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'];
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const TYPE_MAP: Record<string, number> = {
  SINGLE_CHOICE: QuestionType.SINGLE_CHOICE,
  MULTIPLE_CHOICE: QuestionType.MULTIPLE_CHOICE,
  TRUE_FALSE: QuestionType.TRUE_FALSE,
  NUMERICAL: QuestionType.NUMERICAL,
  FILL_IN_THE_BLANK: QuestionType.FILL_IN_THE_BLANK,
};

export class BulkUploadService {
  private docParser = new DocParserService();
  private excelParser = new ExcelParserService();
  private validator = new QuestionValidatorService();

  async parseAndPreview(
    fileBuffer: Buffer,
    fileMime: string | undefined,
    originalName: string | undefined,
    testId: string,
    testType: 'practice' | 'exam',
  ): Promise<PreviewResponse> {
    logger.info(`BulkUploadService.parseAndPreview: testId=${testId}, testType=${testType}`);

    // Choose parser based on MIME type or file extension
    const mime = (fileMime || '').toLowerCase();
    const name = (originalName || '').toLowerCase();
    let questions: ParsedQuestion[] = [];

    if (mime.includes('spreadsheet') || mime.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx')) {
      questions = await this.excelParser.parse(fileBuffer);
    } else {
      questions = await this.docParser.parse(fileBuffer);
    }

    if (questions.length === 0) {
      throw new ApiError('No question blocks found in the document', 422);
    }

    const { valid, invalid } = this.validator.validate(questions);

    const sessionToken = crypto.randomUUID();
    bulkUploadSessionStore.set(sessionToken, { validQuestions: valid, testId, testType });

    logger.info(
      `BulkUploadService.parseAndPreview: valid=${valid.length}, invalid=${invalid.length}, token=${sessionToken}`,
    );

    return { validQuestions: valid, invalidQuestions: invalid, sessionToken };
  }

  async confirm(
    sessionToken: string,
    testId: string,
    testType: 'practice' | 'exam',
  ): Promise<{ savedCount: number }> {
    logger.info(`BulkUploadService.confirm: testId=${testId}, testType=${testType}`);

    const session = bulkUploadSessionStore.get(sessionToken);
    if (!session) {
      throw new ApiError(
        'Upload session expired or not found. Please re-upload the file.',
        410,
      );
    }

    // Verify the test exists in DB
    if (testType === 'practice') {
      const test = await prisma.practiceTest.findUnique({ where: { id: testId } });
      if (!test) throw new NotFoundError('Practice test');
    } else {
      const test = await prisma.examTest.findUnique({ where: { id: testId } });
      if (!test) throw new NotFoundError('Exam test');
    }

    const { validQuestions } = session;

    await prisma.$transaction(async (tx) => {
      for (const q of validQuestions) {
        const typeKey = q.type.trim().toUpperCase();
        const typeInt = TYPE_MAP[typeKey] ?? QuestionType.SINGLE_CHOICE;
        const isChoice = CHOICE_TYPES.includes(typeKey);

        const question = await tx.testQuestion.create({
          data: {
            text: sanitizeRequiredQuillHtml(q.questionText, 'questionText', { testId, testType }),
            type: typeInt,
            explanation: sanitizeOptionalQuillHtml(q.solution ?? null, 'explanation', { testId, testType }),
            ...(testType === 'practice'
              ? { practiceTestId: testId }
              : { examTestId: testId }),
          },
        });

        if (isChoice) {
          // Create options and resolve correct option IDs
          const createdOptions = await Promise.all(
            q.options.map((optText) => {
              // Strip the "A. " prefix — e.g. "A. Mumbai" → "Mumbai"
              const text = optText.replace(/^[A-Z]\.\s*/i, '').trim();
              return tx.testOption.create({
                data: { questionId: question.id, text },
              });
            }),
          );

          // Answer labels like "B" or "A, C"
          const answerLabels = q.answer
            .split(',')
            .map((l) => l.trim().toUpperCase())
            .filter((l) => l.length > 0);

          const correctOptionIds = answerLabels
            .map((label) => {
              const idx = OPTION_LABELS.indexOf(label);
              return idx >= 0 && idx < createdOptions.length ? (createdOptions[idx]?.id ?? null) : null;
            })
            .filter((id): id is string => id !== null);

          await tx.testQuestion.update({
            where: { id: question.id },
            data: { correctOptionIdsAnswers: correctOptionIds },
          });
        } else {
          // NUMERICAL, FILL_IN_THE_BLANK, TRUE_FALSE
          await tx.testQuestion.update({
            where: { id: question.id },
            data: { correctTextAnswer: q.answer },
          });
        }
      }
    });

    bulkUploadSessionStore.delete(sessionToken);

    logger.info(`BulkUploadService.confirm: saved ${validQuestions.length} questions`);

    return { savedCount: validQuestions.length };
  }
}
