import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsInt, 
  Min, 
  IsEnum,
  IsArray,
  IsDateString,
  ValidateNested
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TeacherStatus } from '@prisma/client';

export class ProfessionalDetailsDto {
  @IsString()
  @IsNotEmpty({ message: 'Qualification is required' })
  @Transform(({ value }) => value?.trim())
  qualification!: string;

  @IsInt()
  @Min(0, { message: 'Experience years must be at least 0' })
  experienceYears!: number;

  @IsString()
  @IsNotEmpty({ message: 'Designation is required' })
  @Transform(({ value }) => value?.trim())
  designation!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  bio?: string;

  @IsOptional()
  @IsArray({ message: 'Languages must be an array' })
  @IsString({ each: true, message: 'Each language must be a string' })
  languages?: string[];
}

export class PersonalDetailsDto {
  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  address?: string;
}

export class CreateTeacherDto {
  @IsInt()
  @Min(1, { message: 'User ID must be a positive integer' })
  userId!: number;

  @IsInt()
  @Min(1, { message: 'Business ID must be a positive integer' })
  businessId!: number;

  @ValidateNested()
  @Type(() => ProfessionalDetailsDto)
  professional!: ProfessionalDetailsDto;

  @ValidateNested()
  @Type(() => PersonalDetailsDto)
  @IsOptional()
  personal?: PersonalDetailsDto;
}

export class UpdateTeacherDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfessionalDetailsDto)
  professional?: ProfessionalDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalDetailsDto)
  personal?: PersonalDetailsDto;

  @IsOptional()
  @IsEnum(TeacherStatus, { message: 'Valid status is required (ACTIVE, INACTIVE)' })
  status?: TeacherStatus;
}

// Response DTO
export class TeacherResponseDto {
  id!: number;
  userId!: number;
  businessId!: number;
  qualification!: string;
  experienceYears!: number;
  designation!: string;
  bio?: string;
  languages?: string[];
  gender?: string;
  dob?: Date;
  address?: string;
  status!: TeacherStatus;
  createdAt!: Date;
  updatedAt!: Date;
  createdBy?: number;
  updatedBy?: number;
}
