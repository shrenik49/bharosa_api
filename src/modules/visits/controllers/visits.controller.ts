import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { BillDto, CheckInDto, VisitResponseDto, VisitWithPlaceDto } from '../dto/visits.dto';
import { VisitsService } from '../services/visits.service';

@ApiTags('visits')
@ApiBearerAuth()
@Controller('visits')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @HttpCode(200)
  @Post('checkin')
  @ApiOkResponse({ type: VisitResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'More than 100 m from the place' })
  checkIn(@CurrentUser() user: AuthUser, @Body() dto: CheckInDto): Promise<VisitResponseDto> {
    return this.visits.checkIn(user.id, dto.placeId, dto.lat, dto.lng);
  }

  @Post('bill')
  @ApiCreatedResponse({ type: VisitResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'Bill older than 3 days or dated in the future' })
  bill(@CurrentUser() user: AuthUser, @Body() dto: BillDto): Promise<VisitResponseDto> {
    return this.visits.verifyBill(user.id, dto.placeId, dto.fingerprint, dto.billDate, dto.meta ?? {});
  }

  @Get('mine')
  @ApiOkResponse({ type: [VisitWithPlaceDto] })
  mine(@CurrentUser() user: AuthUser, @Query() { limit, offset }: PaginationQueryDto): Promise<VisitWithPlaceDto[]> {
    return this.visits.listMine(user.id, limit, offset);
  }
}
