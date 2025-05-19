import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto, CreateMessageDto } from './interfaces/interfaces_conversation.interface';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../common/decorators/common_decorators_user.decorator';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
    private readonly logger = new Logger(ConversationsController.name);

    constructor(private readonly conversationsService: ConversationsService) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Створити нову розмову' })
    @ApiResponse({ status: 201, description: 'Розмова успішно створена' })
    @ApiResponse({ status: 401, description: 'Неавторизовано' })
    @ApiResponse({ status: 404, description: 'Поїздку не знайдено' })
    async create(@Body() createConversationDto: CreateConversationDto, @AuthUser() user: any) {
        this.logger.log(`Creating conversation for user ${user.id}: ${JSON.stringify(createConversationDto)}`);
        // Визначаємо категорію залежно від контексту
        const category = createConversationDto.rideId ? 'Ride' : 'Friends';
        return this.conversationsService.create(createConversationDto, user.id, category);
    }

    @Post(':id/messages')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Надіслати повідомлення в розмові' })
    @ApiResponse({ status: 201, description: 'Повідомлення успішно надіслано' })
    @ApiResponse({ status: 401, description: 'Неавторизовано' })
    @ApiResponse({ status: 403, description: 'Заборонено' })
    @ApiResponse({ status: 404, description: 'Розмову не знайдено' })
    async sendMessage(
        @Param('id') conversationId: string,
        @Body() createMessageDto: CreateMessageDto,
        @AuthUser() user: any,
    ) {
        this.logger.log(
            `Sending message to conversation ${conversationId} by user ${user.id}: ${JSON.stringify(createMessageDto)}`,
        );
        return this.conversationsService.sendMessage(conversationId, createMessageDto, user.id);
    }

    @Get(':id/messages')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Отримати повідомлення в розмові' })
    @ApiResponse({ status: 200, description: 'Повідомлення успішно отримано' })
    @ApiResponse({ status: 401, description: 'Неавторизовано' })
    @ApiResponse({ status: 403, description: 'Заборонено' })
    @ApiResponse({ status: 404, description: 'Розмову не знайдено' })
    async getMessages(@Param('id') conversationId: string, @AuthUser() user: any) {
        this.logger.log(`Fetching messages for conversation ${conversationId} by user ${user.id}`);
        return this.conversationsService.getMessages(conversationId, user.id);
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Отримати всі розмови користувача' })
    @ApiResponse({ status: 200, description: 'Розмови успішно отримано' })
    @ApiResponse({ status: 401, description: 'Неавторизовано' })
    async getConversations(@AuthUser() user: any) {
        this.logger.log(`Fetching conversations for user ${user.id}`);
        return this.conversationsService.getConversations(user.id);
    }
}