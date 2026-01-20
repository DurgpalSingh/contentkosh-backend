// src/dtos/auth.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

export class RegisterRequest {
    @IsNotEmpty()
    @IsString()
    name!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password!: string;

    @IsString()
    @IsOptional()
    mobile?: string;

    @IsEnum(UserRole)
    @IsOptional()
    role?: UserRole; // Optional, defaults to USER
}

export class LoginRequest {
    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    password!: string;

    @IsOptional()
    @IsString()
    businessId?: string; // Optional if we support multi-tenant login
}

export class RefreshTokenRequest {
    @IsString()
    @IsNotEmpty({ message: 'Refresh token is required' })
    refreshToken!: string;
}

export interface IUser {
    id: number;
    email: string;
    role: UserRole;
    businessId?: number | null;
}

export interface AuthRequest extends Request {
    user?: IUser;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: {
        id: number;
        email: string;
        name: string;
        role: string;
        businessId?: number | null;
    };
}

