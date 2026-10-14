import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthedRequest, AuthUser } from '../interfaces/auth.interface';

/** The signed-in user, taken from the verified access token. Never read ids from the request body. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
