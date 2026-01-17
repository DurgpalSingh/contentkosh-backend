
import { IsArray, IsInt, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class AssignPermissionDto {
    @IsInt()
    @IsNotEmpty()
    userId!: number;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    permissions?: string[];
}
