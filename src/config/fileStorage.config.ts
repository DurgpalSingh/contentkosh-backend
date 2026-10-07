import * as path from 'path';

const resolveFromCwd = (relativeOrAbsolute: string) => path.resolve(process.cwd(), relativeOrAbsolute);

/**
 * Where uploaded files live on disk.
 *
 * - `publicAssetsDir` is the only folder served without login (email logo/icons).
 * - `uploadsRootDir` is served only to logged-in users, per-folder rules in uploadedFileAccess.service.
 * - `privateUploadsRootDir` is never served by URL; files are streamed by feature endpoints only.
 */
export const FILE_STORAGE_CONFIG = {
  uploadsRootDir: resolveFromCwd('uploads'),
  publicAssetsDir: resolveFromCwd('uploads/assets'),
  privateUploadsRootDir: resolveFromCwd('private-uploads'),
  contentUploadDir: resolveFromCwd(process.env.UPLOAD_DIR || 'uploads/content'),
  /** Multer writes here first; files are moved to their final key only after validation. */
  privateTempSubDir: 'tmp',
  publicUrlPrefix: '/uploads',
  publicAssetsUrlPrefix: '/uploads/assets',
  /** First path segment under `uploads/`; each folder has its own access rule. */
  uploadFolders: {
    content: 'content',
    profilePictures: 'profile',
    businessLogos: 'business',
    courseThumbnails: 'courses',
    editorImages: 'editor',
    questionMedia: 'questions',
  },
} as const;
