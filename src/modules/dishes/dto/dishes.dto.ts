import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, IsUUID, Length } from 'class-validator';

const MAX_DISHES = 20;

export class SaveVisitDishesDto {
  /** Dishes already on the place's menu that the person ate. */
  @IsArray()
  @ArrayMaxSize(MAX_DISHES)
  @IsUUID('all', { each: true })
  dishIds: string[];

  /** Dishes typed by the person; matched to the menu by name (case-insensitive) or added to it. */
  @IsArray()
  @ArrayMaxSize(MAX_DISHES)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map(v => (typeof v === 'string' ? v.trim() : v)) : value,
  )
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  newDishNames: string[];
}
