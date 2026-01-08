import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsDateString, IsInt, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBatchDto {
    @IsNotEmpty({ message: 'Batch code name is required' })
    @IsString({ message: 'Batch code name must be a string' })
    @Transform(({ value }) => value?.trim())
    codeName!: string;

    @IsNotEmpty({ message: 'Batch display name is required' })
    @IsString()
    @Transform(({ value }) => value?.trim())
    displayName!: string;

    @IsNotEmpty({ message: 'Start date is required' })
    @IsDateString()
    startDate!: string | Date;

    @IsNotEmpty({ message: 'End date is required' })
    @IsDateString()
    endDate!: string | Date;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsNotEmpty({ message: 'Course ID is required' })
    @IsInt()
    @Transform(({ value }) => parseInt(value, 10))
    courseId!: number;
}

export class UpdateBatchDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: 'Batch code name cannot be empty' })
    @Transform(({ value }) => value?.trim())
    codeName?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: 'Batch display name cannot be empty' })
    @Transform(({ value }) => value?.trim())
    displayName?: string;

    @IsOptional()
    @IsDateString()
    @IsNotEmpty({ message: 'Start date cannot be empty' })
    startDate?: string | Date;

    @IsOptional()
    @IsDateString()
    @IsNotEmpty({ message: 'End date cannot be empty' })
    endDate?: string | Date;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class AddUserToBatchDto {
    @IsNotEmpty()
    @IsInt()
    @Transform(({ value }) => parseInt(value, 10))
    userId!: number;

    @IsNotEmpty()
    @IsInt()
    @Transform(({ value }) => parseInt(value, 10))
    batchId!: number;
}

export class RemoveUserFromBatchDto {
    @IsNotEmpty()
    @IsInt()
    @Transform(({ value }) => parseInt(value, 10))
    userId!: number;

    @IsNotEmpty()
    @IsInt()
    @Transform(({ value }) => parseInt(value, 10))
    batchId!: number;
}

export class UpdateBatchUserDto {
    @IsNotEmpty()
    @IsBoolean()
    isActive!: boolean;
}
