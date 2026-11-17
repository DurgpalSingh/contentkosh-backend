import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import express from 'express';
import request from 'supertest';
import {
  FileStorageService,
  appendOriginalFileName,
  createUniqueFileName,
  extractOriginalFileName,
  toStorageSafeFileName,
  toUploadsStorageKey,
  uploadsFileStorage,
} from '../../../src/services/fileStorage.service';
import { NotFoundError } from '../../../src/errors/api.errors';

const uploadNamed = (originalname: string) => ({ originalname }) as Express.Multer.File;
/** Multer hands us UTF-8 names decoded as latin1. */
const asMulterFileName = (name: string) => Buffer.from(name, 'utf8').toString('latin1');

describe('FileStorageService', () => {
  let rootDir: string;
  let fileStorage: FileStorageService;

  const writeTempUpload = (content = '%PDF-1.4') => {
    const tempPath = path.join(rootDir, `tmp-${Math.random()}.pdf`);
    fs.writeFileSync(tempPath, content);
    return { path: tempPath } as Express.Multer.File;
  };

  beforeEach(() => {
    rootDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'file-storage-')));
    fileStorage = new FileStorageService(rootDir);
  });

  afterEach(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  it('refuses storage keys that escape the root folder', () => {
    expect(() => fileStorage.resolveStoragePath('../../.env')).toThrow(NotFoundError);
  });

  it('moves the upload into place and commits', async () => {
    const commitResult = await fileStorage.saveUploadThenCommit({
      uploadedFile: writeTempUpload(),
      storageKey: 'subjective/1/st-1/paper.pdf',
      commitToDatabase: async () => 'saved',
    });

    expect(commitResult).toBe('saved');
    expect(fs.existsSync(path.join(rootDir, 'subjective/1/st-1/paper.pdf'))).toBe(true);
  });

  it('serves requested byte ranges for progressive previews', async () => {
    fs.writeFileSync(path.join(rootDir, 'preview.pdf'), '0123456789');
    const app = express();
    app.get('/preview', async (_req, res) => {
      await fileStorage.streamToResponse(res, {
        storageKey: 'preview.pdf',
        downloadFileName: 'preview.pdf',
        contentType: 'application/pdf',
      });
    });

    const response = await request(app).get('/preview').set('Range', 'bytes=2-5');

    expect(response.status).toBe(206);
    expect(response.body.toString()).toBe('2345');
    expect(response.headers['content-range']).toBe('bytes 2-5/10');
    expect(response.headers['accept-ranges']).toBe('bytes');
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toContain('inline');
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('returns 416 for a byte range outside the file', async () => {
    fs.writeFileSync(path.join(rootDir, 'preview.pdf'), '0123456789');
    const app = express();
    app.get('/preview', async (_req, res) => {
      await fileStorage.streamToResponse(res, {
        storageKey: 'preview.pdf',
        downloadFileName: 'preview.pdf',
        contentType: 'application/pdf',
      });
    });

    const response = await request(app).get('/preview').set('Range', 'bytes=10-');

    expect(response.status).toBe(416);
    expect(response.headers['content-range']).toBe('bytes */10');
  });

  it('deletes the replaced file only after a successful commit', async () => {
    fs.mkdirSync(path.join(rootDir, 'a'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'a/old.pdf'), 'old');

    await fileStorage.saveUploadThenCommit({
      uploadedFile: writeTempUpload(),
      storageKey: 'a/new.pdf',
      replacedStorageKey: 'a/old.pdf',
      commitToDatabase: async () => undefined,
    });

    expect(fs.existsSync(path.join(rootDir, 'a/old.pdf'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'a/new.pdf'))).toBe(true);
  });

  it('removes the new file and keeps the old one when the commit fails', async () => {
    fs.mkdirSync(path.join(rootDir, 'a'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'a/old.pdf'), 'old');

    await expect(
      fileStorage.saveUploadThenCommit({
        uploadedFile: writeTempUpload(),
        storageKey: 'a/new.pdf',
        replacedStorageKey: 'a/old.pdf',
        commitToDatabase: async () => {
          throw new Error('db down');
        },
      }),
    ).rejects.toThrow('db down');

    expect(fs.existsSync(path.join(rootDir, 'a/new.pdf'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'a/old.pdf'))).toBe(true);
  });
});

describe('toUploadsStorageKey', () => {
  it.each([
    ['uploads/content/file-1.pdf', 'content/file-1.pdf'],
    ['uploads\\content\\file-1.pdf', 'content/file-1.pdf'],
    ['/uploads/profile/profilePicture-1.png', 'profile/profilePicture-1.png'],
  ])('turns the stored path %s into the key %s', (storedFilePath, expectedKey) => {
    expect(toUploadsStorageKey(storedFilePath)).toBe(expectedKey);
  });

  it('gives a key the storage refuses when the path is outside uploads/', () => {
    expect(() => uploadsFileStorage.resolveStoragePath(toUploadsStorageKey('secrets/.env'))).toThrow(NotFoundError);
  });
});

it('creates unique file names with the given prefix and extension', () => {
  expect(createUniqueFileName('file', '.pdf')).toMatch(/^file-\d+-\d+\.pdf$/);
  expect(createUniqueFileName('file', '.pdf')).not.toBe(createUniqueFileName('file', '.pdf'));
});

describe('original file names', () => {
  it('keeps a normal PDF name', () => {
    expect(toStorageSafeFileName(uploadNamed('rahul-gs1-mock3.pdf'))).toBe('rahul-gs1-mock3.pdf');
  });

  it('drops path parts and replaces unsafe characters', () => {
    expect(toStorageSafeFileName(uploadNamed('..\\..\\evil/na*me?.pdf'))).toBe('na_me_.pdf');
  });

  it('re-decodes UTF-8 names (e.g. Hindi)', () => {
    expect(toStorageSafeFileName(uploadNamed(asMulterFileName('उत्तर पुस्तिका.pdf')))).toBe('उत्तर पुस्तिका.pdf');
  });

  it('never contains the name separator', () => {
    expect(toStorageSafeFileName(uploadNamed('a__b.pdf'))).toBe('a_b.pdf');
  });

  it('reads the original name back from a storage key', () => {
    const storageKey = `subjective/1/st-1/answers/${appendOriginalFileName('42-1700000000000-123', 'rahul-gs1-mock3.pdf')}`;
    expect(extractOriginalFileName(storageKey)).toBe('rahul-gs1-mock3.pdf');
    expect(extractOriginalFileName('subjective/1/st-1/question-paper-1700000000000-123.pdf')).toBeNull();
    expect(extractOriginalFileName(null)).toBeNull();
  });
});
