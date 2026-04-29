import * as XLSX from 'xlsx';
import { ParsedQuestion } from '../dtos/bulkUpload.dto';
import logger from '../utils/logger';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToHtml(text: string): string {
  if (!text) return '';
  const parts = String(text).split(/\r?\n\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
  return parts.map(p => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br/>')}</p>`).join('');
}

function parseOptions(raw: string): string[] {
  const options: string[] = [];
  if (!raw) return options;
  const lines = String(raw).split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  for (const line of lines) {
    // keep lines that look like labelled options (A. ...)
    if (/^[A-F]\.\s/.test(line) || /^[A-F]\)\s/.test(line)) {
      options.push(line);
    } else {
      // If lines aren't labelled, but there are 2+ lines, treat them as options
      options.push(line);
    }
  }
  return options;
}

function resolveAnswerLabels(answerRaw: string, options: string[]): string {
  const answerClean = String(answerRaw).trim();
  if (/^[A-F](,\s*[A-F])*$/i.test(answerClean)) return answerClean.toUpperCase();

  const answerParts = answerClean.split(',').map(p => p.trim().toLowerCase());
  const matched: string[] = [];

  for (const part of answerParts) {
    for (const opt of options) {
      const m = opt.match(/^([A-F])\.\s*(.+)$/i);
      if (m) {
        const label = (m[1] ?? '').toUpperCase();
        const text = (m[2] ?? '').trim().toLowerCase();
        if (text === part || text.startsWith(part) || part.startsWith(text)) {
          matched.push(label);
          break;
        }
      } else {
        // unlabeled option, match by exact or prefix
        if (opt.trim().toLowerCase() === part || opt.trim().toLowerCase().startsWith(part)) {
          // derive label from position
          const idx = options.indexOf(opt);
          if (idx >= 0) matched.push(String.fromCharCode(65 + idx));
          break;
        }
      }
    }
  }

  return matched.length > 0 ? matched.join(', ') : answerClean;
}

export class ExcelParserService {
  async parse(buffer: Buffer): Promise<ParsedQuestion[]> {
    logger.info('ExcelParserService: parsing workbook');

    const wb = XLSX.read(buffer, { type: 'buffer' });
    if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
      logger.info('ExcelParserService: no sheets found');
      return [];
    }

    const sheetName = wb.SheetNames[0];
    if (!sheetName || !wb.Sheets) {
      logger.info('ExcelParserService: no sheet found');
      return [];
    }
    const sheet = wb.Sheets[sheetName]!;
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }) as any[];
    if (!rows || rows.length === 0) return [];

    // Find header row (contains 'question')
    const headerIdx = rows.findIndex(r => r.some((c: any) => String(c).toLowerCase().includes('question')));
    let dataStart = 0;
    let headers: string[] = [];
    if (headerIdx >= 0) {
      headers = rows[headerIdx].map((h: any) => String(h || '').trim().toLowerCase());
      dataStart = headerIdx + 1;
    }

    const questions: ParsedQuestion[] = [];

    for (let i = dataStart; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      let qText = '';
      let type = '';
      let optionsRaw = '';
      let answerRaw = '';
      let solution = '';

      if (headers.length > 0) {
        for (let c = 0; c < headers.length; c++) {
          const h = headers[c];
          const cell = row[c] ?? '';
          if (!h) continue;
          if (h.includes('question')) qText = String(cell);
          else if (h.includes('type')) type = String(cell);
          else if (h.includes('option') || /^a$|^b$|^c$|^d$|^e$|^f$/.test(h)) optionsRaw += (optionsRaw ? '\n' : '') + String(cell);
          else if (h.includes('answer')) answerRaw = String(cell);
          else if (h.includes('solution') || h.includes('explanation')) solution = String(cell);
        }
      } else {
        // No header — assume columns: Question | Type | Options | Answer | Solution
        qText = String(row[0] ?? '');
        type = String(row[1] ?? '');
        optionsRaw = String(row[2] ?? '');
        answerRaw = String(row[3] ?? '');
        solution = String(row[4] ?? '');
      }

      if (!qText || String(qText).trim() === '') continue;

      const options = optionsRaw ? parseOptions(optionsRaw) : [];
      const normalizedType = String(type || '').trim().toUpperCase();
      let answer = String(answerRaw || '').trim();

      if ((normalizedType === 'SINGLE_CHOICE' || normalizedType === 'MULTIPLE_CHOICE') && options.length > 0) {
        answer = resolveAnswerLabels(answer, options);
      }

      questions.push({
        questionText: textToHtml(qText),
        type: normalizedType,
        options,
        answer,
        solution: solution ? textToHtml(solution) : null,
      });
    }

    logger.info(`ExcelParserService: extracted ${questions.length} question(s)`);
    return questions;
  }
}
