import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { BadRequestError } from '../errors/api.errors';
import { ContentType } from '@prisma/client';

import { FILE_TYPE_CONFIG } from '../config/file-type';
import {
  FILE_EXTENSIONS,
  IMAGE_EXTENSIONS
} from '../constants/file.constants';

const BYTES_IN_MB = 1024 * 1024;

const MAX_UPLOAD_SIZE_BYTES = Math.max(
  FILE_TYPE_CONFIG[ContentType.PDF].maxSizeBytes,
  FILE_TYPE_CONFIG[ContentType.IMAGE].maxSizeBytes
);

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
    // Generate unique filename with timestamp
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
  const ext = path.extname(file.originalname).toLowerCase();

  const isPdf = ext === FILE_EXTENSIONS.PDF;
  const isImage = IMAGE_EXTENSIONS.includes(ext);

  if (
    (isPdf && FILE_TYPE_CONFIG[ContentType.PDF].allowed) ||
    (isImage && FILE_TYPE_CONFIG[ContentType.IMAGE].allowed)
  ) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`File type .${ext} is not allowed.`));
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES, // 10MB max (will be validated more specifically in middleware)
  }
});

// Middleware to handle single file upload
export const uploadSingleFile = upload.single('file');

// Middleware to validate file size based on type
export const validateFileSize = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return next(new BadRequestError('No file uploaded'));
  }

  const fileSize = req.file.size;
  const ext = path.extname(req.file.originalname).toLowerCase();

  if (ext === FILE_EXTENSIONS.PDF) {
    const config = FILE_TYPE_CONFIG[ContentType.PDF];

    if (fileSize > config.maxSizeBytes) {
      fs.unlinkSync(req.file.path);
      return next(new BadRequestError(`PDF file size cannot exceed ${config.maxSizeBytes / BYTES_IN_MB}MB`));
    }
    // Set content type in request body
    req.body.type = ContentType.PDF;
  } else if (IMAGE_EXTENSIONS.includes(ext)) {
    const config = FILE_TYPE_CONFIG[ContentType.IMAGE];

    if (fileSize > config.maxSizeBytes) {
      fs.unlinkSync(req.file.path);
      return next(new BadRequestError(`Image file size cannot exceed ${config.maxSizeBytes / BYTES_IN_MB}MB`));
    }
    // Set content type in request body
    req.body.type = ContentType.IMAGE;
  } else {
    // Delete the uploaded file
    fs.unlinkSync(req.file.path);
    return next(new BadRequestError('Invalid file type'));
  }

  // Add file info to request body
  req.body.filePath = req.file.path;
  req.body.fileSize = req.file.size;

  next();
};

// Middleware to handle upload errors
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(new BadRequestError('File size too large'));
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new BadRequestError('Unexpected file field'));
    }
    return next(new BadRequestError(`Upload error: ${error.message}`));
  }
  next(error);
};