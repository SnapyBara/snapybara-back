import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GooglePlacesService } from './google-places.service';
import { GooglePlacesController } from './google-places.controller';

@Module({
  imports: [ConfigModule],
  controllers: [GooglePlacesController],
  providers: [GooglePlacesService],
  exports: [GooglePlacesService],
})
export class GooglePlacesModule {}
