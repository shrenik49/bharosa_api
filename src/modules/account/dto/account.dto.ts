import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

export class DeleteAccountDto {
  /** Re-entered to confirm the person really wants to delete the account. */
  @IsString()
  @MaxLength(72)
  password: string;
}
