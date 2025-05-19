import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateConversationDto, CreateMessageDto } from './interfaces/interfaces_conversation.interface';

@Injectable()
export class ConversationsService {
    private readonly logger = new Logger(ConversationsService.name);

    constructor(private readonly prisma: PrismaService) {}

    async create(
        createConversationDto: CreateConversationDto,
        initiatorId: string,
        category: 'Ride' | 'Friends',
    ) {
        const { rideId, userId: targetUserId } = createConversationDto;

        this.logger.log(
            `Creating conversation: initiatorId=${initiatorId}, targetUserId=${targetUserId}, rideId=${rideId}, category=${category}`,
        );

        let ride;
        if (rideId) {
            ride = await this.prisma.ride.findUnique({
                where: { id: rideId },
                include: { driver: true, passenger: true },
            });
            if (!ride) {
                this.logger.error(`Ride not found: ${rideId}`);
                throw new NotFoundException('Ride not found');
            }
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
        });
        if (!targetUser) {
            this.logger.error(`Target user not found: ${targetUserId}`);
            throw new NotFoundException('Target user not found');
        }

        // Генеруємо унікальний conversationId
        const conversationId = rideId
            ? `conv-${rideId}-${initiatorId}-${targetUserId}-${category}`
            : `conv-${initiatorId}-${targetUserId}-${category}`;

        // Перевіряємо, чи розмова вже існує
        const existingConversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
        });

        if (existingConversation) {
            this.logger.log(`Conversation already exists: ${conversationId}`);
            return {
                success: true,
                conversationId: existingConversation.id,
            };
        }

        // Створюємо розмову
        const conversation = await this.prisma.conversation.create({
            data: {
                id: conversationId,
                userId: initiatorId,
                targetUserId,
                rideId,
                category,
            },
            include: {
                user: { select: { id: true, name: true, avatar: true } },
                targetUser: { select: { id: true, name: true, avatar: true } },
                ride: {
                    select: {
                        id: true,
                        driverId: true,
                        driver: { select: { id: true, name: true, avatar: true } },
                        passenger: { select: { id: true, name: true, avatar: true } },
                    },
                },
            },
        });

        this.logger.log(`Conversation created: ${conversationId}`);
        return {
            success: true,
            conversationId: conversation.id,
        };
    }

    async sendMessage(
        conversationId: string,
        createMessageDto: CreateMessageDto,
        senderId: string,
    ) {
        this.logger.log(
            `Sending message to conversationId: ${conversationId}, senderId: ${senderId}, content: ${createMessageDto.content}`,
        );
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { ride: true },
        });

        if (!conversation) {
            this.logger.error(`Conversation not found: ${conversationId}`);
            throw new NotFoundException('Conversation not found');
        }

        // Перевіряємо, чи користувач є учасником розмови
        if (conversation.userId !== senderId && conversation.targetUserId !== senderId) {
            this.logger.error(
                `User ${senderId} not authorized to send message in conversation ${conversationId}`,
            );
            throw new ForbiddenException('Not authorized to send message');
        }

        const message = await this.prisma.message.create({
            data: {
                conversationId,
                senderId,
                content: createMessageDto.content,
            },
            include: {
                sender: { select: { id: true, name: true, avatar: true } },
            },
        });

        this.logger.log(`Message sent: ${message.id}`);
        return { success: true, message };
    }

    async getMessages(conversationId: string, userId: string) {
        this.logger.log(`Fetching messages for conversationId: ${conversationId}, userId: ${userId}`);
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { ride: true },
        });

        if (!conversation) {
            this.logger.error(`Conversation not found: ${conversationId}`);
            throw new NotFoundException('Conversation not found');
        }

        if (conversation.userId !== userId && conversation.targetUserId !== userId) {
            this.logger.error(
                `User ${userId} not authorized to view messages in conversation ${conversationId}`,
            );
            throw new ForbiddenException('Not authorized to view messages');
        }

        const messages = await this.prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' },
            include: { sender: { select: { id: true, name: true } } },
        });

        await this.prisma.message.updateMany({
            where: {
                conversationId,
                senderId: { not: userId },
                read: false,
            },
            data: { read: true },
        });

        this.logger.log(`Messages fetched: ${messages.length}`);
        return { success: true, messages };
    }

    async getConversations(userId: string) {
        this.logger.log(`Fetching conversations for userId: ${userId}`);
        const conversations = await this.prisma.conversation.findMany({
            where: {
                OR: [{ userId }, { targetUserId: userId }],
            },
            include: {
                user: { select: { id: true, name: true, avatar: true } },
                targetUser: { select: { id: true, name: true, avatar: true } },
                ride: {
                    include: {
                        driver: { select: { id: true, name: true, avatar: true } },
                        passenger: { select: { id: true, name: true, avatar: true } },
                    },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        const formattedConversations = await Promise.all(
            conversations.map(async (conversation) => {
                const isInitiator = conversation.userId === userId;
                const contact = isInitiator ? conversation.targetUser : conversation.user;

                if (!contact?.id) {
                    this.logger.warn(`Skipping conversation ${conversation.id} with invalid contact`);
                    return null;
                }

                const unreadMessages = await this.prisma.message.count({
                    where: {
                        conversationId: conversation.id,
                        senderId: { not: userId },
                        read: false,
                    },
                });

                return {
                    id: conversation.id,
                    userId: conversation.userId,
                    targetUserId: conversation.targetUserId,
                    rideId: conversation.rideId,
                    createdAt: conversation.createdAt,
                    updatedAt: conversation.updatedAt,
                    contact: {
                        id: contact.id,
                        name: contact.name,
                        avatar: contact.avatar,
                    },
                    category: conversation.category,
                    lastMessage: conversation.messages[0]
                        ? {
                              text: conversation.messages[0].content,
                              timestamp: conversation.messages[0].createdAt,
                          }
                        : null,
                    unreadMessages,
                    ride: conversation.ride,
                };
            }),
        );

        const validConversations = formattedConversations.filter((conv) => conv !== null);
        this.logger.log(`Formatted conversations: ${validConversations.length}`);
        return { success: true, conversations: validConversations };
    }

    async getConversationsByCategory(
        userId: string,
        category: 'Ride' | 'Friends',
    ) {
        this.logger.log(`Fetching conversations for userId: ${userId}, category: ${category}`);
        const conversations = await this.getConversations(userId);
        if (!conversations.success) {
            throw new BadRequestException('Failed to fetch conversations');
        }

        const filteredConversations = conversations.conversations.filter(
            (conv) => conv.category === category,
        );
        this.logger.log(`Filtered conversations for ${category}: ${filteredConversations.length}`);
        return filteredConversations;
    }
}