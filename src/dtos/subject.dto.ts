import { IsNotEmpty, IsOptional, IsString, MaxLength, IsEnum, IsBoolean, IsInt } from 'class-validator';
import { SubjectStatus } from '@prisma/client';

export class CreateSubjectDto {
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    name!: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNotEmpty()
    @IsInt()
    courseId!: number;

    @IsOptional()
    @IsEnum(SubjectStatus)
    status?: SubjectStatus;
}

export class UpdateSubjectDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(SubjectStatus)
    status?: SubjectStatus;
}
