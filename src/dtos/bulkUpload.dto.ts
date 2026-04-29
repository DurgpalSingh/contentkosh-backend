import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export interface ParseError {
  position: number;
  message: string;
}

export interface ParsedQuestion {
  questionText: string;
  type: string;
  options: string[];
  answer: string;
  solution: string | null;
}

export interface InvalidBlock {
  position: number;
  rawText: string;
  errors: string[];
}

export interface PreviewResponse {
  validQuestions: ParsedQuestion[];
  invalidQuestions: InvalidBlock[];
  sessionToken: string;
}

export class BulkUploadConfirmDto {
  @IsString()
  @IsNotEmpty()
  sessionToken!: string;

  @IsString()
  @IsNotEmpty()
  testId!: string;

  @IsIn(['practice', 'exam'])
  testType!: 'practice' | 'exam';
}
