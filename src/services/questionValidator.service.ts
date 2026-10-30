import { InvalidBlock, ParsedQuestion } from '../dtos/bulkUpload.dto';

const VALID_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'NUMERICAL',
  'FILL_IN_THE_BLANK',
] as const;

const CHOICE_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'];

function reconstructRawText(q: ParsedQuestion): string {
  const lines: string[] = [];
  lines.push(`Question: ${q.questionText}`);
  lines.push(`Type: ${q.type}`);
  for (const opt of q.options) {
    lines.push(opt);
  }
  lines.push(`Answer: ${q.answer}`);
  if (q.solution !== null && q.solution !== undefined) {
    lines.push(`Solution: ${q.solution}`);
  }
  return lines.join('\n');
}

export class QuestionValidatorService {
  validate(questions: ParsedQuestion[]): { valid: ParsedQuestion[]; invalid: InvalidBlock[] } {
    const valid: ParsedQuestion[] = [];
    const invalid: InvalidBlock[] = [];

    let i = 0;
    for (const q of questions) {
      const position = ++i;
      const errors: string[] = [];

      // Rule 1: questionText must be non-empty
      if (!q.questionText || q.questionText.trim() === '') {
        errors.push('Missing required field: Question');
      }

      // Rule 2: type must be non-empty
      if (!q.type || q.type.trim() === '') {
        errors.push('Missing required field: Type');
      } else {
        // Rule 3: type must be one of the valid values
        const normalizedType = q.type.trim().toUpperCase();
        if (!(VALID_TYPES as readonly string[]).includes(normalizedType)) {
          errors.push(`Invalid Type value: ${q.type}`);
        }
      }

      // Rule 4: answer must be non-empty
      if (!q.answer || q.answer.trim() === '') {
        errors.push('Missing required field: Answer');
      }

      // Rules 5 & 6: only apply for SINGLE_CHOICE or MULTIPLE_CHOICE
      const normalizedType = q.type ? q.type.trim().toUpperCase() : '';
      if (CHOICE_TYPES.includes(normalizedType)) {
        // Rule 5: options.length must be >= 2
        if (!q.options || q.options.length < 2) {
          errors.push('SINGLE_CHOICE and MULTIPLE_CHOICE questions require at least 2 options');
        } else {
          // Rule 6: each answer label must correspond to an existing option
          if (q.answer && q.answer.trim() !== '') {
            const optionLabels = q.options.map(opt => opt.charAt(0).toUpperCase());
            const answerLabels = q.answer
              .split(',')
              .map(label => label.trim().toUpperCase())
              .filter(label => label.length > 0);

            for (const label of answerLabels) {
              if (!optionLabels.includes(label)) {
                errors.push(`Answer references non-existent option: ${label}`);
              }
            }
          }
        }
      }

      if (errors.length > 0) {
        invalid.push({
          position,
          rawText: reconstructRawText(q),
          errors,
        });
      } else {
        valid.push(q);
      }
    }

    return { valid, invalid };
  }
}
