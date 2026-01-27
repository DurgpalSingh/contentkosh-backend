import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { BadRequestError } from '../errors/api.errors';
import { ContentType } from '@prisma/client';

const DEFAULT_ALLOWED_FILE_TYPES = ['pdf', 'jpg', 'jpeg', 'png'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const PDF_EXTENSION = '.pdf';

const BYTES_IN_MB = 1024 * 1024;

const MAX_PDF_SIZE_MB = parseInt(process.env.MAX_PDF_SIZE_MB || '10', 10);
const MAX_IMAGE_SIZE_MB = parseInt(process.env.MAX_IMAGE_SIZE_MB || '5', 10);

// Multer needs ONE max size; use the larger of the two
const MAX_UPLOAD_SIZE_BYTES =
  Math.max(MAX_PDF_SIZE_MB, MAX_IMAGE_SIZE_MB) * BYTES_IN_MB;

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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes =
    process.env.ALLOWED_FILE_TYPES?.split(',') ||
    DEFAULT_ALLOWED_FILE_TYPES;

  const ext = path.extname(file.originalname).toLowerCase().substring(1);
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`File type .${ext} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
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

  if (ext === PDF_EXTENSION) {
    if (fileSize > MAX_PDF_SIZE_MB * BYTES_IN_MB) {
      fs.unlinkSync(req.file.path);
      return next(new BadRequestError(`PDF file size cannot exceed ${MAX_PDF_SIZE_MB}MB`));
    }
    // Set content type in request body
    req.body.type = ContentType.PDF;
  } else if (IMAGE_EXTENSIONS.includes(ext)) {
    if (fileSize > MAX_IMAGE_SIZE_MB * BYTES_IN_MB) {
      fs.unlinkSync(req.file.path);
      return next(new BadRequestError(`Image file size cannot exceed ${MAX_IMAGE_SIZE_MB}MB`));
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