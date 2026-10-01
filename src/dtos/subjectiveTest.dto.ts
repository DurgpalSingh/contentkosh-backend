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

export class CreateSubjectiveTestDto {
  @IsInt()
  @Min(1)
  batchId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  subjectId?: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

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

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string | null;
}
