import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    WebSocketServer,
    ConnectedSocket,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConversationsService } from './conversations.service';
import { CreateMessageDto } from './interfaces/interfaces_conversation.interface';
import { Logger } from '@nestjs/common';

interface ExtendedSocket extends Socket {
    request: Socket['request'] & { user?: { id: string; email: string; role: string } };
}

@WebSocketGateway({ cors: { origin: process.env.NGROK_URL || 'NGROK_URL', credentials: true } })
export class ConversationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private logger = new Logger('ConversationsGateway');

    constructor(private readonly conversationsService: ConversationsService) {}

    afterInit(server: Server) {
        this.logger.log('WebSocket Gateway initialized');
    }

    handleConnection(client: ExtendedSocket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: ExtendedSocket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('sendMessage')
    async handleMessage(
        @MessageBody() data: { conversationId: string; message: { text: string } },
        @ConnectedSocket() client: ExtendedSocket,
    ) {
        try {
            const user = client.request.user;
            if (!user || !user.id) {
                this.logger.error('User not authenticated');
                throw new Error('User not authenticated');
            }

            this.logger.log(`Received sendMessage from user ${user.id}:`, data);

            const createMessageDto: CreateMessageDto = { content: data.message.text };
            const messageResponse = await this.conversationsService.sendMessage(
                data.conversationId,
                createMessageDto,
                user.id,
            );

            if (messageResponse.success) {
                this.logger.log(`Emitting newMessage to conversation ${data.conversationId}:`, messageResponse.message);
                this.server.to(data.conversationId).emit('newMessage', messageResponse.message);
                return messageResponse;
            } else {
                throw new Error('Failed to send message');
            }
        } catch (error) {
            const err = error as Error;
            this.logger.error(`Error handling sendMessage: ${err.message}`, err.stack);
            client.emit('error', { message: err.message || 'Failed to send message' });
        }
    }

    @SubscribeMessage('joinConversation')
    handleJoinConversation(
        @MessageBody() conversationId: string,
        @ConnectedSocket() client: ExtendedSocket,
    ) {
        try {
            const user = client.request.user;
            if (!user || !user.id) {
                this.logger.error('User not authenticated for joinConversation');
                throw new Error('User not authenticated');
            }

            this.logger.log(`Client ${client.id} (user ${user.id}) joined conversation ${conversationId}`);
            client.join(conversationId);
            client.emit('joinedConversation', { conversationId });
        } catch (error) {
            const err = error as Error;
            this.logger.error(`Error joining conversation: ${err.message}`, err.stack);
            client.emit('error', { message: err.message || 'Failed to join conversation' });
        }
    }

    @SubscribeMessage('leaveConversation')
    handleLeaveConversation(
        @MessageBody() conversationId: string,
        @ConnectedSocket() client: ExtendedSocket,
    ) {
        try {
            const user = client.request.user;
            if (!user || !user.id) {
                this.logger.error('User not authenticated for leaveConversation');
                throw new Error('User not authenticated');
            }

            this.logger.log(`Client ${client.id} (user ${user.id}) left conversation ${conversationId}`);
            client.leave(conversationId);
            client.emit('leftConversation', { conversationId });
        } catch (error) {
            const err = error as Error;
            this.logger.error(`Error leaving conversation: ${err.message}`, err.stack);
            client.emit('error', { message: err.message || 'Failed to leave conversation' });
        }
    }
}