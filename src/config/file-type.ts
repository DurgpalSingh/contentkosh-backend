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

// ---------------------------------------------------------------------------
// Bulk Question Upload config
// Configurable via environment variables — no code changes needed to add formats.
// BULK_UPLOAD_ALLOWED_MIME_TYPES: comma-separated MIME types (default: doc + docx)
// BULK_UPLOAD_MAX_SIZE_MB: max file size in MB (default: 10)
// ---------------------------------------------------------------------------

const DEFAULT_BULK_UPLOAD_MIME_TYPES = [
    // MIME_TYPES.DOC,   // application/msword (.doc)
    MIME_TYPES.DOCX,  // application/vnd.openxmlformats-officedocument.wordprocessingml.document (.docx)
    MIME_TYPES.XLS,   // application/vnd.ms-excel (.xls)
    MIME_TYPES.XLSX,  // application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (.xlsx)
];

export const BULK_UPLOAD_FILE_CONFIG = {
    allowedMimeTypes: process.env.BULK_UPLOAD_ALLOWED_MIME_TYPES
        ? process.env.BULK_UPLOAD_ALLOWED_MIME_TYPES.split(',').map(t => t.trim())
        : DEFAULT_BULK_UPLOAD_MIME_TYPES,

    maxSizeBytes: Number(process.env.BULK_UPLOAD_MAX_SIZE_MB || 10) * BYTES_IN_MB,

    errorMessage: 'Only Word or Excel files (.doc, .docx, .xls, .xlsx) are supported for bulk upload',
} as const;