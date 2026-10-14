import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { ListPhotosQueryDto, PhotoDto, RegisterPhotoDto } from '../dto/photos.dto';
import { PhotosService } from '../services/photos.service';

@ApiTags('photos')
@ApiBearerAuth()
@Controller()
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  /** Call after the file has been uploaded to storage. */
  @Post('photos')
  @ApiCreatedResponse({ type: PhotoDto })
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterPhotoDto): Promise<PhotoDto> {
    return this.photos.register(user.id, dto);
  }

  @Get('photos/mine')
  @ApiOkResponse({ type: [PhotoDto] })
  mine(@CurrentUser() user: AuthUser, @Query() { limit, offset }: PaginationQueryDto): Promise<PhotoDto[]> {
    return this.photos.mine(user.id, limit, offset);
  }

  @HttpCode(204)
  @Delete('photos/:id')
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.photos.remove(user.id, id);
  }

  @Get('places/:placeId/photos')
  @ApiOkResponse({ type: [PhotoDto] })
  forPlace(
    @CurrentUser() user: AuthUser,
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Query() { sort, limit, offset }: ListPhotosQueryDto,
  ): Promise<PhotoDto[]> {
    return this.photos.forPlace(user.id, placeId, sort, limit, offset);
  }
}
