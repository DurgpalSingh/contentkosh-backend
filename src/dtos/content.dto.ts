import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ContentType, ContentStatus } from '@prisma/client';

export class CreateContentDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

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