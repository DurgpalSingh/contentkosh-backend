import { IsString, IsNotEmpty, IsOptional, IsInt, MaxLength, IsEnum, IsDateString, IsBoolean, Min } from 'class-validator';
import { CourseStatus } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateCourseDto {
    @IsString()
    @IsNotEmpty({ message: 'Course name is required' })
    @MaxLength(100, { message: 'Course name must be shorter than 100 characters' })
    name!: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    description?: string;

    @IsString()
    @IsOptional()
    thumbnail?: string | null;

    @Transform(({ value }) => value === undefined || value === null || value === '' ? undefined : Number(value))
    @IsInt({ message: 'Price must be a whole number' })
    @Min(0, { message: 'Price cannot be negative' })
    @IsOptional()
    price?: number;

    @IsDateString()
    @IsOptional()
    startDate?: string | Date;

    @IsDateString()
    @IsOptional()
    endDate?: string | Date;

    @IsEnum(CourseStatus)
    @IsOptional()
    status?: CourseStatus;

    @IsInt()
    @IsNotEmpty({ message: 'Exam ID is required' })
    examId!: number;
}

export class UpdateCourseDto {
    @IsString()
    @IsOptional()
    @IsNotEmpty({ message: 'Course name cannot be empty' })
    @MaxLength(100)
    name?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    description?: string;

    @IsString()
    @IsOptional()
    thumbnail?: string | null;

    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    @IsOptional()
    removeThumbnail?: boolean;

    @Transform(({ value }) => value === undefined || value === null || value === '' ? undefined : Number(value))
    @IsInt({ message: 'Price must be a whole number' })
    @Min(0, { message: 'Price cannot be negative' })
    @IsOptional()
    price?: number;

    @IsDateString()
    @IsOptional()
    startDate?: string | Date;

    @IsDateString()
    @IsOptional()
    endDate?: string | Date;

    @IsEnum(CourseStatus)
    @IsOptional()
    status?: CourseStatus;
}
