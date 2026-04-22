import { OfficeParser, OfficeContentNode } from 'officeparser';
import { ParsedQuestion } from '../dtos/bulkUpload.dto';
import logger from '../utils/logger';

/**
 * Recursively extracts plain text from a node, joining children with newlines.
 * Skips nested tables entirely (they are metadata/context, not question content).
 */
function extractText(node: OfficeContentNode, skipNestedTables = false): string {
  if (skipNestedTables && node.type === 'table') return '';

  if (!node.children || node.children.length === 0) {
    return (node.text ?? '').trim();
  }

  const parts = node.children
    .map(child => extractText(child, skipNestedTables))
    .filter(t => t.length > 0);

  return parts.join('\n');
}

/**
 * Extracts text from a cell, skipping any nested tables (e.g. location metadata tables).
 */
function cellText(cell: OfficeContentNode): string {
  return extractText(cell, true).trim();
}

/**
 * Given a table node, extracts rows as [fieldText, valueText] pairs.
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
 * Handles "A. Option\nB. Option" and "A. Option B. Option" (newlines lost).
 */
function parseOptions(raw: string): string[] {
  const options: string[] = [];
  // Split on newlines first
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    // A line may contain multiple options if newlines were collapsed
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
 * Resolves the answer to option labels (A, B, C...) for choice questions.
 * The answer cell may contain option text ("Delhi") or labels ("B") or
 * comma-separated texts ("Java, Python").
 */
function resolveAnswerLabels(answerRaw: string, options: string[]): string {
  const answerClean = answerRaw.trim();

  // Already a label or comma-separated labels like "B" or "A, C"
  if (/^[A-D](,\s*[A-D])*$/i.test(answerClean)) {
    return answerClean.toUpperCase();
  }

  // Try to match answer text(s) against option texts
  const answerParts = answerClean.split(',').map(p => p.trim().toLowerCase());
  const matchedLabels: string[] = [];

  for (const part of answerParts) {
    for (const opt of options) {
      const match = opt.match(/^([A-D])\.\s*(.+)$/i);
      if (match) {
        const label = (match[1] ?? '').toUpperCase();
        const text = (match[2] ?? '').trim().toLowerCase();
        if (text === part || text.startsWith(part) || part.startsWith(text)) {
          matchedLabels.push(label);
          break;
        }
      }
    }
  }

  return matchedLabels.length > 0 ? matchedLabels.join(', ') : answerClean;
}

/**
 * Normalises a field name: lowercase, trim, collapse whitespace.
 */
function normaliseField(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

export class DocParserService {
  async parse(buffer: Buffer): Promise<ParsedQuestion[]> {
    logger.info('DocParserService: Parsing document AST');

    const ast = await OfficeParser.parseOffice(buffer);

    logger.info(`DocParserService: AST has ${ast.content.length} top-level nodes`);

    // Collect all table nodes recursively (handles tables nested inside other containers)
    const tables = this.collectTables(ast.content);

    logger.info(`DocParserService: Found ${tables.length} table(s)`);

    const questions: ParsedQuestion[] = [];

    for (const table of tables) {
      const rows = tableToRows(table);

      // Build field→value map, skipping header rows
      const fieldMap: Record<string, string> = {};
      for (const [field, value] of rows) {
        const norm = normaliseField(field);
        if (norm === 'field' || norm === 'value' || norm === '') continue;
        // Only store first occurrence of each field
        if (!(norm in fieldMap)) {
          fieldMap[norm] = value;
        }
      }

      // Must have a question field to be a question table
      const questionText = fieldMap['question'] ?? '';
      if (!questionText) continue;

      const type = (fieldMap['type'] ?? '').trim().toUpperCase();
      const optionsRaw = fieldMap['options'] ?? '';
      const answerRaw = fieldMap['answer'] ?? '';
      const solutionRaw = fieldMap['solution'] ?? null;

      const options = optionsRaw ? parseOptions(optionsRaw) : [];

      let answer = answerRaw;
      if ((type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && options.length > 0) {
        answer = resolveAnswerLabels(answerRaw, options);
      }

      questions.push({ questionText, type, options, answer, solution: solutionRaw });
    }

    logger.info(`DocParserService: Extracted ${questions.length} question(s)`);

    return questions;
  }

  /**
   * Recursively collects all table nodes from a list of content nodes.
   * Top-level tables are returned first; nested tables inside non-table nodes are also included.
   * Tables that are children of other tables (nested metadata tables) are excluded.
   */
  private collectTables(nodes: OfficeContentNode[]): OfficeContentNode[] {
    const tables: OfficeContentNode[] = [];
    for (const node of nodes) {
      if (node.type === 'table') {
        tables.push(node);
        // Don't recurse into table children — nested tables are metadata, not questions
      } else if (node.children && node.children.length > 0) {
        tables.push(...this.collectTables(node.children));
      }
    }
    return tables;
  }
}
