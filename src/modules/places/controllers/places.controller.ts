import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListPlacesQueryDto, PlaceDetailDto, PlaceSummaryDto } from '../dto/places.dto';
import { PlacesService } from '../services/places.service';

@ApiTags('places')
@ApiBearerAuth()
@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get()
  @ApiOkResponse({ type: [PlaceSummaryDto] })
  list(@Query() query: ListPlacesQueryDto): Promise<PlaceSummaryDto[]> {
    return this.places.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: PlaceDetailDto })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string): Promise<PlaceDetailDto> {
    return this.places.get(id);
  }
}
