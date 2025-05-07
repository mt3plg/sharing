import { IsString, IsNotEmpty, IsInt, Min, IsDateString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRideDto {
  @ApiProperty({ example: 'Kyiv, Ukraine', description: 'The starting location of the ride' })
  @IsString()
  @IsNotEmpty()
  startLocation!: string;

  @ApiProperty({ example: 'Lviv, Ukraine', description: 'The destination of the ride' })
  @IsString()
  @IsNotEmpty()
  endLocation!: string;

  @ApiProperty({ example: '2025-05-07T10:00:00Z', description: 'The departure time of the ride' })
  @IsDateString()
  departureTime!: string;

  @ApiProperty({ example: 4, description: 'The number of available seats' })
  @IsInt()
  @Min(1)
  availableSeats!: number;

  @ApiProperty({ example: 'Sedan', description: 'The type of vehicle', required: false })
  @IsString()
  @IsOptional()
  vehicleType?: string;
}

export class SearchRideDto {
  @ApiProperty({ example: 'Kyiv, Ukraine', description: 'The starting location to search for' })
  @IsString()
  @IsNotEmpty()
  startLocation!: string;

  @ApiProperty({ example: 'Lviv, Ukraine', description: 'The destination to search for' })
  @IsString()
  @IsNotEmpty()
  endLocation!: string;

  @ApiProperty({ example: '2025-05-07', description: 'The departure date to search for (YYYY-MM-DD)' })
  @IsDateString()
  departureTime!: string;

  @ApiProperty({ example: 2, description: 'The number of passengers', required: false })
  @IsInt()
  @Min(1)
  passengers!: number;

  @ApiProperty({ example: 2, description: 'The date range in days (±days)', required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  dateRange?: number;

  @ApiProperty({ example: 10, description: 'The maximum distance in kilometers for proximity search', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxDistance?: number;

  @ApiProperty({ example: { lat: 50.4501, lng: 30.5234 }, description: 'Start coordinates', required: false })
  @IsOptional()
  startCoords?: { lat: number; lng: number };

  @ApiProperty({ example: { lat: 49.8397, lng: 24.0297 }, description: 'End coordinates', required: false })
  @IsOptional()
  endCoords?: { lat: number; lng: number };
}