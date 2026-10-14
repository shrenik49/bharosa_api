import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { AreaDto, CityDto, TagDto, TagsQueryDto } from '../dto/reference.dto';
import { ReferenceService } from '../services/reference.service';

/** Public reference data: readable before sign-in so the app can show a city picker. */
@ApiTags('reference')
@Public()
@Controller()
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  @Get('cities')
  @ApiOkResponse({ type: [CityDto] })
  cities(): Promise<CityDto[]> {
    return this.reference.cities();
  }

  @Get('cities/:slug/areas')
  @ApiOkResponse({ type: [AreaDto] })
  areas(@Param('slug') slug: string): Promise<AreaDto[]> {
    return this.reference.areas(slug);
  }

  @Get('tags')
  @ApiOkResponse({ type: [TagDto] })
  tags(@Query() { kinds }: TagsQueryDto): Promise<TagDto[]> {
    return this.reference.tags(kinds);
  }
}
