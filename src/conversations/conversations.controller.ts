// src/conversations/conversations.controller.ts
import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto, CreateMessageDto } from './interfaces/interfaces_conversation.interface';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../common/decorators/common_decorators_user.decorator';
import { Logger } from '@nestjs/common';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
    private readonly logger = new Logger(ConversationsController.name);

    constructor(private readonly conversationsService: ConversationsService) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new conversation' })
    @ApiResponse({ status: 201, description: 'Conversation created successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Ride not found' })
    async create(
        @Body() createConversationDto: CreateConversationDto,
        @AuthUser() user: any,
    ) {
        this.logger.log(`Creating conversation for user ${user.id}: ${JSON.stringify(createConversationDto)}`);
        return this.conversationsService.create(createConversationDto, user.id);
    }

    @Post(':id/messages')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Send a message in a conversation' })
    @ApiResponse({ status: 201, description: 'Message sent successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    @ApiResponse({ status: 404, description: 'Conversation not found' })
    async sendMessage(
        @Param('id') conversationId: string,
        @Body() createMessageDto: CreateMessageDto,
        @AuthUser() user: any,
    ) {
        this.logger.log(`Sending message to conversation ${conversationId} by user ${user.id}: ${JSON.stringify(createMessageDto)}`);
        return this.conversationsService.sendMessage(
            conversationId,
            createMessageDto,
            user.id,
        );
    }

    @Get(':id/messages')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get messages in a conversation' })
    @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    @ApiResponse({ status: 404, description: 'Conversation not found' })
    async getMessages(@Param('id') conversationId: string, @AuthUser() user: any) {
        this.logger.log(`Fetching messages for conversation ${conversationId} by user ${user.id}`);
        return this.conversationsService.getMessages(conversationId, user.id);
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all conversations for the user' })
    @ApiResponse({ status: 200, description: 'Conversations retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getConversations(@AuthUser() user: any) {
        this.logger.log(`Fetching conversations for user ${user.id}`);
        return this.conversationsService.getConversations(user.id);
    }
}