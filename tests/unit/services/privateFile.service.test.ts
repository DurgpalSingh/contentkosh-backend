import {
  originalNameFromKey,
  toKeyFileName,
  withOriginalName,
} from '../../../src/services/privateFile.service';
import { questionPaperFileName } from '../../../src/utils/subjectiveTest.utils';

const upload = (originalname: string) => ({ originalname }) as Express.Multer.File;
/** Multer hands us UTF-8 names decoded as latin1. */
const asMulterName = (name: string) => Buffer.from(name, 'utf8').toString('latin1');

describe('subjective file names', () => {
  describe('toKeyFileName', () => {
    it('keeps a normal PDF name', () => {
      expect(toKeyFileName(upload('rahul-gs1-mock3.pdf'))).toBe('rahul-gs1-mock3.pdf');
    });

    it('drops path parts and replaces unsafe characters', () => {
      expect(toKeyFileName(upload('..\\..\\evil/na*me?.pdf'))).toBe('na_me_.pdf');
    });

    it('re-decodes UTF-8 names (e.g. Hindi)', () => {
      expect(toKeyFileName(upload(asMulterName('उत्तर पुस्तिका.pdf')))).toBe('उत्तर पुस्तिका.pdf');
    });

    it('never contains the name separator', () => {
      expect(toKeyFileName(upload('a__b.pdf'))).toBe('a_b.pdf');
    });
  });

  describe('originalNameFromKey', () => {
    it('reads the original name back from a key', () => {
      const key = `subjective/1/st-1/answers/${withOriginalName('42-1700000000000-123', 'rahul-gs1-mock3.pdf')}`;
      expect(originalNameFromKey(key)).toBe('rahul-gs1-mock3.pdf');
    });

    it('returns null for keys without an original name', () => {
      expect(originalNameFromKey('subjective/1/st-1/question-paper-1700000000000-123.pdf')).toBeNull();
      expect(originalNameFromKey(null)).toBeNull();
    });
  });

  it('names the question paper after the paper type', () => {
    expect(questionPaperFileName('GS Paper I')).toBe('GS Paper I.pdf');
  });
});
