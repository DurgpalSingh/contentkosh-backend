import { IsString, IsNotEmpty, IsOptional, IsDateString, IsInt, MaxLength, IsEnum, Matches } from 'class-validator';

export class CreateExamDto {
    @IsString()
    @IsNotEmpty({ message: 'Exam name is required' })
    @MaxLength(50, { message: 'Exam name must be shorter than 50 characters' })
    @Matches(/^(?=.*[A-Za-z]).+$/, {
        message: 'Exam name must contain at least one alphabet character',
    })
    name!: string;

    @IsString()
    @IsOptional()
    code?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDateString()
    @IsOptional()
    startDate?: string;

    @IsDateString()
    @IsOptional()
    endDate?: string;

    @IsInt()
    @IsNotEmpty({ message: 'Business ID is required' })
    businessId!: number;
}

export class UpdateExamDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    @IsOptional()
    @Matches(/^(?=.*[A-Za-z]).+$/, {
        message: 'Exam name must contain at least one alphabet character',
    })
    name?: string;

    @IsString()
    @IsOptional()
    code?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDateString()
    @IsOptional()
    startDate?: string;

    @IsDateString()
    @IsOptional()
    endDate?: string;

    @IsEnum(['ACTIVE', 'INACTIVE'])
    @IsOptional()
    status?: 'ACTIVE' | 'INACTIVE';
}
