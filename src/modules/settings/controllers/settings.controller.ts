import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { SettingsDto, UpdateSettingsDto } from '../dto/settings.dto';
import { SettingsService } from '../services/settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOkResponse({ type: SettingsDto })
  get(@CurrentUser() user: AuthUser): Promise<SettingsDto> {
    return this.settings.get(user.id);
  }

  @Patch()
  @ApiOkResponse({ type: SettingsDto })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto): Promise<SettingsDto> {
    return this.settings.update(user.id, dto);
  }
}
