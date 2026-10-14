import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { AuthResponseDto, LoginDto, RefreshDto, SignUpDto, TokenPairDto } from '../dto/auth.dto';
import { AuthService } from '../services/auth.service';

// Credentials endpoints get a much tighter rate limit than the rest of the API.
const STRICT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle(STRICT)
  @Post('signup')
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'Email already registered' })
  signUp(@Body() dto: SignUpDto): Promise<AuthResponseDto> {
    return this.auth.signUp(dto);
  }

  @Throttle(STRICT)
  @HttpCode(200)
  @Post('login')
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Incorrect email or password' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.auth.login(dto);
  }

  @Throttle(STRICT)
  @HttpCode(200)
  @Post('refresh')
  @ApiOkResponse({ type: TokenPairDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token invalid, used or expired' })
  refresh(@Body() dto: RefreshDto): Promise<TokenPairDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @HttpCode(204)
  @Post('logout')
  @ApiNoContentResponse()
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }
}
