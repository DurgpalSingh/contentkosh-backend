import { ContentType } from '@prisma/client';
import {
    FILE_EXTENSIONS,
    IMAGE_EXTENSIONS,
    FILE_FORMATS
} from '../constants/file.constants';

const BYTES_IN_MB = 1024 * 1024;

const ALLOWED_FILE_TYPES =
    process.env.ALLOWED_FILE_TYPES?.split(',') ||
    Object.values(FILE_FORMATS);

export const FILE_TYPE_CONFIG: Record<ContentType, {
    extensions: string[];
    allowed: boolean;
    maxSizeBytes: number;
}> = {
    [ContentType.PDF]: {
        extensions: [FILE_EXTENSIONS.PDF],
        allowed: ALLOWED_FILE_TYPES.includes(FILE_FORMATS.PDF),
        maxSizeBytes:
            Number(process.env.MAX_PDF_SIZE_MB || 10) * BYTES_IN_MB
    },

    [ContentType.IMAGE]: {
        extensions: IMAGE_EXTENSIONS,
        allowed: ALLOWED_FILE_TYPES.some(t =>
            Object.values(FILE_FORMATS)
                .filter(v => v !== FILE_FORMATS.PDF)
                .includes(t)
        ),
        maxSizeBytes:
            Number(process.env.MAX_IMAGE_SIZE_MB || 5) * BYTES_IN_MB
    }
};