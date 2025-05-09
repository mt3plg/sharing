// src/conversations/interfaces/interfaces_conversation.interface.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsOptional()
  rideId?: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}