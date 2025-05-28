import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional } from 'class-validator';

export class SetupPaymentMethodDto {
  @ApiProperty({ example: 'pm_123', description: 'The Stripe payment method ID' })
  @IsString()
  @IsNotEmpty()
  paymentMethodId!: string;
}

export class CreatePaymentDto {
  @ApiProperty({ example: 'ride_123', description: 'The ID of the ride' })
  @IsString()
  @IsNotEmpty()
  rideId!: string;

  @ApiProperty({ example: 'pm_123', description: 'The Stripe payment method ID (required for google_pay/apple_pay)', required: false })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @ApiProperty({ example: 'apple_pay', description: 'The payment method', enum: ['cash', 'google_pay', 'apple_pay'] })
  @IsEnum(['cash', 'google_pay', 'apple_pay'])
  paymentMethod!: string;
}

export class ConfirmCashPaymentDto {
  @ApiProperty({ example: 'payment_123', description: 'The ID of the payment' })
  @IsString()
  @IsNotEmpty()
  paymentId!: string;
}

export class RequestPayoutDto {
  @ApiProperty({ example: 50.0, description: 'The amount to payout' })
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({ example: 'UAH', description: 'The currency of the payout' })
  @IsString()
  @IsNotEmpty()
  currency!: string;
}