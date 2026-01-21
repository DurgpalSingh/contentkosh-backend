import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { BadRequestError } from '../errors/api.errors';
import { ContentType } from '@prisma/client';

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
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || ['pdf', 'jpg', 'jpeg', 'png'];
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
    fileSize: 10 * 1024 * 1024, // 10MB max (will be validated more specifically in middleware)
  }
});

// Middleware to handle single file upload
export const uploadSingleFile = upload.single('file');

// Middleware to validate file size based on type
export const validateFileSize = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return next(new BadRequestError('No file uploaded'));
  }

  const maxPdfSizeMB = parseInt(process.env.MAX_PDF_SIZE_MB || '10');
  const maxImageSizeMB = parseInt(process.env.MAX_IMAGE_SIZE_MB || '5');
  
  const maxPdfSizeBytes = maxPdfSizeMB * 1024 * 1024;
  const maxImageSizeBytes = maxImageSizeMB * 1024 * 1024;

  const ext = path.extname(req.file.originalname).toLowerCase();
  const fileSize = req.file.size;

  if (ext === '.pdf') {
    if (fileSize > maxPdfSizeBytes) {
      // Delete the uploaded file
      fs.unlinkSync(req.file.path);
      return next(new BadRequestError(`PDF file size cannot exceed ${maxPdfSizeMB}MB`));
    }
    // Set content type in request body
    req.body.type = ContentType.PDF;
  } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
    if (fileSize > maxImageSizeBytes) {
      // Delete the uploaded file
      fs.unlinkSync(req.file.path);
      return next(new BadRequestError(`Image file size cannot exceed ${maxImageSizeMB}MB`));
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