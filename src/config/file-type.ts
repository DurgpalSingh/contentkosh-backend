import { ContentType } from '@prisma/client';
import {
    FILE_EXTENSIONS,
    IMAGE_EXTENSIONS,
    FILE_FORMATS,
    MIME_TYPES
} from '../constants/file.constants';

const BYTES_IN_MB = 1024 * 1024;

const ALLOWED_FILE_TYPES =
    (process.env.ALLOWED_FILE_TYPES?.split(',') || Object.values(FILE_FORMATS))
        .map(type => type.trim().toLowerCase());

export const FILE_TYPE_CONFIG: Record<ContentType, {
    extensions: string[];
    allowed: boolean;
    maxSizeBytes: number;
    mimeTypes: Record<string, string>;
    defaultMimeType: string;
}> = {
    [ContentType.PDF]: {
        extensions: [FILE_EXTENSIONS.PDF],
        allowed: ALLOWED_FILE_TYPES.includes(FILE_FORMATS.PDF),
        maxSizeBytes:
            Number(process.env.MAX_PDF_SIZE_MB || 10) * BYTES_IN_MB,
        mimeTypes: {
            [FILE_EXTENSIONS.PDF]: MIME_TYPES.PDF
        },
        defaultMimeType: MIME_TYPES.PDF
    },

    [ContentType.IMAGE]: {
        extensions: IMAGE_EXTENSIONS,
        allowed: ALLOWED_FILE_TYPES.some(type =>
            [FILE_FORMATS.JPG, FILE_FORMATS.JPEG, FILE_FORMATS.PNG].includes(type)
        ),
        maxSizeBytes:
            Number(process.env.MAX_IMAGE_SIZE_MB || 5) * BYTES_IN_MB,
        mimeTypes: {
            [FILE_EXTENSIONS.JPG]: MIME_TYPES.JPEG,
            [FILE_EXTENSIONS.JPEG]: MIME_TYPES.JPEG,
            [FILE_EXTENSIONS.PNG]: MIME_TYPES.PNG
        },
        defaultMimeType: MIME_TYPES.DEFAULT
    },

    [ContentType.DOC]: {
        extensions: [FILE_EXTENSIONS.DOC, FILE_EXTENSIONS.DOCX],
        allowed: ALLOWED_FILE_TYPES.some(type =>
            [FILE_FORMATS.DOC, FILE_FORMATS.DOCX].includes(type)
        ),
        maxSizeBytes:
            Number(process.env.MAX_DOC_SIZE_MB || 10) * BYTES_IN_MB,
        mimeTypes: {
            [FILE_EXTENSIONS.DOC]: MIME_TYPES.DOC,
            [FILE_EXTENSIONS.DOCX]: MIME_TYPES.DOCX
        },
        defaultMimeType: MIME_TYPES.DEFAULT
    }
};