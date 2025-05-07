import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @ApiProperty({ example: 'John Doe', description: 'The name of the user' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'john@example.com', description: 'The email of the user' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '+380671234567', description: 'The phone number of the user' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: 'password123', description: 'The password of the user (minimum 6 characters)' })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class SignInDto {
  @ApiProperty({ example: 'john@example.com', description: 'The email of the user' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', description: 'The password of the user' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class VerifyDto {
  @ApiProperty({ example: 'john@example.com', description: 'The email of the user to verify' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '1234', description: 'The verification code sent to the email' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}