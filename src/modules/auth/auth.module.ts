import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EnvVars } from '../../config/env.config';
import { AuthController } from './controllers/auth.controller';
import { PasswordController } from './controllers/password.controller';
import { AuthService } from './services/auth.service';
import { PasswordResetService } from './services/password-reset.service';
import { TokensService } from './services/tokens.service';

/** Global so every feature module gets the JWT guard and JwtService without re-importing anything. */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvVars, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256', expiresIn: config.get('ACCESS_TOKEN_TTL', { infer: true }) as never },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController, PasswordController],
  providers: [AuthService, TokensService, PasswordResetService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [JwtModule, TokensService],
})
export class AuthModule {}
