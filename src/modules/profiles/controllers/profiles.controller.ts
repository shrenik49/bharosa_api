import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ProfileResponseDto, TasteAffinityDto, TasteInterestDto, UpdateProfileDto } from '../dto/profiles.dto';
import { ProfilesService } from '../services/profiles.service';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  @ApiOkResponse({ type: ProfileResponseDto })
  me(@CurrentUser() user: AuthUser): Promise<ProfileResponseDto> {
    return this.profiles.getMe(user.id);
  }

  /** What the person picked in the taste quiz. */
  @Get('me/interests')
  @ApiOkResponse({ type: [TasteInterestDto] })
  interests(@CurrentUser() user: AuthUser): Promise<TasteInterestDto[]> {
    return this.profiles.interests(user.id);
  }

  /** The "Your taste" bars: top tags by affinity. */
  @Get('me/affinity')
  @ApiOkResponse({ type: [TasteAffinityDto] })
  affinity(@CurrentUser() user: AuthUser): Promise<TasteAffinityDto[]> {
    return this.profiles.affinity(user.id);
  }

  @Patch('me')
  @ApiOkResponse({ type: ProfileResponseDto })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    return this.profiles.update(user.id, dto);
  }
}
