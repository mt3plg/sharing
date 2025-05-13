// src/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        super({
            log: ['query', 'info', 'warn', 'error'],
        });
        console.log('Prisma Client initialized with models:', Object.keys(this));
    }

    async onModuleInit() {
        await this.$connect();
        console.log('Prisma connected to database');
    }

    async onModuleDestroy() {
        await this.$disconnect();
        console.log('Prisma disconnected from database');
    }
}