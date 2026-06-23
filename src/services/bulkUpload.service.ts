import crypto from 'crypto';
import { prisma } from '../config/database';
import { ParsedQuestion, PreviewResponse } from '../dtos/bulkUpload.dto';
import { ApiError, NotFoundError } from '../errors/api.errors';
import { DocParserService } from './docParser.service';
import { ExcelParserService } from './excelParser.service';
import { QuestionValidatorService } from './questionValidator.service';
import { bulkUploadSessionStore } from '../utils/bulkUploadSession.store';
import { sanitizeRequiredQuillHtml, sanitizeOptionalQuillHtml } from '../utils/sanitizeHtml';
import logger from '../utils/logger';
import {
  BULK_UPLOAD_ANSWER_SEPARATOR,
  BULK_UPLOAD_CHOICE_TYPES,
  BULK_UPLOAD_DEFAULT_QUESTION_TYPE,
  BULK_UPLOAD_MIME_HINTS,
  BULK_UPLOAD_OPTION_LABELS,
  BULK_UPLOAD_QUESTION_TYPE_MAP,
  BULK_UPLOAD_REGEX,
  BULK_UPLOAD_TEST_TYPES,
  BulkUploadTestType,
} from '../constants/bulkUpload.constants';
import { FILE_EXTENSIONS } from '../constants/file.constants';

export class BulkUploadService {
  private docParser = new DocParserService();
  private excelParser = new ExcelParserService();
  private validator = new QuestionValidatorService();

  async parseAndPreview(
    fileBuffer: Buffer,
    fileMime: string | undefined,
    originalName: string | undefined,
    testId: string,
    testType: BulkUploadTestType,
  ): Promise<PreviewResponse> {
    logger.info(`BulkUploadService.parseAndPreview: testId=${testId}, testType=${testType}`);

    // Choose parser based on MIME type or file extension
    const mime = (fileMime || '').toLowerCase();
    const name = (originalName || '').toLowerCase();
    let questions: ParsedQuestion[] = [];

    if (
      mime.includes(BULK_UPLOAD_MIME_HINTS.SPREADSHEET) ||
      mime.includes(BULK_UPLOAD_MIME_HINTS.EXCEL) ||
      name.endsWith(FILE_EXTENSIONS.XLS) ||
      name.endsWith(FILE_EXTENSIONS.XLSX)
    ) {
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
    testType: BulkUploadTestType,
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
    if (testType === BULK_UPLOAD_TEST_TYPES.PRACTICE) {
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
        const typeInt = BULK_UPLOAD_QUESTION_TYPE_MAP[typeKey] ?? BULK_UPLOAD_DEFAULT_QUESTION_TYPE;
        const isChoice = (BULK_UPLOAD_CHOICE_TYPES as readonly string[]).includes(typeKey);

        const question = await tx.testQuestion.create({
          data: {
            text: sanitizeRequiredQuillHtml(q.questionText, 'questionText', { testId, testType }),
            type: typeInt,
            explanation: sanitizeOptionalQuillHtml(q.solution ?? null, 'explanation', { testId, testType }),
            ...(testType === BULK_UPLOAD_TEST_TYPES.PRACTICE
              ? { practiceTestId: testId }
              : { examTestId: testId }),
          },
        });

        if (isChoice) {
          // Create options and resolve correct option IDs
          const createdOptions = await Promise.all(
            q.options.map((optText) => {
              // Strip the "A. " prefix — e.g. "A. Mumbai" → "Mumbai"
              const text = optText.replace(BULK_UPLOAD_REGEX.OPTION_TEXT_PREFIX, '').trim();
              return tx.testOption.create({
                data: { questionId: question.id, text },
              });
            }),
          );

          // Answer labels like "B" or "A, C"
          const answerLabels = q.answer
            .split(BULK_UPLOAD_ANSWER_SEPARATOR)
            .map((l) => l.trim().toUpperCase())
            .filter((l) => l.length > 0);

          const correctOptionIds = answerLabels
            .map((label) => {
              const idx = (BULK_UPLOAD_OPTION_LABELS as readonly string[]).indexOf(label);
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
