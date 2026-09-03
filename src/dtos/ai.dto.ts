import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

const toNumber = (value: unknown): number => Number(value);

export class QueryKnowledgeBaseDto {
  @IsInt()
  @Min(1)
  @Transform(({ value }) => toNumber(value))
  courseId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  query!: string;
}

export interface KnowledgeBaseQueryResponse {
  answer: string;
  document_id?: string | null;
  title?: string | null;
  document_type?: string | null;
  tag?: string | null;
  summary?: string | null;
  source?: string | null;
  page?: number | null;
}
