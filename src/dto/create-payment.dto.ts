import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsEnum } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 'ride_123', description: 'The ID of the ride' })
  @IsString()
  @IsNotEmpty()
  rideId!: string;

  @ApiProperty({ example: 100.0, description: 'The amount to be paid' })
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({ example: 'UAH', description: 'The currency of the payment' })
  @IsString()
  @IsNotEmpty()
  currency!: string;

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