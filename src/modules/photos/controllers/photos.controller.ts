import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { ListPhotosQueryDto, PhotoDto, RegisterPhotoDto, UploadPhotoDto } from '../dto/photos.dto';
import { PhotosService } from '../services/photos.service';

/** The phone resizes photos before uploading, so anything bigger is refused early. */
const MAX_UPLOAD_BYTES = 1_000_000;

@ApiTags('photos')
@ApiBearerAuth()
@Controller()
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  /** Upload one photo (multipart: `file` plus `visitId`, optional `width` and `height`). Max 1 MB; JPEG, PNG or WebP. */
  @Post('photos/upload')
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: PhotoDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPhotoDto,
  ): Promise<PhotoDto> {
    if (!file) throw new BadRequestException('Attach the image as the "file" field.');
    return this.photos.upload(user.id, file.buffer, dto);
  }

  /** Registers a file that was already uploaded to object storage elsewhere. */
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
