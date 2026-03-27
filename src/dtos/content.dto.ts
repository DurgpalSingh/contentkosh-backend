import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ContentType, ContentStatus } from '@prisma/client';

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

  @IsInt()
  @Min(1)
  @Transform(({ value }) => toOptionalNumber(value))
  subjectId!: number;

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

export class UpdateContentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsInt()
  @Min(1)
  @Transform(({ value }) => toOptionalNumber(value))
  subjectId!: number;
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