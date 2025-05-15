import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ConversationsGateway } from './conversations.gateway';
import { PrismaService } from '../prisma.service';

@Module({
    controllers: [ConversationsController],
    providers: [ConversationsService, ConversationsGateway, PrismaService],
    exports: [ConversationsService, ConversationsGateway], // Експортуємо ConversationsService
})
export class ConversationsModule {}