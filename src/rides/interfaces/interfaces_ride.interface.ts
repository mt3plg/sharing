import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, Min, IsDateString, IsOptional, IsNumber, IsIn, IsObject } from 'class-validator';

export class CreateRideDto {
  @ApiProperty({ example: 'Kyiv, Ukraine', description: 'The starting location of the ride' })
  @IsString()
  @IsNotEmpty()
  startLocation!: string;

  @ApiProperty({ example: 'Lviv, Ukraine', description: 'The destination of the ride' })
  @IsString()
  @IsNotEmpty()
  endLocation!: string;

  @ApiProperty({ example: '2025-05-28T10:00:00Z', description: 'The departure time of the ride' })
  @IsDateString()
  @IsNotEmpty()
  departureTime!: string;

  @ApiProperty({ example: 4, description: 'The number of available seats' })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  availableSeats!: number;

  @ApiProperty({ example: 'Sedan', description: 'The type of vehicle', required: false })
  @IsString()
  @IsOptional()
  vehicleType?: string;

  @ApiProperty({ example: 1, description: 'The number of passengers for booking', required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  passengerCount?: number;

  @ApiProperty({ example: 'both', description: 'The payment type for the ride (card, cash, both)', required: false })
  @IsString()
  @IsIn(['card', 'cash', 'both'])
  @IsOptional()
  paymentType?: string;

  @ApiProperty({
    example: { id: '7a92bc26-7af2-4854-aebb-a7ae927f2fc5', brand: 'visa', last4: '4242' },
    description: 'The selected payment card details',
    required: false,
  })
  @IsObject()
  @IsOptional()
  selectedCard?: { id: string; brand: string; last4: string };
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

  @ApiProperty({ example: '2025-05-28', description: 'The departure date to search for (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  departureTime!: string;

  @ApiProperty({ example: 2, description: 'The number of passengers' })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
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

  @ApiProperty({ example: 10, description: 'Number of results to return', required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @ApiProperty({ example: 0, description: 'Number of results to skip (offset)', required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;
}

export class BookRideDto {
  @ApiProperty({ example: 1, description: 'The number of passengers for booking' })
  @IsInt()
  @Min(1)
  passengerCount!: number;
}