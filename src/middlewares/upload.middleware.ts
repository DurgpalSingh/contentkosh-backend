import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { BadRequestError } from '../errors/api.errors';
import { ContentType } from '@prisma/client';

import { FILE_TYPE_CONFIG } from '../config/file-type';

const BYTES_IN_MB = 1024 * 1024;

type UploadRule = {
  contentType: ContentType;
  extensions: string[];
  allowed: boolean;
  maxSizeBytes: number;
};

const configuredRules: UploadRule[] = (
  Object.entries(FILE_TYPE_CONFIG) as [ContentType, (typeof FILE_TYPE_CONFIG)[ContentType]][]
).map(([contentType, config]) => ({
  contentType,
  extensions: config.extensions.map(ext => ext.toLowerCase()),
  allowed: config.allowed,
  maxSizeBytes: config.maxSizeBytes
}));

const activeRules = configuredRules.filter(rule => rule.allowed);

const extensionToRule = new Map<string, UploadRule>();
for (const rule of activeRules) {
  for (const ext of rule.extensions) {
    extensionToRule.set(ext, rule);
  }
}

const maxUploadSizeBytes = Math.max(
  ...configuredRules.map(rule => rule.maxSizeBytes),
  BYTES_IN_MB
);

const formatSizeInMb = (sizeBytes: number): string => {
  const mb = sizeBytes / BYTES_IN_MB;
  return Number.isInteger(mb) ? `${mb}MB` : `${mb.toFixed(2)}MB`;
};

const acceptedExtensions = Array.from(extensionToRule.keys()).sort();

const acceptedExtensionsLabel =
  acceptedExtensions.length > 0
    ? acceptedExtensions.join(', ')
    : 'none';

const limitsByTypeLabel = activeRules
  .map(rule => `${rule.contentType}: ${formatSizeInMb(rule.maxSizeBytes)}`)
  .join(', ');

const removeUploadedFile = (filePath?: string): void => {
  if (!filePath) {
    return;
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors to avoid masking validation failures.
  }
};

const getRuleByOriginalName = (originalname: string): UploadRule | undefined => {
  const ext = path.extname(originalname).toLowerCase();
  return extensionToRule.get(ext);
};

const getRejectedUploadMessage = (req: Request): string | undefined => {
  return (req as any).__uploadRejectedMessage as string | undefined;
};

const setRejectedUploadMessage = (req: Request, message: string): void => {
  (req as any).__uploadRejectedMessage = message;
};

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || 'uploads/content';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter: multer.Options['fileFilter'] = (
  req,
  file,
  cb
) => {
  const ext = path.extname(file.originalname).toLowerCase() || '(no extension)';
  const rule = getRuleByOriginalName(file.originalname);

  if (!rule) {
    setRejectedUploadMessage(
      req as Request,
      `File type ${ext} is not accepted. Allowed types: ${acceptedExtensionsLabel}.`
    );
    return cb(null, false);
  }

  cb(null, true);
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    // Global hard cap. Type-specific limits are validated in validateFileSize.
    fileSize: maxUploadSizeBytes,
  }
});

// Middleware to normalize upload errors
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(
        new BadRequestError(
          `File is too large. Maximum upload size is ${formatSizeInMb(maxUploadSizeBytes)}. ` +
          `Allowed size by type: ${limitsByTypeLabel}.`
        )
      );
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new BadRequestError('Unexpected file field. Use field name "file".'));
    }

    return next(new BadRequestError(`Upload error: ${error.message}`));
  }

  next(error);
};

// Middleware to handle single file upload with explicit error bridging
export const uploadSingleFile = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (error: any) => {
    if (error) {
      return handleUploadError(error, req, res, next);
    }

    const rejectedMessage = getRejectedUploadMessage(req);
    if (rejectedMessage) {
      return next(new BadRequestError(rejectedMessage));
    }

    next();
  });
};

// Middleware to validate file size based on resolved content type
export const validateFileSize = (req: Request, res: Response, next: NextFunction) => {
  const rejectedMessage = getRejectedUploadMessage(req);
  if (rejectedMessage) {
    return next(new BadRequestError(rejectedMessage));
  }

  if (!req.file) {
    return next(new BadRequestError('No file uploaded'));
  }

  const rule = getRuleByOriginalName(req.file.originalname);

  if (!rule) {
    removeUploadedFile(req.file.path);
    return next(
      new BadRequestError(
        `File type is not accepted. Allowed types: ${acceptedExtensionsLabel}.`
      )
    );
  }

  if (req.file.size > rule.maxSizeBytes) {
    removeUploadedFile(req.file.path);

    return next(
      new BadRequestError(
        `File size cannot exceed ${formatSizeInMb(rule.maxSizeBytes)} for ${rule.contentType} files.`
      )
    );
  }

  req.body.type = rule.contentType;
  req.body.filePath = req.file.path;
  req.body.fileSize = req.file.size;

  next();
};
