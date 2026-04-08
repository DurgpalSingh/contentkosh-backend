import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TestLanguage } from '@prisma/client';

export class CreatePracticeTestDto {
  @IsInt()
  @Min(1)
  batchId!: number;

  @IsInt()
  @Min(1)
  subjectId!: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(TestLanguage)
  language!: TestLanguage;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number; // 0 DRAFT, 1 PUBLISHED

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultMarksPerQuestion?: number;

  @IsOptional()
  @IsBoolean()
  showExplanations?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;
}

export class UpdatePracticeTestDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  batchId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  subjectId?: number;

  @IsOptional()
  @IsEnum(TestLanguage)
  language?: TestLanguage;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultMarksPerQuestion?: number;

  @IsOptional()
  @IsBoolean()
  showExplanations?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;
}

export class CreateExamTestDto {
  @IsInt()
  @Min(1)
  batchId!: number;

  @IsInt()
  @Min(1)
  subjectId!: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  deadlineAt!: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultMarksPerQuestion?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  negativeMarksPerQuestion?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  resultVisibility?: number; // 0 AFTER_DEADLINE, 1 HIDDEN

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @IsEnum(TestLanguage)
  language!: TestLanguage;
}

export class UpdateExamTestDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  batchId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  subjectId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  deadlineAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultMarksPerQuestion?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  negativeMarksPerQuestion?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  resultVisibility?: number;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @IsOptional()
  @IsEnum(TestLanguage)
  language?: TestLanguage;
}

export class PublishPracticeTestRequestDto {
  @IsString()
  @IsNotEmpty()
  practiceTestId!: string;
}

export class PublishExamTestRequestDto {
  @IsString()
  @IsNotEmpty()
  examTestId!: string;
}

export class TestOptionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;
}

export class CreateQuestionDto {
  @IsInt()
  @Min(0)
  @Max(4)
  type!: number;

  @IsString()
  @IsNotEmpty()
  questionText!: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @ValidateIf((o) => o.type === 0 || o.type === 1)
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => TestOptionDto)
  options?: TestOptionDto[];

  @ValidateIf((o) => o.type === 2 || o.type === 3 || o.type === 4)
  @IsString()
  @IsNotEmpty()
  correctTextAnswer?: string;

  @ValidateIf((o) => o.type === 0 || o.type === 1)
  @IsArray()
  @ArrayMinSize(1)
  correctOptionIdsAnswers?: Array<string | number>;
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  type?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  questionText?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string | null;

  @IsOptional()
  @IsString()
  explanation?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestOptionDto)
  options?: TestOptionDto[];

  @IsOptional()
  @IsString()
  correctTextAnswer?: string | null;

  @IsOptional()
  @IsArray()
  correctOptionIdsAnswers?: Array<string | number>;
}

export class StartPracticeAttemptRequestDto {
  @IsString()
  @IsNotEmpty()
  practiceTestId!: string;

  @IsEnum(TestLanguage)
  language!: TestLanguage;
}

export class StartExamAttemptRequestDto {
  @IsString()
  @IsNotEmpty()
  examTestId!: string;

  @IsEnum(TestLanguage)
  language!: TestLanguage;
}

export class SubmitAttemptAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds?: string[];

  @IsOptional()
  @IsString()
  textAnswer?: string;
}

export class SubmitAttemptRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAttemptAnswerDto)
  answers!: SubmitAttemptAnswerDto[];
}

