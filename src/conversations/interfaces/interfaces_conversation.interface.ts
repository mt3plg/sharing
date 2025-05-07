import { IsString, IsNotEmpty } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  rideId!: string;
}

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}