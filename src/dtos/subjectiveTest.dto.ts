import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** Trims text before validation, so `@IsNotEmpty` also rejects whitespace-only values. */
const TrimText = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreateSubjectiveTestDto {
  @IsInt()
  @Min(1)
  batchId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  subjectId?: number;

  @TrimText()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @TrimText()
  @IsString()
  @IsNotEmpty()
  paperType!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsNumber()
  @IsPositive()
  totalMarks!: number;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  deadlineAt!: string;
}

export class UpdateSubjectiveTestDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  batchId?: number;

  /** `null` clears the subject. */
  @IsOptional()
  @IsInt()
  @Min(1)
  subjectId?: number | null;

  @TrimText()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @TrimText()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  paperType?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  instructions?: string | null;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  totalMarks?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  deadlineAt?: string;
}

export class PublishSubjectiveTestRequestDto {
  @IsString()
  @IsNotEmpty()
  subjectiveTestId!: string;
}

export class GradeSubjectiveSubmissionDto {
  @IsNumber()
  @Min(0)
  marksAwarded!: number;

  @TrimText()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string | null;
}
