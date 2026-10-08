import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { UserRole } from '@prisma/client';
import { BadRequestError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import { UPLOAD_FOLDERS, uploadFolderDir } from '../config/fileStorage.config';
import { createUniqueFileName } from './fileStorage.service';
import logger from '../utils/logger';

const EDITOR_IMAGE_DIR = uploadFolderDir(UPLOAD_FOLDERS.editorImages);

// Ensure the output directory exists at startup
try {
  if (!fs.existsSync(EDITOR_IMAGE_DIR)) {
    fs.mkdirSync(EDITOR_IMAGE_DIR, { recursive: true });
  }
} catch (err) {
  logger.error('[EditorImageService] Failed to create upload directory', err);
}

/** Images inserted in rich-text editors. New images go to `<editorDir>/<businessId>/` so access can be checked per business. */
export class EditorImageService {
  private editorFolderFor(businessId: number | null | undefined): string {
    return businessId ? path.join(EDITOR_IMAGE_DIR, String(businessId)) : EDITOR_IMAGE_DIR;
  }

  /** Converts the uploaded temp file to WebP, removes the temp file, and returns the image URL path. */
  async uploadImage(tempFilePath: string, businessId: number | null | undefined): Promise<string> {
    const businessFolder = this.editorFolderFor(businessId);
    await fs.promises.mkdir(businessFolder, { recursive: true });
    const outputPath = path
      .join(businessFolder, createUniqueFileName('editor', '.webp'))
      .replace(/\\/g, '/');

    await sharp(tempFilePath).webp({ quality: 80 }).toFile(outputPath);
    await fs.promises.rm(tempFilePath, { force: true });

    const imageUrlPath = `/${outputPath}`;
    logger.info(`[EditorImageService] uploaded businessId=${businessId ?? 'none'} path=${imageUrlPath}`);
    return imageUrlPath;
  }

  /**
   * Deletes an editor image. Accepts the stored URL (absolute or `/uploads/editor/...`). Images in a
   * business folder can only be deleted by that business (or a super admin); older flat images by anyone logged in.
   */
  deleteImage(imageUrl: string, viewer: IUser): void {
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new BadRequestError('url is required');
    }

    const imagePath = /^https?:\/\//i.test(imageUrl) ? new URL(imageUrl).pathname : imageUrl;
    const resolvedImagePath = path.resolve(decodeURIComponent(imagePath).replace(/^\/+/, ''));
    const editorDir = path.resolve(EDITOR_IMAGE_DIR);
    if (!resolvedImagePath.startsWith(editorDir + path.sep)) {
      throw new BadRequestError('Invalid file path');
    }

    const pathInsideEditorDir = path.relative(editorDir, resolvedImagePath).split(path.sep);
    const ownerBusinessFolder = pathInsideEditorDir.length > 1 ? pathInsideEditorDir[0] : null;
    const isOwnBusinessImage = ownerBusinessFolder === null || ownerBusinessFolder === String(viewer.businessId);
    if (!isOwnBusinessImage && viewer.role !== UserRole.SUPERADMIN) {
      logger.warn(`[EditorImageService] delete denied userId=${viewer.id} path=${imagePath}`);
      throw new BadRequestError('Invalid file path');
    }

    if (fs.existsSync(resolvedImagePath)) {
      fs.unlinkSync(resolvedImagePath);
      logger.info(`[EditorImageService] deleted userId=${viewer.id} path=${imagePath}`);
    }
  }
}

export const editorImageService = new EditorImageService();
