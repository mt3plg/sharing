import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

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

  @ApiProperty({ example: 'pm_1J...', description: 'Stripe Payment Method ID (required for google_pay or apple_pay)' })
  @IsString()
  paymentMethodId?: string;

  @ApiProperty({ example: 'google_pay', description: 'Payment method', enum: ['cash', 'google_pay', 'apple_pay'] })
  @IsEnum(['cash', 'google_pay', 'apple_pay'])
  @IsNotEmpty()
  paymentMethod!: string;
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

export class ConfirmCashPaymentDto {
  @ApiProperty({ example: 'payment_123', description: 'Payment ID' })
  @IsString()
  @IsNotEmpty()
  paymentId!: string;
}