import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ComparisonDto, RankedPlaceDto, ScoreDto } from '../dto/rankings.dto';
import { RankingsService } from '../services/rankings.service';

@ApiTags('rankings')
@ApiBearerAuth()
@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankings: RankingsService) {}

  /** "Better / About the same / Not as good" than a place you already ranked. Returns the 0-100 score. */
  @HttpCode(200)
  @Post('compare')
  @ApiOkResponse({ type: ScoreDto })
  @ApiForbiddenResponse({ description: 'Visit is not yours or not verified' })
  compare(@CurrentUser() user: AuthUser, @Body() dto: ComparisonDto): Promise<ScoreDto> {
    return this.rankings.submitComparison(user.id, dto.visitId, dto.refPlaceId, dto.outcome);
  }

  @Get('mine')
  @ApiOkResponse({ type: [RankedPlaceDto] })
  mine(@CurrentUser() user: AuthUser): Promise<RankedPlaceDto[]> {
    return this.rankings.listMine(user.id);
  }
}
