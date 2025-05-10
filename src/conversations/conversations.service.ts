// src/conversations/conversations.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateConversationDto, CreateMessageDto } from './interfaces/interfaces_conversation.interface';
import { Logger } from '@nestjs/common';

@Injectable()
export class ConversationsService {
    private readonly logger = new Logger(ConversationsService.name);

    constructor(private readonly prisma: PrismaService) {}

    async create(createConversationDto: CreateConversationDto, userId: string) {
        const { rideId, userId: targetUserId } = createConversationDto;

        this.logger.log(`Creating conversation for userId: ${userId}, targetUserId: ${targetUserId}, rideId: ${rideId}`);
        if (rideId) {
            const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
            if (!ride) {
                this.logger.error('Ride not found:', rideId);
                throw new NotFoundException('Ride not found');
            }
        }

        const conversation = await this.prisma.conversation.create({
            data: {
                userId: targetUserId,
                rideId: rideId || null, // Залишаємо null, оскільки schema.prisma визначає String?
            } as any, // Тимчасове приведення для обходу помилки типізації
            include: {
                user: { select: { id: true, name: true, avatar: true } },
                ride: rideId ? true : false,
            },
        });

        this.logger.log('Conversation created:', conversation);
        return { success: true, conversationId: conversation.id };
    }

    async sendMessage(
        conversationId: string,
        createMessageDto: CreateMessageDto,
        senderId: string,
    ) {
        this.logger.log(`Sending message to conversationId: ${conversationId}, senderId: ${senderId}, content: ${createMessageDto.content}`);
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { ride: true },
        });

        if (!conversation) {
            this.logger.error('Conversation not found:', conversationId);
            throw new NotFoundException('Conversation not found');
        }

        this.logger.log('Conversation found:', conversation);
        if (conversation.userId !== senderId && conversation.rideId) {
            const ride = await this.prisma.ride.findUnique({
                where: { id: conversation.rideId },
            });
            if (ride?.driverId !== senderId) {
                this.logger.error(`User ${senderId} not authorized to send message in conversation ${conversationId}`);
                throw new ForbiddenException('Not authorized to send message');
            }
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

        this.logger.log('Message sent:', message);
        return { success: true, message };
    }

    async getMessages(conversationId: string, userId: string) {
        this.logger.log(`Fetching messages for conversationId: ${conversationId}, userId: ${userId}`);
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { ride: true },
        });

        if (!conversation) {
            this.logger.error('Conversation not found:', conversationId);
            throw new NotFoundException('Conversation not found');
        }

        if (conversation.userId !== userId && conversation.rideId) {
            const ride = await this.prisma.ride.findUnique({
                where: { id: conversation.rideId },
            });
            if (ride?.driverId !== userId) {
                this.logger.error(`User ${userId} not authorized to view messages in conversation ${conversationId}`);
                throw new ForbiddenException('Not authorized to view messages');
            }
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

        this.logger.log('Messages fetched:', messages);
        return { success: true, messages };
    }

    async getConversations(userId: string) {
        this.logger.log(`Fetching conversations for userId: ${userId}`);
        const conversations = await this.prisma.conversation.findMany({
            where: {
                OR: [
                    { userId },
                    { ride: { driverId: userId } },
                ],
            },
            include: {
                user: { select: { id: true, name: true, avatar: true } },
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
        this.logger.log('Conversations from DB:', conversations);

        const formattedConversations = await Promise.all(
            conversations.map(async (conversation) => {
                const isUserTheDriver = conversation.ride?.driverId === userId;
                let contact;
                let category;

                const areFriends = await this.prisma.friend.findFirst({
                    where: {
                        OR: [
                            { userId: userId, friendId: conversation.userId },
                            { userId: conversation.userId, friendId: userId },
                        ],
                    },
                });

                if (areFriends) {
                    category = 'Friends';
                    contact = conversation.userId === userId && conversation.ride ? conversation.ride.driver : conversation.user;
                } else if (isUserTheDriver) {
                    category = 'Passengers';
                    contact = conversation.user;
                } else {
                    category = 'Drivers';
                    contact = conversation.ride?.driver;
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
                    rideId: conversation.rideId,
                    createdAt: conversation.createdAt,
                    updatedAt: conversation.updatedAt,
                    contact,
                    category,
                    lastMessage: conversation.messages[0]
                        ? {
                              text: conversation.messages[0].content,
                              timestamp: conversation.messages[0].createdAt,
                          }
                        : null,
                    unreadMessages,
                };
            }),
        );

        this.logger.log('Formatted conversations:', formattedConversations);
        return { success: true, conversations: formattedConversations };
    }
}