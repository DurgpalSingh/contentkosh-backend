import * as XLSX from 'xlsx';
import { ParsedQuestion } from '../dtos/bulkUpload.dto';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Text → TipTap-compatible HTML
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inlineToHtml(text: string): string {
  if (!text) return '';
  let r = text.replace(/\$\$([^$]+?)\$\$/gs, (_, l: string) =>
    `<span data-type="block-math" data-latex="${escapeHtml(l.trim())}"></span>`);
  r = r.replace(/\$([^$\n]+?)\$/g, (_, l: string) =>
    `<span data-type="inline-math" data-latex="${escapeHtml(l.trim())}"></span>`);
  r = r.replace(/\*\*(.+?)\*\*/gs, (_, t: string) => `<strong>${escapeHtml(t)}</strong>`);
  r = r.replace(/\*([^*\n]+?)\*/g, (_, t: string) => `<em>${escapeHtml(t)}</em>`);
  r = r.replace(/~~(.+?)~~/gs, (_, t: string) => `<s>${escapeHtml(t)}</s>`);
  r = r.replace(/\+\+(.+?)\+\+/gs, (_, t: string) => `<u>${escapeHtml(t)}</u>`);
  return r;
}

function pipeTableToHtml(lines: string[]): string {
  const dataRows = lines.filter(l => !/^\s*\|[-:| ]+\|\s*$/.test(l));
  if (!dataRows.length) return '';
  const parseRow = (line: string) => line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const [headerRow, ...bodyRows] = dataRows;
  const thead = `<thead><tr>${parseRow(headerRow ?? '').map(h => `<th><p>${inlineToHtml(h)}</p></th>`).join('')}</tr></thead>`;
  const tbody = bodyRows.length
    ? `<tbody>${bodyRows.map(r => `<tr>${parseRow(r).map(c => `<td><p>${inlineToHtml(c)}</p></td>`).join('')}</tr>`).join('')}</tbody>`
    : '';
  return `<table>${thead}${tbody}</table>`;
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
    if (/^[-*]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test((lines[i] ?? '').trim()))
        items.push(`<li><p>${inlineToHtml((lines[i++] ?? '').trim().replace(/^[-*]\s/, ''))}</p></li>`);
      parts.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+[.)]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s/.test((lines[i] ?? '').trim()))
        items.push(`<li><p>${inlineToHtml((lines[i++] ?? '').trim().replace(/^\d+[.)]\s/, ''))}</p></li>`);
      parts.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (!trimmed) { i++; continue; }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() &&
      !/^[-*]\s/.test((lines[i] ?? '').trim()) &&
      !/^\d+[.)]\s/.test((lines[i] ?? '').trim()) &&
      !((lines[i] ?? '').trim().startsWith('|') && (lines[i] ?? '').trim().endsWith('|'))
    ) para.push(lines[i++] ?? '');
    if (para.length) parts.push(`<p>${para.map(l => inlineToHtml(l.trim())).join('<br/>')}</p>`);
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
  question: 'question', 'question text': 'question',
  type: 'type', 'question type': 'type',
  options: 'options_group', option: 'options_group',
  answer: 'answer', 'correct answer': 'answer',
  solution: 'solution', explanation: 'solution',
};

function normHeader(s: string): string {
  return String(s).toLowerCase().trim();
}

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
    (r as unknown[]).some(c => PRIMARY_HEADERS[normHeader(String(c))] !== undefined),
  );
  if (headerIdx < 0) return null;

  const headerRow = rows[headerIdx] as unknown[];
  let questionCol = -1, typeCol = -1, answerCol = -1, solutionCol = -1;
  let optionsGroupStart = -1;
  const singleOptionCols: number[] = [];

  headerRow.forEach((cell, idx) => {
    const key = normHeader(String(cell));
    const mapped = PRIMARY_HEADERS[key];
    if (!mapped) return;
    switch (mapped) {
      case 'question':      questionCol = idx; break;
      case 'type':          typeCol = idx; break;
      case 'options_group': if (optionsGroupStart < 0) optionsGroupStart = idx; break;
      case 'answer':        answerCol = idx; break;
      case 'solution':      solutionCol = idx; break;
    }
    if ((key.startsWith('option') && key !== 'options' && key !== 'option') || /^[a-f]$/.test(key)) {
      singleOptionCols.push(idx);
    }
  });

  let optionCols: number[] = [];
  let dataStartRow = headerIdx + 1;

  if (optionsGroupStart >= 0) {
    // Find where the options group ends: next non-empty primary header after optionsGroupStart
    let optionsGroupEnd = optionsGroupStart;
    for (let c = optionsGroupStart + 1; c < headerRow.length; c++) {
      const key = normHeader(String(headerRow[c]));
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
      // No sub-header — all columns in the span are options
      for (let c = optionsGroupStart; c <= optionsGroupEnd; c++) optionCols.push(c);
    }
  } else if (singleOptionCols.length > 0) {
    optionCols = singleOptionCols;
  }

  return { questionCol, typeCol, optionCols, answerCol, solutionCol, dataStartRow };
}

// ---------------------------------------------------------------------------
// Answer resolution
// ---------------------------------------------------------------------------

function resolveAnswerLabels(answerRaw: string, options: string[]): string {
  const clean = String(answerRaw).trim();
  if (!clean) return clean;

  const textToLabel = new Map<string, string>();
  options.forEach((opt, idx) => {
    const m = opt.match(/^([A-F])[.)]\s*(.+)$/i);
    const label = m ? (m[1] ?? '').toUpperCase() : String.fromCharCode(65 + idx);
    const text = m ? (m[2] ?? '').trim().toLowerCase() : opt.trim().toLowerCase();
    textToLabel.set(text, label);
  });

  // Normalise & → , for multi-answer
  const normalised = clean.replace(/\s*&\s*/g, ',');
  if (/^[A-F](,[A-F])*$/i.test(normalised.replace(/\s/g, '')))
    return normalised.replace(/\s/g, '').toUpperCase();

  const parts = normalised.split(',').map(p => p.trim());
  const labels = parts.map(part => {
    const p = part.toLowerCase();
    if (textToLabel.has(p)) return textToLabel.get(p)!;
    for (const [text, label] of textToLabel) {
      if (text.startsWith(p) || p.startsWith(text)) return label;
    }
    if (/^[A-F]$/i.test(p)) return p.toUpperCase();
    return null;
  }).filter((l): l is string => l !== null);

  return labels.length > 0 ? [...new Set(labels)].join(', ') : clean;
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

      const type = String(row[typeCol] ?? '').trim().toUpperCase();
      const answerRaw = String(row[answerCol] ?? '').trim();
      const solutionRaw = String(row[solutionCol] ?? '').trim();

      // Collect non-empty option values and auto-label A. B. C. …
      const options = optionCols
        .map(c => String(row[c] ?? '').trim())
        .filter(v => v.length > 0)
        .map((v, idx) => `${String.fromCharCode(65 + idx)}. ${v}`);

      let answer = answerRaw;
      if ((type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && options.length > 0) {
        answer = resolveAnswerLabels(answerRaw, options);
      }

      questions.push({
        questionText: cellToHtml(qText),
        type,
        options,
        answer,
        solution: solutionRaw ? cellToHtml(solutionRaw) : null,
      });
    }

    logger.info(`ExcelParserService: extracted ${questions.length} question(s)`);
    return questions;
  }
}
