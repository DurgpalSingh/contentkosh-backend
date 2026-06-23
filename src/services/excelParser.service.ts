import * as XLSX from 'xlsx';
import { ParsedQuestion } from '../dtos/bulkUpload.dto';
import logger from '../utils/logger';
import { inlineMarkupToHtml } from '../utils/parserHtml.utils';
import { createParsedQuestion, normaliseParserKey, normaliseQuestionType } from '../utils/parserQuestion.utils';
import {
  BULK_UPLOAD_FIELD_NAMES,
  BULK_UPLOAD_HTML,
  BULK_UPLOAD_OPTION_LABELS,
  BULK_UPLOAD_REGEX,
} from '../constants/bulkUpload.constants';

// ---------------------------------------------------------------------------
// Text to TipTap-compatible HTML
// ---------------------------------------------------------------------------

function pipeTableToHtml(lines: string[]): string {
  const dataRows = lines.filter(l => !BULK_UPLOAD_REGEX.MARKDOWN_TABLE_DIVIDER.test(l));
  if (!dataRows.length) return '';
  const parseRow = (line: string) => line.replace(BULK_UPLOAD_REGEX.PIPE_BOUNDARY, '').split('|').map(c => c.trim());
  const [headerRow, ...bodyRows] = dataRows;
  const thead = `<${BULK_UPLOAD_HTML.TABLE_HEAD}><${BULK_UPLOAD_HTML.TABLE_ROW}>${parseRow(headerRow ?? '').map(h => `<${BULK_UPLOAD_HTML.TABLE_HEADER_CELL}><${BULK_UPLOAD_HTML.PARAGRAPH}>${inlineMarkupToHtml(h)}</${BULK_UPLOAD_HTML.PARAGRAPH}></${BULK_UPLOAD_HTML.TABLE_HEADER_CELL}>`).join('')}</${BULK_UPLOAD_HTML.TABLE_ROW}></${BULK_UPLOAD_HTML.TABLE_HEAD}>`;
  const tbody = bodyRows.length
    ? `<${BULK_UPLOAD_HTML.TABLE_BODY}>${bodyRows.map(r => `<${BULK_UPLOAD_HTML.TABLE_ROW}>${parseRow(r).map(c => `<${BULK_UPLOAD_HTML.TABLE_CELL}><${BULK_UPLOAD_HTML.PARAGRAPH}>${inlineMarkupToHtml(c)}</${BULK_UPLOAD_HTML.PARAGRAPH}></${BULK_UPLOAD_HTML.TABLE_CELL}>`).join('')}</${BULK_UPLOAD_HTML.TABLE_ROW}>`).join('')}</${BULK_UPLOAD_HTML.TABLE_BODY}>`
    : '';
  return `<${BULK_UPLOAD_HTML.TABLE}>${thead}${tbody}</${BULK_UPLOAD_HTML.TABLE}>`;
}

function cellToHtml(raw: string | null | undefined): string {
  if (!raw) return '';
  const text = String(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return '';
  const lines = text.split('\n');
  const parts: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tbl: string[] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) tbl.push(lines[i++] ?? '');
      const h = pipeTableToHtml(tbl);
      if (h) parts.push(h);
      continue;
    }
    if (BULK_UPLOAD_REGEX.BULLET_LIST_ITEM.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && BULK_UPLOAD_REGEX.BULLET_LIST_ITEM.test((lines[i] ?? '').trim()))
        items.push(`<${BULK_UPLOAD_HTML.LIST_ITEM}><${BULK_UPLOAD_HTML.PARAGRAPH}>${inlineMarkupToHtml((lines[i++] ?? '').trim().replace(BULK_UPLOAD_REGEX.BULLET_LIST_ITEM, ''))}</${BULK_UPLOAD_HTML.PARAGRAPH}></${BULK_UPLOAD_HTML.LIST_ITEM}>`);
      parts.push(`<${BULK_UPLOAD_HTML.UNORDERED_LIST}>${items.join('')}</${BULK_UPLOAD_HTML.UNORDERED_LIST}>`);
      continue;
    }
    if (BULK_UPLOAD_REGEX.NUMBERED_LIST_ITEM.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && BULK_UPLOAD_REGEX.NUMBERED_LIST_ITEM.test((lines[i] ?? '').trim()))
        items.push(`<${BULK_UPLOAD_HTML.LIST_ITEM}><${BULK_UPLOAD_HTML.PARAGRAPH}>${inlineMarkupToHtml((lines[i++] ?? '').trim().replace(BULK_UPLOAD_REGEX.NUMBERED_LIST_ITEM, ''))}</${BULK_UPLOAD_HTML.PARAGRAPH}></${BULK_UPLOAD_HTML.LIST_ITEM}>`);
      parts.push(`<${BULK_UPLOAD_HTML.ORDERED_LIST}>${items.join('')}</${BULK_UPLOAD_HTML.ORDERED_LIST}>`);
      continue;
    }
    if (!trimmed) { i++; continue; }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() &&
      !BULK_UPLOAD_REGEX.BULLET_LIST_ITEM.test((lines[i] ?? '').trim()) &&
      !BULK_UPLOAD_REGEX.NUMBERED_LIST_ITEM.test((lines[i] ?? '').trim()) &&
      !((lines[i] ?? '').trim().startsWith('|') && (lines[i] ?? '').trim().endsWith('|'))
    ) para.push(lines[i++] ?? '');
    if (para.length) parts.push(`<${BULK_UPLOAD_HTML.PARAGRAPH}>${para.map(l => inlineMarkupToHtml(l.trim())).join(BULK_UPLOAD_HTML.BR)}</${BULK_UPLOAD_HTML.PARAGRAPH}>`);
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Column layout detection
// Supports merged "Options" header spanning multiple sub-columns.
//
// Expected format (row 1 = primary headers, row 2 = optional sub-headers):
//   Question | Type | Options (merged C:F) | Answer | Explanation
//                     opt1    opt2  opt3  opt4
// ---------------------------------------------------------------------------

const PRIMARY_HEADERS: Record<string, string> = {
  [BULK_UPLOAD_FIELD_NAMES.QUESTION]: BULK_UPLOAD_FIELD_NAMES.QUESTION,
  [BULK_UPLOAD_FIELD_NAMES.QUESTION_TEXT]: BULK_UPLOAD_FIELD_NAMES.QUESTION,
  [BULK_UPLOAD_FIELD_NAMES.TYPE]: BULK_UPLOAD_FIELD_NAMES.TYPE,
  [BULK_UPLOAD_FIELD_NAMES.QUESTION_TYPE]: BULK_UPLOAD_FIELD_NAMES.TYPE,
  [BULK_UPLOAD_FIELD_NAMES.OPTIONS]: BULK_UPLOAD_FIELD_NAMES.OPTIONS_GROUP,
  [BULK_UPLOAD_FIELD_NAMES.OPTION]: BULK_UPLOAD_FIELD_NAMES.OPTIONS_GROUP,
  [BULK_UPLOAD_FIELD_NAMES.ANSWER]: BULK_UPLOAD_FIELD_NAMES.ANSWER,
  [BULK_UPLOAD_FIELD_NAMES.CORRECT_ANSWER]: BULK_UPLOAD_FIELD_NAMES.ANSWER,
  [BULK_UPLOAD_FIELD_NAMES.SOLUTION]: BULK_UPLOAD_FIELD_NAMES.SOLUTION,
  [BULK_UPLOAD_FIELD_NAMES.EXPLANATION]: BULK_UPLOAD_FIELD_NAMES.SOLUTION,
};

interface ColLayout {
  questionCol: number;
  typeCol: number;
  optionCols: number[];
  answerCol: number;
  solutionCol: number;
  dataStartRow: number;
}

function detectLayout(rows: unknown[][]): ColLayout | null {
  const headerIdx = rows.findIndex(r =>
    (r as unknown[]).some(c => PRIMARY_HEADERS[normaliseParserKey(String(c))] !== undefined),
  );
  if (headerIdx < 0) return null;

  const headerRow = rows[headerIdx] as unknown[];
  let questionCol = -1, typeCol = -1, answerCol = -1, solutionCol = -1;
  let optionsGroupStart = -1;
  const singleOptionCols: number[] = [];

  headerRow.forEach((cell, idx) => {
    const key = normaliseParserKey(String(cell));
    const mapped = PRIMARY_HEADERS[key];
    if (!mapped) return;
    switch (mapped) {
      case BULK_UPLOAD_FIELD_NAMES.QUESTION:      questionCol = idx; break;
      case BULK_UPLOAD_FIELD_NAMES.TYPE:          typeCol = idx; break;
      case BULK_UPLOAD_FIELD_NAMES.OPTIONS_GROUP: if (optionsGroupStart < 0) optionsGroupStart = idx; break;
      case BULK_UPLOAD_FIELD_NAMES.ANSWER:        answerCol = idx; break;
      case BULK_UPLOAD_FIELD_NAMES.SOLUTION:      solutionCol = idx; break;
    }
    if (
      (
        key.startsWith(BULK_UPLOAD_FIELD_NAMES.OPTION) &&
        key !== BULK_UPLOAD_FIELD_NAMES.OPTIONS &&
        key !== BULK_UPLOAD_FIELD_NAMES.OPTION
      ) ||
      BULK_UPLOAD_REGEX.OPTION_COLUMN_KEY.test(key)
    ) {
      singleOptionCols.push(idx);
    }
  });

  let optionCols: number[] = [];
  let dataStartRow = headerIdx + 1;

  if (optionsGroupStart >= 0) {
    // Find where the options group ends: next non-empty primary header after optionsGroupStart
    let optionsGroupEnd = optionsGroupStart;
    for (let c = optionsGroupStart + 1; c < headerRow.length; c++) {
      const key = normaliseParserKey(String(headerRow[c]));
      if (key && PRIMARY_HEADERS[key]) break;
      optionsGroupEnd = c;
    }

    // Check if the next row has sub-labels under the options group
    const subRow = rows[headerIdx + 1] as unknown[] | undefined;
    const subHasValues = subRow
      ? Array.from({ length: optionsGroupEnd - optionsGroupStart + 1 }, (_, i) => optionsGroupStart + i)
          .some(c => String(subRow[c] ?? '').trim() !== '')
      : false;

    if (subHasValues && subRow) {
      // Use only columns that have sub-header values
      for (let c = optionsGroupStart; c <= optionsGroupEnd; c++) {
        if (String(subRow[c] ?? '').trim()) optionCols.push(c);
      }
      dataStartRow = headerIdx + 1;
    } else {
      // No sub-header: all columns in the span are options
      for (let c = optionsGroupStart; c <= optionsGroupEnd; c++) optionCols.push(c);
    }
  } else if (singleOptionCols.length > 0) {
    optionCols = singleOptionCols;
  }

  return { questionCol, typeCol, optionCols, answerCol, solutionCol, dataStartRow };
}


// ---------------------------------------------------------------------------
// ExcelParserService
// ---------------------------------------------------------------------------

export class ExcelParserService {
  async parse(buffer: Buffer): Promise<ParsedQuestion[]> {
    logger.info('ExcelParserService: parsing workbook');

    const wb = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    if (!rows.length) return [];

    const layout = detectLayout(rows);
    if (!layout) {
      logger.warn('ExcelParserService: could not detect column layout');
      return [];
    }

    const { questionCol, typeCol, optionCols, answerCol, solutionCol, dataStartRow } = layout;
    logger.info(`ExcelParserService: Q:${questionCol} T:${typeCol} opts:[${optionCols}] A:${answerCol} S:${solutionCol} start:${dataStartRow}`);

    const questions: ParsedQuestion[] = [];

    for (let i = dataStartRow; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (!row) continue;

      const qText = String(row[questionCol] ?? '').trim();
      if (!qText) continue;

      const type = normaliseQuestionType(row[typeCol]);
      const answerRaw = String(row[answerCol] ?? '').trim();
      const solutionRaw = String(row[solutionCol] ?? '').trim();

      // Collect non-empty option values and auto-label A, B, C, etc.
      const options = optionCols
        .map(c => String(row[c] ?? '').trim())
        .filter(v => v.length > 0)
        .map((v, idx) => `${BULK_UPLOAD_OPTION_LABELS[idx] ?? String.fromCharCode(65 + idx)}. ${v}`);

      questions.push(createParsedQuestion({
        questionText: cellToHtml(qText),
        type,
        options,
        answerRaw,
        solution: solutionRaw ? cellToHtml(solutionRaw) : null,
      }));
    }

    logger.info(`ExcelParserService: extracted ${questions.length} question(s)`);
    return questions;
  }
}
