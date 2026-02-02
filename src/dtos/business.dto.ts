import { IsString, IsNotEmpty, IsOptional, IsUrl, Matches, IsEmail, MaxLength } from 'class-validator';

export class CreateBusinessDto {
    @IsString()
    @IsNotEmpty({ message: 'Institute name is required' })
    @MaxLength(100)
    instituteName!: string;

    @IsString()
    @IsNotEmpty({ message: 'Slug is required' })
    @Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
    slug!: string;

    @IsOptional()
    @IsString()
    @IsUrl({}, { message: 'Logo must be a valid URL' })
    logo_url?: string;

    @IsOptional()
    @IsString()
    @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Phone number must be a valid E.164 format' })
    phone?: string;

    @IsOptional()
    @IsString()
    @IsEmail({}, { message: 'Email must be a valid email address' })
    email?: string;

    @IsOptional()
    @IsString()
    tagline?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    @IsUrl()
    youtubeUrl?: string;

    @IsOptional()
    @IsString()
    @IsUrl()
    instagramUrl?: string;

    @IsOptional()
    @IsString()
    @IsUrl()
    linkedinUrl?: string;

    @IsOptional()
    @IsString()
    @IsUrl()
    facebookUrl?: string;
}

export class UpdateBusinessDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    instituteName?: string;

    @IsOptional()
    @IsString()
    @Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
    slug?: string;

    @IsOptional()
    @IsString()
    @IsUrl({}, { message: 'Logo must be a valid URL' })
    logo_url?: string;

    @IsOptional()
    @IsString()
    @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Phone number must be a valid E.164 format' })
    phone?: string;

    @IsOptional()
    @IsString()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    tagline?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    @IsUrl()
    youtubeUrl?: string;

    @IsOptional()
    @IsString()
    @IsUrl()
    instagramUrl?: string;

    @IsOptional()
    @IsString()
    @IsUrl()
    linkedinUrl?: string;

    @IsOptional()
    @IsString()
    @IsUrl()
    facebookUrl?: string;
}
