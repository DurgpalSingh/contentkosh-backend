import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
  IsArray,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender, StudentStatus } from '@prisma/client';

export class CreateStudentDto {
  @IsInt()
  @Min(1, { message: 'User ID must be a positive integer' })
  userId!: number;

  @IsInt()
  @Min(1, { message: 'Business ID must be a positive integer' })
  businessId!: number;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Gender must be one of: male, female, other' })
  gender?: Gender;

  @IsOptional()
  @IsArray({ message: 'Languages must be an array' })
  @IsString({ each: true, message: 'Each language must be a string' })
  languages?: string[];

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  address?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  city?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  bio?: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Gender must be one of: male, female, other' })
  gender?: Gender;

  @IsOptional()
  @IsArray({ message: 'Languages must be an array' })
  @IsString({ each: true, message: 'Each language must be a string' })
  languages?: string[];

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  address?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  city?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  bio?: string;

  @IsOptional()
  @IsEnum(StudentStatus, { message: 'Valid status is required (ACTIVE, INACTIVE)' })
  status?: StudentStatus;
}

export class StudentResponseDto {
  id!: number;
  userId!: number;
  businessId!: number;
  dob?: Date;
  gender?: Gender;
  languages?: string[];
  address?: string;
  city?: string;
  bio?: string;
  status!: StudentStatus;
  createdAt!: Date;
  updatedAt!: Date;
  createdBy?: number;
  updatedBy?: number;
  user?: {
    id: number;
    name: string;
    email: string;
    mobile?: string;
    role: string;
  };
}
