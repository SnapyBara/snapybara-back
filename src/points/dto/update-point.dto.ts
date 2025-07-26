import { PartialType } from '@nestjs/swagger';
import { CreatePointOfInterestDto } from './create-point.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum PointStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class UpdatePointOfInterestDto extends PartialType(
  CreatePointOfInterestDto,
) {
  @ApiPropertyOptional({ enum: PointStatus })
  @IsEnum(PointStatus)
  @IsOptional()
  status?: PointStatus;
}
