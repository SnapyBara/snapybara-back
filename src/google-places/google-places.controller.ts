import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GooglePlacesService } from './google-places.service';
import {
  AutocompleteQueryDto,
  AutocompleteResponseDto,
} from './dto/autocomplete.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('google-places')
@Controller('google-places')
export class GooglePlacesController {
  constructor(private readonly googlePlacesService: GooglePlacesService) {}

  @Get('autocomplete')
  @Public()
  @ApiOperation({
    summary: 'Get place autocomplete suggestions',
    description:
      'Returns autocomplete predictions for places based on user input',
  })
  async getAutocomplete(
    @Query() query: AutocompleteQueryDto,
  ): Promise<AutocompleteResponseDto> {
    console.log('Autocomplete request received:', query);
    const result = await this.googlePlacesService.getAutocomplete(query);
    console.log('Autocomplete response:', result);
    return result;
  }

  @Get('test')
  @Public()
  @ApiOperation({
    summary: 'Test endpoint',
    description: 'Test if the controller is accessible',
  })
  test() {
    return { message: 'Google Places controller is working!' };
  }
}
