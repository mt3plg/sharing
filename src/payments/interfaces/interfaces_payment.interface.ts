import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SetupPaymentMethodDto {
  @ApiProperty({ example: 'pm_1J...', description: 'Stripe Payment Method ID' })
  @IsString()
  @IsNotEmpty()
  paymentMethodId!: string;
}

export class CreatePaymentDto {
  @ApiProperty({ example: 'ride_123', description: 'Ride ID' })
  @IsString()
  @IsNotEmpty()
  rideId!: string;

  @ApiProperty({ example: 'pm_1J...', description: 'Stripe Payment Method ID' })
  @IsString()
  @IsNotEmpty()
  paymentMethodId!: string;
}

export class RequestPayoutDto {
  @ApiProperty({ example: 1000, description: 'Amount to payout in cents' })
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({ example: 'uah', description: 'Currency code' })
  @IsString()
  @IsNotEmpty()
  currency!: string;
}