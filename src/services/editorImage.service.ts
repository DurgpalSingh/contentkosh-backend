import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { UserRole } from '@prisma/client';
import { BadRequestError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import { UPLOAD_FOLDERS, uploadFolderDir } from '../config/fileStorage.config';
import { EDITOR_IMAGE_UPLOAD_CONFIG } from '../config/file-type';
import { FILE_NAME_RULES, FILE_PATH_REGEX } from '../constants/file.constants';
import { createUniqueFileName } from './fileStorage.service';
import logger from '../utils/logger';

const EDITOR_IMAGES_DIR = uploadFolderDir(UPLOAD_FOLDERS.editorImages);
const INVALID_IMAGE_PATH_MESSAGE = 'Invalid file path';

/** Images inserted in rich-text editors. New images go to `<editorDir>/<businessId>/` so access can be checked per business. */
export class EditorImageService {
  private editorImageFolderFor(businessId: number | null | undefined): string {
    return businessId ? path.join(EDITOR_IMAGES_DIR, String(businessId)) : EDITOR_IMAGES_DIR;
  }

  /** `/uploads/editor/...` from either the stored path or an absolute URL. Malformed input is a 400, not a 500. */
  private toImageUrlPath(imageUrl: string, requester: IUser): string {
    try {
      const imageUrlPath = FILE_PATH_REGEX.ABSOLUTE_HTTP_URL.test(imageUrl) ? new URL(imageUrl).pathname : imageUrl;
      return decodeURIComponent(imageUrlPath);
    } catch {
      logger.warn(`[EditorImageService] delete rejected: malformed url userId=${requester.id} url=${imageUrl}`);
      throw new BadRequestError(INVALID_IMAGE_PATH_MESSAGE);
    }
  }

  /** Converts the uploaded temp file to WebP and returns the image URL path. The temp file is always removed. */
  async uploadImage(tempFilePath: string, businessId: number | null | undefined): Promise<string> {
    const businessImageFolder = this.editorImageFolderFor(businessId);
    const imageFilePath = path
      .join(businessImageFolder, createUniqueFileName(EDITOR_IMAGE_UPLOAD_CONFIG.fileNamePrefix, EDITOR_IMAGE_UPLOAD_CONFIG.outputExtension))
      .replace(FILE_PATH_REGEX.BACKSLASHES, FILE_NAME_RULES.PATH_SEPARATOR);

    try {
      await fs.promises.mkdir(businessImageFolder, { recursive: true });
      await sharp(tempFilePath).webp({ quality: EDITOR_IMAGE_UPLOAD_CONFIG.webpQuality }).toFile(imageFilePath);
    } finally {
      await fs.promises.rm(tempFilePath, { force: true });
    }

    const imageUrlPath = `${FILE_NAME_RULES.PATH_SEPARATOR}${imageFilePath}`;
    logger.info(`[EditorImageService] uploaded businessId=${businessId ?? 'none'} path=${imageUrlPath}`);
    return imageUrlPath;
  }

  /**
   * Deletes an editor image. Accepts the stored URL (absolute or `/uploads/editor/...`). Images in a
   * business folder can only be deleted by that business (or a super admin); older flat images by anyone logged in.
   * A missing file is a no-op.
   */
  async deleteImage(imageUrl: string, requester: IUser): Promise<void> {
    if (!imageUrl) {
      logger.warn(`[EditorImageService] delete rejected: no url userId=${requester.id}`);
      throw new BadRequestError('url is required');
    }

    const imageUrlPath = this.toImageUrlPath(imageUrl, requester);
    const absoluteImagePath = path.resolve(imageUrlPath.replace(FILE_PATH_REGEX.LEADING_SLASHES, ''));
    const absoluteEditorImagesDir = path.resolve(EDITOR_IMAGES_DIR);
    if (!absoluteImagePath.startsWith(absoluteEditorImagesDir + path.sep)) {
      logger.warn(`[EditorImageService] delete rejected: outside editor folder userId=${requester.id} path=${imageUrlPath}`);
      throw new BadRequestError(INVALID_IMAGE_PATH_MESSAGE);
    }

    const pathPartsInsideEditorDir = path.relative(absoluteEditorImagesDir, absoluteImagePath).split(path.sep);
    const ownerBusinessFolder = pathPartsInsideEditorDir.length > 1 ? pathPartsInsideEditorDir[0] : null;
    const isOwnBusinessImage = ownerBusinessFolder === null || ownerBusinessFolder === String(requester.businessId);
    if (!isOwnBusinessImage && requester.role !== UserRole.SUPERADMIN) {
      logger.warn(`[EditorImageService] delete rejected: other business image userId=${requester.id} path=${imageUrlPath}`);
      throw new BadRequestError(INVALID_IMAGE_PATH_MESSAGE);
    }

    await fs.promises.rm(absoluteImagePath, { force: true });
    logger.info(`[EditorImageService] deleted userId=${requester.id} path=${imageUrlPath}`);
  }
}

export const editorImageService = new EditorImageService();
