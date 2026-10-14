import { Controller, Delete, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { REACTION_SUBJECTS, ReactionSubject } from '../dto/reactions.dto';
import { ReactionsService } from '../services/reactions.service';

const SubjectPipe = new ParseEnumPipe(Object.fromEntries(REACTION_SUBJECTS.map(s => [s, s])));

@ApiTags('reactions')
@ApiBearerAuth()
@Controller('reactions')
export class ReactionsController {
  constructor(private readonly reactions: ReactionsService) {}

  /** Likes a photo, review or list. Safe to repeat. */
  @HttpCode(204)
  @Put(':subjectType/:subjectId')
  @ApiParam({ name: 'subjectType', enum: REACTION_SUBJECTS })
  @ApiNoContentResponse()
  async like(
    @CurrentUser() user: AuthUser,
    @Param('subjectType', SubjectPipe) subjectType: ReactionSubject,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ): Promise<void> {
    await this.reactions.like(user.id, subjectType, subjectId);
  }

  @HttpCode(204)
  @Delete(':subjectType/:subjectId')
  @ApiParam({ name: 'subjectType', enum: REACTION_SUBJECTS })
  @ApiNoContentResponse()
  async unlike(
    @CurrentUser() user: AuthUser,
    @Param('subjectType', SubjectPipe) subjectType: ReactionSubject,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ): Promise<void> {
    await this.reactions.unlike(user.id, subjectType, subjectId);
  }
}
