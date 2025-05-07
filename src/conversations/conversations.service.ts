import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateConversationDto, CreateMessageDto } from './interfaces/interfaces_conversation.interface';

@Injectable()
export class ConversationsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(createConversationDto: CreateConversationDto, userId: string) {
        const { rideId } = createConversationDto;

        console.log(`Creating conversation for userId: ${userId}, rideId: ${rideId}`);
        const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
        if (!ride) {
            console.error('Ride not found:', rideId);
            throw new NotFoundException('Ride not found');
        }

        const conversation = await this.prisma.conversation.create({
            data: {
                userId,
                rideId,
            },
            include: {
                user: { select: { id: true, name: true, avatar: true } },
                ride: true,
            },
        });

        console.log('Conversation created:', conversation);
        return { success: true, conversationId: conversation.id };
    }

    async sendMessage(
        conversationId: string,
        createMessageDto: CreateMessageDto,
        senderId: string,
    ) {
        console.log(`Sending message to conversationId: ${conversationId}, senderId: ${senderId}`);
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { ride: true },
        });

        if (!conversation) {
            console.error('Conversation not found:', conversationId);
            throw new NotFoundException('Conversation not found');
        }

        console.log('Conversation found:', conversation);
        if (conversation.userId !== senderId && conversation.rideId) {
            const ride = await this.prisma.ride.findUnique({
                where: { id: conversation.rideId },
            });
            if (ride?.driverId !== senderId) {
                console.error(`User ${senderId} not authorized to send message in conversation ${conversationId}`);
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

        console.log('Message sent:', message);
        return { success: true, message };
    }

    async getMessages(conversationId: string, userId: string) {
        console.log(`Fetching messages for conversationId: ${conversationId}, userId: ${userId}`);
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { ride: true },
        });

        if (!conversation) {
            console.error('Conversation not found:', conversationId);
            throw new NotFoundException('Conversation not found');
        }

        if (conversation.userId !== userId && conversation.rideId) {
            const ride = await this.prisma.ride.findUnique({
                where: { id: conversation.rideId },
            });
            if (ride?.driverId !== userId) {
                console.error(`User ${userId} not authorized to view messages in conversation ${conversationId}`);
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

        console.log('Messages fetched:', messages);
        return { success: true, messages };
    }

    async getConversations(userId: string) {
        console.log(`Fetching conversations for userId: ${userId}`);
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
        console.log('Conversations from DB:', conversations);

        const formattedConversations = await Promise.all(
            conversations.map(async (conversation) => {
                const isUserTheDriver = conversation.ride.driverId === userId;
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
                    contact = conversation.userId === userId ? conversation.ride.driver : conversation.user;
                } else if (isUserTheDriver) {
                    category = 'Passengers';
                    contact = conversation.user;
                } else {
                    category = 'Drivers';
                    contact = conversation.ride.driver;
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

        console.log('Formatted conversations:', formattedConversations);
        return { success: true, conversations: formattedConversations };
    }
}