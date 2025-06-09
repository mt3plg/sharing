import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'],
    });
    this.logger.log('Prisma Client initialized with models:', Object.keys(this));
  }

  async onModuleInit() {
    try {
      this.logger.log('Attempting to connect to database with DATABASE_URL:', process.env.DATABASE_URL);
      await this.$connect();
      this.logger.log('Prisma connected to database successfully');
    } catch (error) {
      this.logger.error('Prisma connection error:', error);
      throw error; // Передаємо помилку далі для обробки NestJS
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Prisma disconnected from database');
    } catch (error) {
      this.logger.error('Prisma disconnection error:', error);
    }
  }
}