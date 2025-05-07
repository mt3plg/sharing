import { IsNumber, IsString, Min, Max, Length } from 'class-validator';

export class CreateReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @Length(1, 500)
  comment!: string;
}