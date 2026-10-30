import * as path from 'path';

const UPLOADS_FOLDER_NAME = 'uploads';

/** Feature folders directly under `uploads/`. Access to each is decided in uploadedFileAccess.service. */
export const UPLOAD_FOLDERS = {
  publicAssets: 'assets',
  content: 'content',
  profilePictures: 'profile',
  businessLogos: 'business',
  courseThumbnails: 'courses',
  editorImages: 'editor',
  questionMedia: 'questions',
  subjectiveTests: 'subjective',
  temporaryUploads: 'tmp',
} as const;

export type UploadFolderName = (typeof UPLOAD_FOLDERS)[keyof typeof UPLOAD_FOLDERS];

/**
 * `uploads/<folder>` relative to the working directory. Multer destinations use this relative form
 * because the resulting `file.path` is what features store in the DB (e.g. `uploads/content/file-1.pdf`).
 */
export const uploadFolderDir = (folder: UploadFolderName): string => path.join(UPLOADS_FOLDER_NAME, folder);

const absoluteUploadFolderDir = (folder: UploadFolderName): string => path.resolve(process.cwd(), uploadFolderDir(folder));

/**
 * All uploaded files live under `uploads/`.
 *
 * - `uploads/assets` is the only folder served without login (email logo/icons).
 * - Other folders are served only to logged-in users, per-folder rules in uploadedFileAccess.service.
 * - API-only folders (`content`, `subjective`, `tmp`) are never served by URL; their features stream them.
 */
export const FILE_STORAGE_CONFIG = {
  uploadsRootDir: path.resolve(process.cwd(), UPLOADS_FOLDER_NAME),
  publicAssetsDir: absoluteUploadFolderDir(UPLOAD_FOLDERS.publicAssets),
  /** Multer writes uploads here first when they need conversion or validation before their final key. */
  uploadsTempDir: absoluteUploadFolderDir(UPLOAD_FOLDERS.temporaryUploads),
  publicUrlPrefix: `/${UPLOADS_FOLDER_NAME}`,
  publicAssetsUrlPrefix: `/${UPLOADS_FOLDER_NAME}/${UPLOAD_FOLDERS.publicAssets}`,
  uploadFolders: UPLOAD_FOLDERS,
} as const;
