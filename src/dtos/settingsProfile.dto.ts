import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';
import { Gender } from '@prisma/client';
import { plainToInstance } from 'class-transformer';

const parseJsonObject = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export class SettingsUserDetailsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string | null;
}

export class TeacherProfileDetailsDto {
  @IsOptional()
  @IsString()
  qualification?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  languages?: string[];

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class StudentProfileDetailsDto {
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsArray()
  languages?: string[];

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  bio?: string;
}

export class SettingsProfileDetailsDto extends TeacherProfileDetailsDto {
  @IsOptional()
  @IsString()
  city?: string;
}

export class BusinessDetailsDto {
  @IsOptional()
  @IsString()
  instituteName?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  logo?: string;
}

export class UpdateSettingsProfileDto {
  @IsOptional()
  @Transform(({ value }) => {
    const parsed = parseJsonObject(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return plainToInstance(SettingsUserDetailsDto, parsed);
  })
  @IsObject()
  userDetails?: Record<string, unknown>;

  @IsOptional()
  @Transform(({ value }) => {
    const parsed = parseJsonObject(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return plainToInstance(SettingsProfileDetailsDto, parsed);
  })
  @IsObject()
  profileDetails?: Record<string, unknown>;

  @IsOptional()
  @Transform(({ value }) => {
    const parsed = parseJsonObject(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return plainToInstance(BusinessDetailsDto, parsed);
  })
  @IsObject()
  businessDetails?: Record<string, unknown>;
}
