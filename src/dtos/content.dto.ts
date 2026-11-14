import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ContentType, ContentStatus } from '@prisma/client';
import { CONTENT_BULK_UPLOAD_MAX_FILES } from '../constants/file.constants';

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return undefined;
  return asNumber;
};

export class CreateContentDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => toOptionalNumber(value))
  subjectId?: number;

  @IsEnum(ContentType)
  type!: ContentType;

  @IsString()
  @IsNotEmpty()
  filePath!: string;

  @IsInt()
  @Min(1)
  fileSize!: number;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

export class BulkContentFileDto {
  @IsString()
  @IsNotEmpty({ message: 'Each file must have a title' })
  @MaxLength(100, { message: 'Content title must not exceed 100 characters' })
  title!: string;

  @IsEnum(ContentType)
  type!: ContentType;

  @IsString()
  @IsNotEmpty()
  filePath!: string;

  @IsInt()
  @Min(1)
  fileSize!: number;
}

export class CreateBulkContentDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one file is required' })
  @ArrayMaxSize(CONTENT_BULK_UPLOAD_MAX_FILES, {
    message: `You can upload up to ${CONTENT_BULK_UPLOAD_MAX_FILES} files at once`
  })
  @ValidateNested({ each: true })
  @Type(() => BulkContentFileDto)
  items!: BulkContentFileDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => toOptionalNumber(value))
  subjectId?: number;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

export class UpdateContentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => toOptionalNumber(value))
  subjectId?: number;
}

export class ContentQueryDto {
  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsString()
  search?: string;
}