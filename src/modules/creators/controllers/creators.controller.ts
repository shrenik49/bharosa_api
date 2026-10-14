import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { CreatorDto, UpdateCreatorProfileDto } from '../dto/creators.dto';
import { CreatorsService } from '../services/creators.service';

@ApiTags('creators')
@ApiBearerAuth()
@Controller('creators')
export class CreatorsController {
  constructor(private readonly creators: CreatorsService) {}

  @Get()
  @ApiOkResponse({ type: [CreatorDto] })
  list(@Query() { limit, offset }: PaginationQueryDto): Promise<CreatorDto[]> {
    return this.creators.list(limit, offset);
  }

  @Put('me')
  @ApiOkResponse({ type: CreatorDto })
  updateMine(@CurrentUser() user: AuthUser, @Body() dto: UpdateCreatorProfileDto): Promise<CreatorDto> {
    return this.creators.upsertMine(user.id, dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: CreatorDto })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string): Promise<CreatorDto> {
    return this.creators.get(id);
  }
}
