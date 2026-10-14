import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import {
  AddListItemDto,
  BeenThereDto,
  CreateListDto,
  ListDetailDto,
  ListSummaryDto,
  UpdateListDto,
} from '../dto/lists.dto';
import { ListsService } from '../services/lists.service';

@ApiTags('lists')
@ApiBearerAuth()
@Controller('lists')
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get('mine')
  @ApiOkResponse({ type: [ListSummaryDto] })
  mine(@CurrentUser() user: AuthUser): Promise<ListSummaryDto[]> {
    return this.lists.mine(user.id);
  }

  @Get('been-there')
  @ApiOkResponse({ type: [BeenThereDto] })
  beenThere(@CurrentUser() user: AuthUser): Promise<BeenThereDto[]> {
    return this.lists.beenThere(user.id);
  }

  @Post()
  @ApiCreatedResponse({ type: ListSummaryDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateListDto): Promise<ListSummaryDto> {
    return this.lists.create(user.id, dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: ListDetailDto })
  @ApiNotFoundResponse({ description: 'Not found, or private and not yours' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ListDetailDto> {
    return this.lists.get(user.id, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ListSummaryDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListDto,
  ): Promise<ListSummaryDto> {
    return this.lists.update(user.id, id, dto);
  }

  @HttpCode(204)
  @Delete(':id')
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.lists.remove(user.id, id);
  }

  /** Adds a place to the list, or updates its note if it is already there. */
  @HttpCode(204)
  @Put(':id/items/:placeId')
  @ApiNoContentResponse()
  async addItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Body() dto: AddListItemDto,
  ): Promise<void> {
    await this.lists.addItem(user.id, id, placeId, dto.note);
  }

  @HttpCode(204)
  @Delete(':id/items/:placeId')
  @ApiNoContentResponse()
  async removeItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('placeId', ParseUUIDPipe) placeId: string,
  ): Promise<void> {
    await this.lists.removeItem(user.id, id, placeId);
  }
}
