import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { PrismaService } from '../prisma.service';
import { EmailModule } from '../email/email.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [EmailModule, PaymentsModule],
  controllers: [RidesController],
  providers: [RidesService, PrismaService],
})
export class RidesModule {}