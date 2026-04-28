import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { BadRequestError } from '../errors/api.errors';
import { ContentType } from '@prisma/client';
import { AuthRequest } from '../dtos/auth.dto';

import { FILE_TYPE_CONFIG, IMAGE_UPLOAD_CONFIG } from '../config/file-type';

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
  extensions: config.extensions,
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
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Ignore cleanup errors to avoid masking validation failures.
  }
};

const ensureDirExists = (dir: string) => {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    // Let callers surface errors when needed; keep it silent for now.
  }
};

const getFirstFileFromRecord = (files?: Record<string, Express.Multer.File[]>, keys?: string[]) => {
  if (!files || !keys) return undefined;
  for (const k of keys) {
    const f = files[k];
    if (f && f.length > 0) return f[0];
  }
  return undefined;
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

// Normalize upload-related errors into consistent API errors.
const normalizeUploadError = (error: any, next: NextFunction) => {
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
      return normalizeUploadError(error, next);
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

const profileFieldConfigs = {
  [IMAGE_UPLOAD_CONFIG.profilePicture.fieldName]: IMAGE_UPLOAD_CONFIG.profilePicture,
  profilePhoto: IMAGE_UPLOAD_CONFIG.profilePicture,
  [IMAGE_UPLOAD_CONFIG.businessLogo.fieldName]: IMAGE_UPLOAD_CONFIG.businessLogo
} as const;

type ProfileFieldName = keyof typeof profileFieldConfigs;
const PROFILE_PICTURE_FIELD_ALIASES = [IMAGE_UPLOAD_CONFIG.profilePicture.fieldName, 'profilePhoto'] as const;
const BUSINESS_LOGO_FIELD_NAMES = [IMAGE_UPLOAD_CONFIG.businessLogo.fieldName] as const;

const createImageFieldsUpload = () =>
  multer({
    storage: profileStorage,
    fileFilter: (req, file, cb) => {
      const authReq = req as AuthRequest;
      if (file.fieldname === IMAGE_UPLOAD_CONFIG.businessLogo.fieldName && authReq.user?.role !== 'ADMIN') {
        return cb(new BadRequestError('Only admin can upload business logo'));
      }
      const field = file.fieldname as ProfileFieldName;
      const config = profileFieldConfigs[field];
      if (!config) {
        return cb(new BadRequestError('Unexpected image field'));
      }
      const ext = path.extname(file.originalname).toLowerCase();
      if (!config.extensions.includes(ext)) {
        return cb(new BadRequestError(`Invalid file type for ${file.fieldname}`));
      }
      if (!config.mimeTypes.includes(file.mimetype)) {
        return cb(new BadRequestError(`Invalid mime type for ${file.fieldname}`));
      }
      cb(null, true);
    },
    limits: {
      fileSize: Math.max(
        IMAGE_UPLOAD_CONFIG.profilePicture.maxSizeBytes,
        IMAGE_UPLOAD_CONFIG.businessLogo.maxSizeBytes
      )
    }
  });

for (const cfg of Object.values(profileFieldConfigs)) {
  ensureDirExists(cfg.uploadDir);
}

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const field = file.fieldname as ProfileFieldName;
    const config = profileFieldConfigs[field];
    if (!config) return cb(new BadRequestError('Unexpected image field'), '');
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const profileUpload = createImageFieldsUpload();

export const uploadProfileAssets = (req: Request, res: Response, next: NextFunction) => {
  profileUpload.fields([
    { name: IMAGE_UPLOAD_CONFIG.profilePicture.fieldName, maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 },
    { name: IMAGE_UPLOAD_CONFIG.businessLogo.fieldName, maxCount: 1 }
  ])(req, res, (error: any) => {
    if (error) return normalizeUploadError(error, next);

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    // Validate each configured field
    for (const [fieldName, cfg] of Object.entries(profileFieldConfigs)) {
      const file = files?.[fieldName]?.[0];
      if (!file) continue;
      if (file.size > cfg.maxSizeBytes) {
        removeUploadedFile(file.path);
        return next(new BadRequestError(`File size cannot exceed ${formatSizeInMb(cfg.maxSizeBytes)} for ${fieldName}`));
      }
    }

    next();
  });
};

const toPublicAssetPath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const parseBodyJsonObject = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  return {};
};

export const mapProfileUploadToSettingsPayload = (req: Request, res: Response, next: NextFunction) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const profilePictureFile = getFirstFileFromRecord(files, [...PROFILE_PICTURE_FIELD_ALIASES]);
  const businessLogoFile = getFirstFileFromRecord(files, [...BUSINESS_LOGO_FIELD_NAMES]);

  const userDetails = parseBodyJsonObject(req.body.userDetails);
  const profileDetails = parseBodyJsonObject(req.body.profileDetails);
  const businessDetails = parseBodyJsonObject(req.body.businessDetails);

  if (profilePictureFile) userDetails.profilePicture = toPublicAssetPath(profilePictureFile.path);
  if (businessLogoFile) businessDetails.logo = toPublicAssetPath(businessLogoFile.path);

  req.body.userDetails = Object.keys(userDetails).length > 0 ? userDetails : undefined;
  req.body.profileDetails = Object.keys(profileDetails).length > 0 ? profileDetails : undefined;
  req.body.businessDetails = Object.keys(businessDetails).length > 0 ? businessDetails : undefined;

  next();
};
