import { IsEnum, IsString, IsNotEmpty, MaxLength, ValidateIf } from 'class-validator';
import { BusinessStatus } from '@prisma/client';

export class UpdateBusinessStatusDto {
  @IsEnum(BusinessStatus)
  status!: BusinessStatus;

  @ValidateIf((dto: UpdateBusinessStatusDto) => dto.status !== BusinessStatus.ACTIVE)
  @IsString()
  @IsNotEmpty({ message: 'A reason is required to pause or delete a business' })
  @MaxLength(500)
  reason?: string;
}
