import { validateMultipleFileSizes } from '../../../src/middlewares/upload.middleware';
import { BadRequestError } from '../../../src/errors/api.errors';

jest.mock('../../../src/utils/logger');

const makeFile = (originalname: string, size = 1024): Express.Multer.File =>
    ({ originalname, size, path: `uploads/content/files-${originalname}` } as Express.Multer.File);

const run = (files: Express.Multer.File[], titles: unknown) => {
    const req: any = { files, body: { titles } };
    const next = jest.fn();
    validateMultipleFileSizes(req, {} as any, next);
    return { req, next };
};

describe('validateMultipleFileSizes', () => {
    it('maps files and JSON titles to body.items in order', () => {
        const { req, next } = run(
            [makeFile('a.pdf', 100), makeFile('b.png', 200)],
            JSON.stringify([' Notes A ', 'Image B'])
        );

        expect(next).toHaveBeenCalledWith();
        expect(req.body.titles).toBeUndefined();
        expect(req.body.items).toEqual([
            { title: 'Notes A', type: 'PDF', filePath: 'uploads/content/files-a.pdf', fileSize: 100 },
            { title: 'Image B', type: 'IMAGE', filePath: 'uploads/content/files-b.png', fileSize: 200 },
        ]);
    });

    it('accepts a plain title for a single file', () => {
        const { req, next } = run([makeFile('a.pdf')], 'Only Title');

        expect(next).toHaveBeenCalledWith();
        expect(req.body.items[0].title).toBe('Only Title');
    });

    it('rejects when no files are uploaded', () => {
        const { next } = run([], '[]');

        expect(next.mock.calls[0][0]).toBeInstanceOf(BadRequestError);
    });

    it('rejects when title count does not match file count', () => {
        const { next } = run([makeFile('a.pdf'), makeFile('b.pdf')], JSON.stringify(['Only one']));

        expect(next.mock.calls[0][0]).toBeInstanceOf(BadRequestError);
        expect(next.mock.calls[0][0].message).toBe('Each uploaded file must have a title');
    });

    it('rejects a file that exceeds its type size limit, naming the file', () => {
        const { next } = run([makeFile('ok.pdf'), makeFile('big.png', 50 * 1024 * 1024)], JSON.stringify(['A', 'B']));

        expect(next.mock.calls[0][0]).toBeInstanceOf(BadRequestError);
        expect(next.mock.calls[0][0].message).toContain('"big.png"');
    });
});
