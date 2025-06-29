import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import * as bodyParser from 'body-parser';

// Розширюємо тип Socket для додавання user
declare module 'socket.io' {
  interface Socket {
    user?: { sub: string }; // Визначаємо user із sub (userId)
  }
}

// Завантажуємо змінні середовища з файлу .env
dotenv.config();

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Starting application bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  logger.log('Nest application created successfully');

  const httpServer = createServer(app.getHttpAdapter().getInstance());
  logger.log('HTTP server created');

  // Ініціалізація WebSocket-сервера
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // Змініть на фронтенд-URL у продакшені
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });
  logger.log('WebSocket server initialized');

  // Зберігаємо io глобально для використання в ConversationsService
  global.io = io;
  logger.log('WebSocket server instance stored globally');

  // Налаштування WebSocket-аутентифікації
  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token || !token.startsWith('Bearer ')) {
      logger.error('WebSocket authentication failed: No token provided', socket.id);
      return next(new Error('Authentication error'));
    }
    try {
      const jwtService = app.get(JwtService);
      const payload = await jwtService.verifyAsync(token.replace('Bearer ', ''));
      socket.user = payload;
      logger.log(`WebSocket authenticated user: ${payload.sub} for socket ${socket.id}`);
      next();
    } catch (err: unknown) {
      logger.error('WebSocket authentication failed:', (err as Error).message, socket.id);
      next(new Error('Authentication error'));
    }
  });

  // Обробка WebSocket-подій
  io.on('connection', (socket: Socket) => {
    logger.log(`WebSocket client connected: ${socket.id}, user: ${socket.user?.sub}`);

    socket.on('joinConversation', (conversationId) => {
      logger.log(`Client ${socket.id} joined conversation: ${conversationId}`);
      socket.join(conversationId);
    });

    socket.on('leaveConversation', (conversationId) => {
      logger.log(`Client ${socket.id} left conversation: ${conversationId}`);
      socket.leave(conversationId);
    });

    socket.on('sendMessage', ({ conversationId, message }) => {
      logger.log(`Received message for ${conversationId} from ${socket.id}: ${JSON.stringify(message)}`);
      // Повідомлення обробляються в ConversationsService.sendMessage
    });

    socket.on('disconnect', (reason) => {
      logger.log(`WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  // Налаштування для вебхуків Stripe
  app.use(
    '/payments/webhooks/stripe',
    bodyParser.raw({ type: 'application/json' }),
    (req, res, next) => {
      req.rawBody = req.body;
      logger.log(`Stripe webhook received at /payments/webhooks/stripe`);
      next();
    },
  );

  // Налаштування Swagger
  const config = new DocumentBuilder()
    .setTitle('Carpooling API')
    .setDescription('API for the Carpooling application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  logger.log('Swagger document created');
  SwaggerModule.setup('api', app, document);

  // Налаштування валідації
  app.useGlobalPipes(new ValidationPipe());
  logger.log('Global validation pipe configured');

  // Налаштування статичного доступу до файлів
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  logger.log('Static assets configured for /uploads/');

  // Отримуємо порт зі змінних середовища або використовуємо 3000 за замовчуванням
  const port = process.env.PORT || 3000;
  logger.log(`Using port: ${port}`);

  // Запускаємо сервер
  await app.listen(port);
  logger.log(`Server is running on http://localhost:${port}`);
}
bootstrap();