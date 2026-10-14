import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { CreateReviewDto, ReviewDto, UpdateReviewDto } from '../dto/reviews.dto';
import { ReviewsService } from '../services/reviews.service';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('reviews')
  @ApiCreatedResponse({ type: ReviewDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto): Promise<ReviewDto> {
    return this.reviews.create(user.id, dto.visitId, dto.body);
  }

  @Get('reviews/mine')
  @ApiOkResponse({ type: [ReviewDto] })
  mine(@CurrentUser() user: AuthUser, @Query() { limit, offset }: PaginationQueryDto): Promise<ReviewDto[]> {
    return this.reviews.mine(user.id, limit, offset);
  }

  @Patch('reviews/:id')
  @ApiOkResponse({ type: ReviewDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<ReviewDto> {
    return this.reviews.update(user.id, id, dto.body);
  }

  @HttpCode(204)
  @Delete('reviews/:id')
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.reviews.remove(user.id, id);
  }

  @Get('places/:placeId/reviews')
  @ApiOkResponse({ type: [ReviewDto] })
  forPlace(
    @CurrentUser() user: AuthUser,
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Query() { limit, offset }: PaginationQueryDto,
  ): Promise<ReviewDto[]> {
    return this.reviews.forPlace(user.id, placeId, limit, offset);
  }
}
