import { OfficeParser, OfficeContentNode } from 'officeparser';
import { ParsedQuestion } from '../dtos/bulkUpload.dto';
import logger from '../utils/logger';
import { textWithMath } from '../utils/parserHtml.utils';
import { createParsedQuestion, normaliseParserKey, normaliseQuestionType } from '../utils/parserQuestion.utils';
import {
  BULK_UPLOAD_FIELD_NAMES,
  BULK_UPLOAD_HTML,
  BULK_UPLOAD_REGEX,
  OFFICE_NODE_TYPES,
} from '../constants/bulkUpload.constants';

// ---------------------------------------------------------------------------
// AST → HTML conversion
// ---------------------------------------------------------------------------

/**
 * Converts an OfficeContentNode to TipTap-compatible HTML.
 * Handles paragraphs, headings, lists, tables, bold/italic/underline formatting.
 * Used for question text and solution/explanation fields.
 */
function nodeToHtml(node: OfficeContentNode, isTopLevel = false): string {
  switch (node.type) {
    case OFFICE_NODE_TYPES.PARAGRAPH:
    case OFFICE_NODE_TYPES.TEXT: {
      const inner = childrenToHtml(node);
      if (!inner.trim()) return isTopLevel ? '' : BULK_UPLOAD_HTML.EMPTY_PARAGRAPH;
      return `<${BULK_UPLOAD_HTML.PARAGRAPH}>${inner}</${BULK_UPLOAD_HTML.PARAGRAPH}>`;
    }

    case OFFICE_NODE_TYPES.HEADING: {
      const meta = node.metadata as { level?: number } | undefined;
      const level = meta?.level ?? 2;
      const safeLevel = Math.min(Math.max(level, 1), 3);
      const inner = childrenToHtml(node);
      return `<${BULK_UPLOAD_HTML.HEADING}${safeLevel}>${inner}</${BULK_UPLOAD_HTML.HEADING}${safeLevel}>`;
    }

    case OFFICE_NODE_TYPES.LIST: {
      const meta = node.metadata as { listType?: string } | undefined;
      const tag = meta?.listType === OFFICE_NODE_TYPES.ORDERED_LIST
        ? BULK_UPLOAD_HTML.ORDERED_LIST
        : BULK_UPLOAD_HTML.UNORDERED_LIST;
      const inner = childrenToHtml(node);
      return `<${tag}>${inner}</${tag}>`;
    }

    case OFFICE_NODE_TYPES.TABLE: {
      const rows = (node.children ?? []).filter(n => n.type === OFFICE_NODE_TYPES.ROW);
      if (rows.length === 0) return '';
      const rowsHtml = rows.map((row, rowIdx) => {
        const cells = (row.children ?? []).filter(n => n.type === OFFICE_NODE_TYPES.CELL);
        // First row uses <th> if it looks like a header (first row of table)
        const isHeaderRow = rowIdx === 0;
        const cellsHtml = cells.map(cell => {
          const tag = isHeaderRow ? BULK_UPLOAD_HTML.TABLE_HEADER_CELL : BULK_UPLOAD_HTML.TABLE_CELL;
          const cellInner = (cell.children ?? [])
            .map(child => nodeToHtml(child))
            .filter(h => h.length > 0)
            .join('') || BULK_UPLOAD_HTML.EMPTY_PARAGRAPH;
          return `<${tag}>${cellInner}</${tag}>`;
        }).join('');
        return `<${BULK_UPLOAD_HTML.TABLE_ROW}>${cellsHtml}</${BULK_UPLOAD_HTML.TABLE_ROW}>`;
      }).join('');
      return `<${BULK_UPLOAD_HTML.TABLE}><${BULK_UPLOAD_HTML.TABLE_BODY}>${rowsHtml}</${BULK_UPLOAD_HTML.TABLE_BODY}></${BULK_UPLOAD_HTML.TABLE}>`;
    }

    default: {
      // For any other node type, just render children
      const inner = childrenToHtml(node);
      return inner;
    }
  }
}

/**
 * Renders the children of a node, applying inline formatting.
 */
function childrenToHtml(node: OfficeContentNode): string {
  if (!node.children || node.children.length === 0) {
    return applyFormatting(node.text ?? '', node);
  }
  return node.children.map(child => {
    if (child.type === OFFICE_NODE_TYPES.TEXT) {
      return applyFormatting(child.text ?? '', child);
    }
    // Nested block nodes inside inline context — recurse
    return nodeToHtml(child);
  }).join('');
}

/**
 * Wraps text in inline formatting tags based on node formatting metadata.
 */
function applyFormatting(text: string, node: OfficeContentNode): string {
  if (!text) return '';
  const fmt = node.formatting;
  if (!fmt) return textWithMath(text);

  let result = textWithMath(text);
  if (fmt.bold) result = `<${BULK_UPLOAD_HTML.STRONG}>${result}</${BULK_UPLOAD_HTML.STRONG}>`;
  if (fmt.italic) result = `<${BULK_UPLOAD_HTML.EMPHASIS}>${result}</${BULK_UPLOAD_HTML.EMPHASIS}>`;
  if (fmt.underline) result = `<${BULK_UPLOAD_HTML.UNDERLINE}>${result}</${BULK_UPLOAD_HTML.UNDERLINE}>`;
  if (fmt.strikethrough) result = `<${BULK_UPLOAD_HTML.STRIKE}>${result}</${BULK_UPLOAD_HTML.STRIKE}>`;
  return result;
}

/**
 * Converts a cell's content nodes to HTML.
 * Includes ALL content — paragraphs, nested tables, lists, etc.
 * The skipMetadataTables flag is intentionally NOT used anymore since
 * we cannot reliably distinguish metadata tables from question content tables.
 */
function cellToHtml(cell: OfficeContentNode): string {
  const children = cell.children ?? [];
  const parts: string[] = [];

  for (const child of children) {
    const html = nodeToHtml(child, true);
    if (html.trim()) parts.push(html);
  }

  return parts.join('');
}

/**
 * @deprecated No longer used — kept for reference.
 * Heuristic was too broad and incorrectly skipped question content tables.
 */
function isMetadataTable(_table: OfficeContentNode): boolean {
  return false;
}

/**
 * Extracts plain text from a cell (for non-rich fields like Type, Answer, Options).
 * Skips nested tables.
 */
function cellToPlainText(cell: OfficeContentNode, skipNestedTables = false): string {
  const children = cell.children ?? [];
  const parts: string[] = [];

  for (const child of children) {
    if (skipNestedTables && child.type === OFFICE_NODE_TYPES.TABLE) continue;
    parts.push(extractPlainText(child));
  }

  return parts.join('\n').trim();
}

function extractPlainText(node: OfficeContentNode): string {
  if (!node.children || node.children.length === 0) {
    return (node.text ?? '').trim();
  }
  return node.children
    .map(child => extractPlainText(child))
    .filter(t => t.length > 0)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Table parsing
// ---------------------------------------------------------------------------

function tableToRows(table: OfficeContentNode): Array<{ field: string; valueCell: OfficeContentNode }> {
  const rows: Array<{ field: string; valueCell: OfficeContentNode }> = [];
  const rowNodes = (table.children ?? []).filter(n => n.type === OFFICE_NODE_TYPES.ROW);

  for (const row of rowNodes) {
    const cells = (row.children ?? []).filter(n => n.type === OFFICE_NODE_TYPES.CELL);
    if (cells.length >= 2) {
      const field = cellToPlainText(cells[0] as OfficeContentNode).toLowerCase().trim();
      rows.push({ field, valueCell: cells[1] as OfficeContentNode });
    }
  }

  return rows;
}

function parseOptions(raw: string): string[] {
  const options: string[] = [];
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    const parts = line.split(BULK_UPLOAD_REGEX.OPTION_SPLIT);
    for (const part of parts) {
      const trimmed = part.trim();
      if (BULK_UPLOAD_REGEX.OPTION_PREFIX.test(trimmed)) {
        options.push(trimmed);
      }
    }
  }

  return options;
}

// ---------------------------------------------------------------------------
// DocParserService
// ---------------------------------------------------------------------------

export class DocParserService {
  async parse(buffer: Buffer): Promise<ParsedQuestion[]> {
    logger.info('DocParserService: Parsing document AST');

    const ast = await OfficeParser.parseOffice(buffer);

    logger.info(`DocParserService: AST has ${ast.content.length} top-level nodes`);

    const tables = this.collectTables(ast.content);

    logger.info(`DocParserService: Found ${tables.length} table(s)`);

    const questions: ParsedQuestion[] = [];

    for (const table of tables) {
      const rows = tableToRows(table);

      // Build field → cell map (skip header rows)
      const fieldCellMap: Record<string, OfficeContentNode> = {};
      for (const { field, valueCell } of rows) {
        const norm = normaliseParserKey(field);
        if (norm === BULK_UPLOAD_FIELD_NAMES.FIELD || norm === BULK_UPLOAD_FIELD_NAMES.VALUE || norm === '') continue;
        if (!(norm in fieldCellMap)) {
          fieldCellMap[norm] = valueCell;
        }
      }

      // Must have a question field
      const questionCell = fieldCellMap[BULK_UPLOAD_FIELD_NAMES.QUESTION];
      if (!questionCell) continue;

      // Debug: log the question cell structure
      logger.info(`DocParserService: question cell children types: ${(questionCell.children ?? []).map(c => c.type).join(', ')}`);
      logger.info(`DocParserService: question cell full: ${JSON.stringify(questionCell, null, 2).slice(0, 500)}`);

      // Question and solution → HTML (rich content)
      const questionHtml = cellToHtml(questionCell);
      logger.info(`DocParserService: questionHtml="${questionHtml.slice(0, 200)}"`);
      if (!questionHtml.trim()) continue;

      const solutionCell = fieldCellMap[BULK_UPLOAD_FIELD_NAMES.SOLUTION];
      const solutionHtml = solutionCell ? cellToHtml(solutionCell) : null;

      // Type, Options, Answer → plain text
      const typeCell = fieldCellMap[BULK_UPLOAD_FIELD_NAMES.TYPE];
      const optionsCell = fieldCellMap[BULK_UPLOAD_FIELD_NAMES.OPTIONS];
      const answerCell = fieldCellMap[BULK_UPLOAD_FIELD_NAMES.ANSWER];

      const type = normaliseQuestionType(typeCell ? cellToPlainText(typeCell) : '');
      const optionsRaw = optionsCell ? cellToPlainText(optionsCell) : '';
      const answerRaw = answerCell ? cellToPlainText(answerCell) : '';

      const options = optionsRaw ? parseOptions(optionsRaw) : [];

      questions.push(createParsedQuestion({
        questionText: questionHtml,
        type,
        options,
        answerRaw,
        solution: solutionHtml,
      }));
    }

    logger.info(`DocParserService: Extracted ${questions.length} question(s)`);

    return questions;
  }

  private collectTables(nodes: OfficeContentNode[]): OfficeContentNode[] {
    const tables: OfficeContentNode[] = [];
    for (const node of nodes) {
      if (node.type === OFFICE_NODE_TYPES.TABLE) {
        tables.push(node);
        // Do NOT recurse into table children — nested tables are metadata, not questions
      } else if (node.children && node.children.length > 0) {
        tables.push(...this.collectTables(node.children));
      }
    }
    return tables;
  }
}
