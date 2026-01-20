import { IsNotEmpty, IsString, IsOptional, IsEmail, MinLength, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole, UserStatus } from '@prisma/client';

export class CreateUserDto {
    @IsNotEmpty({ message: 'User name is required' })
    @IsString()
    @Transform(({ value }) => value?.trim())
    name!: string;

    @IsEmail({}, { message: 'Valid email is required' })
    email!: string;

    @IsOptional()
    @IsString()
    mobile?: string;

    @IsNotEmpty({ message: 'Password is required' })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password!: string;

    @IsNotEmpty({ message: 'Role is required' })
    @IsEnum(UserRole, { message: 'Valid role is required (ADMIN, TEACHER, STUDENT, USER)' })
    role!: UserRole;
}

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: 'Name cannot be empty' })
    @Transform(({ value }) => value?.trim())
    name?: string;

    @IsOptional()
    @IsString()
    mobile?: string;

    @IsOptional()
    @IsEnum(UserRole, { message: 'Valid role is required (ADMIN, TEACHER, STUDENT, USER)' })
    role?: UserRole;

    @IsOptional()
    @IsEnum(UserStatus, { message: 'Valid status is required (ACTIVE, INACTIVE)' })
    status?: UserStatus;
}
