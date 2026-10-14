import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class TasteProfileDto {
  /** Ids of the dishes, cuisines and place formats the person picked. */
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  tagIds: number[];

  /** Places the person already loves. */
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  placeIds: string[];

  @IsOptional()
  @IsString()
  citySlug?: string;
}
