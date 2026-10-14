import { ApiProperty } from '@nestjs/swagger';

/** The shape of every error response. */
export class ApiErrorDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'BAD_REQUEST' })
  error: string;

  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] })
  message: string | string[];

  @ApiProperty({ example: '/visits/checkin' })
  path: string;

  @ApiProperty()
  timestamp: string;

  @ApiProperty({ required: false, description: 'Quote this when reporting a problem' })
  requestId?: string;
}
