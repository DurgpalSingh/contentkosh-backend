// src/dtos/auth.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { CreateBusinessDto } from './business.dto';

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
    role?: UserRole; // Ignored when `slug` is provided (guest joins as USER). Defaults to ADMIN otherwise.

    /**
     * Slug of an existing business to join as a guest (role USER).
     * Omit this to bootstrap a new institute owner (ADMIN, no business yet) — the web/mobile
     * "create institute" flow creates the Business separately via POST /api/business.
     */
    @IsString()
    @IsOptional()
    slug?: string;

    /**
     * Details of the institute to create. Required when `slug` is omitted (new institute owner).
     * The business is not created at signup: it is held until the emailed link is opened.
     */
    @IsOptional()
    @ValidateNested()
    @Type(() => CreateBusinessDto)
    business?: CreateBusinessDto;
}

export class VerifyEmailRequest {
    @IsString()
    @IsNotEmpty({ message: 'Verification token is required' })
    token!: string;
}

export class ResendVerificationRequest {
    @IsEmail()
    email!: string;
}

export class LoginRequest {
    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    password!: string;

    @IsOptional()
    @IsString()
    slug?: string;

    @IsOptional()
    @IsString()
    businessSlug?: string;
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
    businessSlug?: string | null;
    tenantSchema?: string | null;
}

export interface AuthRequest extends Request {
    user?: IUser;
}

/** Signup issues no session: the account only becomes usable once the emailed link is opened. */
export interface RegisterResponse {
    user: {
        id: number;
        email: string;
        name: string;
        role: string;
        businessId?: number | null;
    };
    /** False when the verification mail could not be sent - the client should offer a resend. */
    emailSent: boolean;
}

export interface VerifyEmailResponse {
    verified: true;
    alreadyVerified: boolean;
    /** True only when this call issued a session (new institute owner, first use of the link). */
    autoLogin: boolean;
    slug: string | null;
    tokens?: { accessToken: string; refreshToken: string };
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

