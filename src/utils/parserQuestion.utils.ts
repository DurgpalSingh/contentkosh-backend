import { ParsedQuestion } from '../dtos/bulkUpload.dto';

const CHOICE_QUESTION_TYPES = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']);

export function normaliseParserKey(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normaliseQuestionType(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase();
}

export function isChoiceQuestionType(type: string): boolean {
  return CHOICE_QUESTION_TYPES.has(type);
}

export function resolveAnswerLabels(answerRaw: string, options: string[]): string {
  const clean = String(answerRaw).trim();
  if (!clean) return clean;

  const textToLabel = new Map<string, string>();
  options.forEach((option, index) => {
    const match = option.match(/^([A-F])[.)]\s*(.+)$/i);
    const label = match ? (match[1] ?? '').toUpperCase() : String.fromCharCode(65 + index);
    const text = match ? (match[2] ?? '').trim().toLowerCase() : option.trim().toLowerCase();
    textToLabel.set(text, label);
  });

  const normalised = clean.replace(/\s*&\s*/g, ',');
  const compact = normalised.replace(/\s/g, '');
  if (/^[A-F](,[A-F])*$/i.test(compact)) {
    return compact.toUpperCase();
  }

  const labels = normalised
    .split(',')
    .map(part => {
      const value = part.trim().toLowerCase();
      if (textToLabel.has(value)) return textToLabel.get(value)!;

      for (const [text, label] of textToLabel) {
        if (text.startsWith(value) || value.startsWith(text)) return label;
      }

      if (/^[A-F]$/i.test(value)) return value.toUpperCase();
      return null;
    })
    .filter((label): label is string => label !== null);

  return labels.length > 0 ? [...new Set(labels)].join(', ') : clean;
}

export function resolveQuestionAnswer(type: string, answerRaw: string, options: string[]): string {
  if (!isChoiceQuestionType(type) || options.length === 0) {
    return answerRaw;
  }

  return resolveAnswerLabels(answerRaw, options);
}

export function createParsedQuestion(input: {
  questionText: string;
  type: string;
  options: string[];
  answerRaw: string;
  solution: string | null;
}): ParsedQuestion {
  return {
    questionText: input.questionText,
    type: input.type,
    options: input.options,
    answer: resolveQuestionAnswer(input.type, input.answerRaw, input.options),
    solution: input.solution,
  };
}
