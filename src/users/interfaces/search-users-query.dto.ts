import { IsString, MinLength, IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchUsersQueryDto {
  @ApiProperty({ example: 'John', description: 'Search query for user name or email', required: true })
  @IsString()
  @MinLength(2)
  query!: string;

  @ApiProperty({ example: 'Friends', description: 'Filter by category (Friends, Passengers, Drivers)', required: false })
  @IsOptional()
  @IsIn(['Friends', 'Passengers', 'Drivers'])
  category?: string;

  @ApiProperty({ example: 10, description: 'Number of results to return', required: false, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({ example: 0, description: 'Number of results to skip (for pagination)', required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number = 0;
}