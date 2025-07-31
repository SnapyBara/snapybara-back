import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GooglePlacesService } from './google-places.service';
import { AutocompleteQueryDto, AutocompleteResponseDto } from './dto/autocomplete.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('google-places')
@Controller('google-places')
export class GooglePlacesController {
  constructor(private readonly googlePlacesService: GooglePlacesService) {}

  @Get('autocomplete')
  @Public() // Rendre public pour l'instant
  @ApiOperation({
    summary: 'Get place autocomplete suggestions',
    description: 'Returns autocomplete predictions for places based on user input',
  })
  async getAutocomplete(
    @Query() query: AutocompleteQueryDto,
  ): Promise<AutocompleteResponseDto> {
    return this.googlePlacesService.getAutocomplete(query);
  }
}