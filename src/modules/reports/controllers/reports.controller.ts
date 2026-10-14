import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { CreateReportDto, ReportDto } from '../dto/reports.dto';
import { ReportsService } from '../services/reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @ApiCreatedResponse({ type: ReportDto })
  @ApiConflictResponse({ description: 'Already reported by you' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto): Promise<ReportDto> {
    return this.reports.create(user.id, dto);
  }

  @Get('mine')
  @ApiOkResponse({ type: [ReportDto] })
  mine(@CurrentUser() user: AuthUser): Promise<ReportDto[]> {
    return this.reports.mine(user.id);
  }
}
