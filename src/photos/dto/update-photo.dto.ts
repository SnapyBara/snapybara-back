import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePhotoDto } from './create-photo.dto';

export class UpdatePhotoDto extends PartialType(
  OmitType(CreatePhotoDto, ['pointId', 'url'] as const),
) {}
