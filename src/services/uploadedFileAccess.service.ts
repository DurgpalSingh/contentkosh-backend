import { UserRole } from '@prisma/client';
import { IUser } from '../dtos/auth.dto';
import { FILE_STORAGE_CONFIG } from '../config/fileStorage.config';
import * as userRepo from '../repositories/user.repo';
import * as businessRepo from '../repositories/business.repo';
import * as courseRepo from '../repositories/course.repo';
import * as testQuestionRepo from '../repositories/testQuestion.repo';
import logger from '../utils/logger';

const { uploadFolders, publicUrlPrefix } = FILE_STORAGE_CONFIG;

type UploadedFileRequest = {
  viewer: IUser;
  /** Path stored in the DB for this file, e.g. `/uploads/profile/profilePicture-1.png`. */
  storedPublicPath: string;
  /** Segments after the folder name, e.g. `['12', 'editor-1.webp']`. */
  segmentsAfterFolder: string[];
};

type FolderAccessRule = (request: UploadedFileRequest) => Promise<boolean>;

/**
 * Who may load a file under `/uploads/<folder>/...` (email assets are public and never reach this).
 * Images are shared inside a business (logos, profile pictures in member lists, course thumbnails,
 * images in questions), so the rule is "logged in and the file belongs to your business".
 */
const FOLDER_ACCESS_RULES: Record<string, FolderAccessRule> = {
  // Batch content is downloaded only through GET /api/contents/:id/file, which checks batch access.
  [uploadFolders.content]: async () => false,

  [uploadFolders.profilePictures]: async ({ viewer, storedPublicPath }) => {
    const owner = await userRepo.findProfilePictureOwner(storedPublicPath);
    return Boolean(owner) && (owner!.id === viewer.id || owner!.businessId === viewer.businessId);
  },

  [uploadFolders.businessLogos]: async ({ viewer, storedPublicPath }) => {
    const business = await businessRepo.findBusinessByLogoPath(storedPublicPath);
    return business?.id === viewer.businessId;
  },

  // Course and question lookups run in the viewer's own tenant schema, so a match means same business.
  [uploadFolders.courseThumbnails]: async ({ storedPublicPath }) =>
    Boolean(await courseRepo.findCourseByThumbnailPath(storedPublicPath)),

  [uploadFolders.questionMedia]: async ({ storedPublicPath }) =>
    Boolean(await testQuestionRepo.findQuestionMediaReference(storedPublicPath)),

  // New editor images live in `editor/<businessId>/`; older ones (no business folder) stay readable to any logged-in user.
  [uploadFolders.editorImages]: async ({ viewer, segmentsAfterFolder }) =>
    segmentsAfterFolder.length === 1 || segmentsAfterFolder[0] === String(viewer.businessId),
};

/** Splits `/profile/a.png` into folder + rest; null for traversal attempts or malformed paths. */
function parseUploadRequestPath(requestPath: string): { folder: string; segmentsAfterFolder: string[] } | null {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  const segments = decodedPath.split('/').filter(Boolean);
  if (segments.length < 2 || segments.some((segment) => segment === '..' || segment.includes('\\'))) return null;
  const [folder, ...segmentsAfterFolder] = segments;
  return { folder: folder!, segmentsAfterFolder };
}

export async function canViewUploadedFile(viewer: IUser, requestPath: string): Promise<boolean> {
  const parsedPath = parseUploadRequestPath(requestPath);
  const accessRule = parsedPath ? FOLDER_ACCESS_RULES[parsedPath.folder] : undefined;
  if (!parsedPath || !accessRule) return false;
  const isContentFile = parsedPath.folder === uploadFolders.content;
  if (viewer.role === UserRole.SUPERADMIN && !isContentFile) return true;

  const isAllowed = await accessRule({
    viewer,
    storedPublicPath: `${publicUrlPrefix}/${parsedPath.folder}/${parsedPath.segmentsAfterFolder.join('/')}`,
    segmentsAfterFolder: parsedPath.segmentsAfterFolder,
  });
  if (!isAllowed) {
    logger.warn(`[uploaded-file-access] denied userId=${viewer.id} businessId=${viewer.businessId} path=${requestPath}`);
  }
  return isAllowed;
}
