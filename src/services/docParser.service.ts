import { OfficeParser, OfficeContentNode } from 'officeparser';
import { ParsedQuestion } from '../dtos/bulkUpload.dto';
import logger from '../utils/logger';

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
    case 'paragraph':
    case 'text': {
      const inner = childrenToHtml(node);
      if (!inner.trim()) return isTopLevel ? '' : '<p></p>';
      return `<p>${inner}</p>`;
    }

    case 'heading': {
      const meta = node.metadata as { level?: number } | undefined;
      const level = meta?.level ?? 2;
      const safeLevel = Math.min(Math.max(level, 1), 3);
      const inner = childrenToHtml(node);
      return `<h${safeLevel}>${inner}</h${safeLevel}>`;
    }

    case 'list': {
      const meta = node.metadata as { listType?: string } | undefined;
      const tag = meta?.listType === 'ordered' ? 'ol' : 'ul';
      const inner = childrenToHtml(node);
      return `<${tag}>${inner}</${tag}>`;
    }

    case 'table': {
      const rows = (node.children ?? []).filter(n => n.type === 'row');
      const rowsHtml = rows.map(row => {
        const cells = (row.children ?? []).filter(n => n.type === 'cell');
        const cellsHtml = cells.map(cell => {
          const cellInner = (cell.children ?? [])
            .map(child => nodeToHtml(child))
            .filter(h => h.length > 0)
            .join('');
          return `<td>${cellInner || '<p></p>'}</td>`;
        }).join('');
        return `<tr>${cellsHtml}</tr>`;
      }).join('');
      return `<table><tbody>${rowsHtml}</tbody></table>`;
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
    if (child.type === 'text') {
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
  if (!fmt) return escapeHtml(text);

  let result = escapeHtml(text);
  if (fmt.bold) result = `<strong>${result}</strong>`;
  if (fmt.italic) result = `<em>${result}</em>`;
  if (fmt.underline) result = `<u>${result}</u>`;
  if (fmt.strikethrough) result = `<s>${result}</s>`;
  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Converts a cell's content nodes to HTML, skipping nested tables
 * (which are metadata/location tables, not question content).
 */
function cellToHtml(cell: OfficeContentNode, skipNestedTables = false): string {
  const children = cell.children ?? [];
  const parts: string[] = [];

  for (const child of children) {
    if (skipNestedTables && child.type === 'table') continue;
    const html = nodeToHtml(child, true);
    if (html.trim()) parts.push(html);
  }

  return parts.join('');
}

/**
 * Extracts plain text from a cell (for non-rich fields like Type, Answer, Options).
 * Skips nested tables.
 */
function cellToPlainText(cell: OfficeContentNode, skipNestedTables = false): string {
  const children = cell.children ?? [];
  const parts: string[] = [];

  for (const child of children) {
    if (skipNestedTables && child.type === 'table') continue;
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
  const rowNodes = (table.children ?? []).filter(n => n.type === 'row');

  for (const row of rowNodes) {
    const cells = (row.children ?? []).filter(n => n.type === 'cell');
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

function resolveAnswerLabels(answerRaw: string, options: string[]): string {
  const answerClean = answerRaw.trim();

  if (/^[A-D](,\s*[A-D])*$/i.test(answerClean)) {
    return answerClean.toUpperCase();
  }

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

function normaliseField(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
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
        const norm = normaliseField(field);
        if (norm === 'field' || norm === 'value' || norm === '') continue;
        if (!(norm in fieldCellMap)) {
          fieldCellMap[norm] = valueCell;
        }
      }

      // Must have a question field
      const questionCell = fieldCellMap['question'];
      if (!questionCell) continue;

      // Question and solution → HTML (rich content)
      const questionHtml = cellToHtml(questionCell, true);
      if (!questionHtml.trim()) continue;

      const solutionCell = fieldCellMap['solution'];
      const solutionHtml = solutionCell ? cellToHtml(solutionCell) : null;

      // Type, Options, Answer → plain text
      const typeCell = fieldCellMap['type'];
      const optionsCell = fieldCellMap['options'];
      const answerCell = fieldCellMap['answer'];

      const type = typeCell ? cellToPlainText(typeCell).trim().toUpperCase() : '';
      const optionsRaw = optionsCell ? cellToPlainText(optionsCell) : '';
      const answerRaw = answerCell ? cellToPlainText(answerCell) : '';

      const options = optionsRaw ? parseOptions(optionsRaw) : [];

      let answer = answerRaw;
      if ((type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && options.length > 0) {
        answer = resolveAnswerLabels(answerRaw, options);
      }

      questions.push({
        questionText: questionHtml,
        type,
        options,
        answer,
        solution: solutionHtml,
      });
    }

    logger.info(`DocParserService: Extracted ${questions.length} question(s)`);

    return questions;
  }

  private collectTables(nodes: OfficeContentNode[]): OfficeContentNode[] {
    const tables: OfficeContentNode[] = [];
    for (const node of nodes) {
      if (node.type === 'table') {
        tables.push(node);
      } else if (node.children && node.children.length > 0) {
        tables.push(...this.collectTables(node.children));
      }
    }
    return tables;
  }
}
