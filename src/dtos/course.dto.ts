import { IsString, IsNotEmpty, IsOptional, IsInt, MaxLength, IsEnum } from 'class-validator';
import { CourseStatus } from '@prisma/client';

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
    @MaxLength(50)
    duration?: string;

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
    @MaxLength(50)
    duration?: string;

    @IsEnum(CourseStatus)
    @IsOptional()
    status?: CourseStatus;
}
