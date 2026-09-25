import { IsInt, IsNotEmpty, IsString, MaxLength, Min, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

const toNumber = (value: unknown): number => Number(value);

export class QueryKnowledgeBaseDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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

export class SaveAIChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  userMessage!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  assistantResponse!: string;

  @IsOptional()
  source?: KnowledgeBaseQueryResponse;
}

export class GetAIChatDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value ? toNumber(value) : undefined))
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => (value ? toNumber(value) : undefined))
  offset?: number;
}

export type AIChatStatusDto = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface AIChatResponseDto {
  id: number;
  userId: number;
  businessId: number;
  userMessage: string;
  assistantResponse: string | null;
  source?: KnowledgeBaseQueryResponse | null;
  status: AIChatStatusDto;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIChatListResponseDto {
  data: AIChatResponseDto[];
  total: number;
  limit: number;
  offset: number;
}
