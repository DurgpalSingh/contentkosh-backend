import { OfficeParser, OfficeContentNode } from 'officeparser';
import { ParsedQuestion } from '../dtos/bulkUpload.dto';
import logger from '../utils/logger';

/**
 * Recursively extracts all text from a content node and its children.
 * Preserves newlines between block-level children.
 */
function extractText(node: OfficeContentNode): string {
  if (!node.children || node.children.length === 0) {
    return (node.text ?? '').trim();
  }
  return node.children
    .map(child => extractText(child))
    .filter(t => t.length > 0)
    .join('\n');
}

/**
 * Extracts all text from a cell node, joining child paragraphs with newlines.
 */
function cellText(cell: OfficeContentNode): string {
  return extractText(cell).trim();
}

/**
 * Given a table node, extracts rows as [fieldText, valueText] pairs.
 * Each row has two cells: Field column and Value column.
 */
function tableToRows(table: OfficeContentNode): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const rowNodes = (table.children ?? []).filter(n => n.type === 'row');
  for (const row of rowNodes) {
    const cells = (row.children ?? []).filter(n => n.type === 'cell');
    if (cells.length >= 2) {
      const field = cellText(cells[0] as OfficeContentNode).toLowerCase().trim();
      const value = cellText(cells[1] as OfficeContentNode).trim();
      rows.push([field, value]);
    }
  }
  return rows;
}

/**
 * Parses option lines from the Options cell value.
 * Handles both "A. Option\nB. Option" and "A. Option B. Option" formats.
 */
function parseOptions(raw: string): string[] {
  // Split on newlines first, then look for A./B./C./D. patterns
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const options: string[] = [];
  for (const line of lines) {
    // Each line may contain multiple options if newlines were lost
    // Split on option label boundaries: A. B. C. D.
    const parts = line.split(/(?=[A-D]\.\s)/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (/^[A-D]\.\s/.test(trimmed)) {
        options.push(trimmed);
      }
    }
  }
  return options;
}

/**
 * Resolves answer labels for SINGLE_CHOICE/MULTIPLE_CHOICE.
 * The answer cell may contain option text (e.g. "Delhi") or labels (e.g. "B").
 * We try to match against option texts first, then fall back to label matching.
 */
function resolveAnswerLabels(answerRaw: string, options: string[]): string {
  const answerClean = answerRaw.trim();

  // Check if answer is already a label like "B" or "A, C"
  const labelPattern = /^[A-D](,\s*[A-D])*$/i;
  if (labelPattern.test(answerClean)) {
    return answerClean.toUpperCase();
  }

  // Answer may be option text(s) separated by commas — match against option texts
  const answerParts = answerClean.split(',').map(p => p.trim().toLowerCase());
  const matchedLabels: string[] = [];
  for (const part of answerParts) {
    for (const opt of options) {
      // opt is like "A. Mumbai" — extract label and text
      const match = opt.match(/^([A-D])\.\s*(.+)$/i);
      if (match) {
        const label = match[1]?.toUpperCase() ?? '';
        const text = (match[2] ?? '').trim().toLowerCase();
        if (text === part || text.startsWith(part)) {
          matchedLabels.push(label);
          break;
        }
      }
    }
  }

  if (matchedLabels.length > 0) {
    return matchedLabels.join(', ');
  }

  // Return as-is if we can't resolve
  return answerClean;
}

export class DocParserService {
  async parse(buffer: Buffer): Promise<ParsedQuestion[]> {
    logger.info('DocParserService: Parsing document AST');

    const ast = await OfficeParser.parseOffice(buffer);

    logger.info(`DocParserService: AST has ${ast.content.length} top-level nodes`);

    // Find all table nodes in the document (each question is one table)
    const tables = ast.content.filter(node => node.type === 'table');

    logger.info(`DocParserService: Found ${tables.length} table(s)`);

    const questions: ParsedQuestion[] = [];

    for (const table of tables) {
      const rows = tableToRows(table);

      // Build a field→value map from the rows (case-insensitive field names)
      const fieldMap: Record<string, string> = {};
      for (const [field, value] of rows) {
        // Skip header rows (Field/Value)
        if (field === 'field' || field === 'value') continue;
        if (field.length > 0) {
          fieldMap[field] = value;
        }
      }

      // Must have at least a question field to be a question table
      const questionText = fieldMap['question'] ?? '';
      if (!questionText) continue;

      const type = (fieldMap['type'] ?? '').trim().toUpperCase();
      const optionsRaw = fieldMap['options'] ?? '';
      const answerRaw = fieldMap['answer'] ?? '';
      const solutionRaw = fieldMap['solution'] ?? null;

      const options = optionsRaw ? parseOptions(optionsRaw) : [];

      // Resolve answer to labels for choice questions
      let answer = answerRaw;
      if ((type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && options.length > 0) {
        answer = resolveAnswerLabels(answerRaw, options);
      }

      questions.push({
        questionText,
        type,
        options,
        answer,
        solution: solutionRaw,
      });
    }

    logger.info(`DocParserService: Extracted ${questions.length} question(s) from tables`);

    return questions;
  }
}
