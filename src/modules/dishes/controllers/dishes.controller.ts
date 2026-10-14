import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { SaveVisitDishesDto } from '../dto/dishes.dto';
import { DishesService } from '../services/dishes.service';

@ApiTags('visits')
@ApiBearerAuth()
@Controller('visits')
export class DishesController {
  constructor(private readonly dishes: DishesService) {}

  @HttpCode(204)
  @Put(':visitId/dishes')
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Visit is not yours or not verified' })
  async save(
    @CurrentUser() user: AuthUser,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Body() dto: SaveVisitDishesDto,
  ): Promise<void> {
    await this.dishes.saveForVisit(user.id, visitId, dto.dishIds, dto.newDishNames);
  }
}
