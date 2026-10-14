import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class SignUpDto {
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  name: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  // bcrypt only reads the first 72 bytes, so cap the length instead of silently truncating.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}

export class LoginDto {
  @Transform(trim)
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(72)
  password: string;
}

export class RefreshDto {
  @IsString()
  @MaxLength(200)
  refreshToken: string;
}

export class TokenPairDto {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

export class AuthUserDto {
  id: string;
  email: string;
  displayName: string;
}

export class AuthResponseDto extends TokenPairDto {
  user: AuthUserDto;
}
