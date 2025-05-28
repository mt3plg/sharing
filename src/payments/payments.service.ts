import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SetupPaymentMethodDto, CreatePaymentDto, RequestPayoutDto } from './interfaces/interfaces_payment.interface';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-04-30.basil', 
    });
  }

  async setupCustomer(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    this.logger.log(`Created Stripe customer ${customer.id} for user ${userId}`);
    return customer.id;
  }

  async setupDriverAccount(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.stripeAccountId) {
      return user.stripeAccountId;
    }

    const account = await this.stripe.accounts.create({
      type: 'express',
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeAccountId: account.id },
    });

    this.logger.log(`Created Stripe Connect account ${account.id} for driver ${userId}`);
    return account.id;
  }

  async addPaymentMethod(userId: string, setupPaymentMethodDto: SetupPaymentMethodDto) {
    const { paymentMethodId } = setupPaymentMethodDto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.stripeCustomerId) {
      throw new NotFoundException('User or Stripe customer not found');
    }

    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: user.stripeCustomerId,
      });

      await this.prisma.paymentMethod.create({
        data: {
          userId,
          stripePaymentMethodId: paymentMethod.id,
          type: paymentMethod.type,
          last4: paymentMethod.card?.last4,
          brand: paymentMethod.card?.brand,
        },
      });

      this.logger.log(`Added payment method ${paymentMethod.id} for user ${userId}`);
      return { success: true, paymentMethodId: paymentMethod.id };
    } catch (error) {
      this.logger.error(`Failed to add payment method: ${error}`);
      throw new BadRequestException('Failed to add payment method');
    }
  }

  async getPaymentMethods(userId: string) {
    const paymentMethods = await this.prisma.paymentMethod.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        last4: true,
        brand: true,
        createdAt: true,
      },
    });

    return { success: true, paymentMethods };
  }

  async createPayment(userId: string, createPaymentDto: CreatePaymentDto) {
    const { rideId, paymentMethodId } = createPaymentDto;

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { driver: true },
    });
    if (!ride || !ride.driverId) {
      throw new NotFoundException('Ride or driver not found');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.stripeCustomerId) {
      throw new NotFoundException('User or Stripe customer not found');
    }

    if (!ride.driver.stripeAccountId) {
      throw new BadRequestException('Driver has not set up a payout account');
    }

    if (ride.status !== 'completed') {
      throw new BadRequestException('Ride must be completed to process payment');
    }

    if (!ride.fare) {
      throw new BadRequestException('Ride fare not set');
    }

    const amount = Math.round(ride.fare * 100); // Конвертуємо в центи
    const currency = 'uah'; // Фіксована валюта, можна зробити динамічною
    const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.15');
    const commission = amount * commissionRate;
    const driverAmount = amount - commission;

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        customer: user.stripeCustomerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        application_fee_amount: Math.round(commission),
        transfer_data: {
          destination: ride.driver.stripeAccountId,
        },
      });

      const payment = await this.prisma.payment.create({
        data: {
          rideId,
          userId,
          stripePaymentIntentId: paymentIntent.id,
          amount: amount / 100,
          currency,
          status: paymentIntent.status,
          commission: commission / 100,
          driverAmount: driverAmount / 100,
        },
      });

      this.logger.log(`Created payment ${payment.id} for ride ${rideId}`);
      return { success: true, payment };
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error}`);
      throw new BadRequestException('Failed to create payment');
    }
  }

  async getPaymentHistory(userId: string, limit: number = 10, offset: number = 0) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: { ride: { select: { startLocation: true, endLocation: true } } },
    });

    const total = await this.prisma.payment.count({ where: { userId } });

    return {
      success: true,
      payments: payments.map((payment) => ({
        id: payment.id,
        rideId: payment.rideId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        createdAt: payment.createdAt,
        ride: {
          startLocation: payment.ride.startLocation,
          endLocation: payment.ride.endLocation,
        },
      })),
      total,
    };
  }

  async requestPayout(userId: string, requestPayoutDto: RequestPayoutDto) {
    const { amount, currency } = requestPayoutDto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.stripeAccountId) {
      throw new NotFoundException('User or Stripe account not found');
    }

    const availableBalance = await this.prisma.payment.aggregate({
      _sum: { driverAmount: true },
      where: { ride: { driverId: userId }, status: 'succeeded' },
    });

    const paidOut = await this.prisma.payout.aggregate({
      _sum: { amount: true },
      where: { userId, status: 'completed' },
    });

    const balance = (availableBalance._sum.driverAmount || 0) - (paidOut._sum.amount || 0);
    if (balance < amount) {
      throw new BadRequestException('Insufficient balance for payout');
    }

    try {
      const payout = await this.stripe.payouts.create({
        amount: Math.round(amount * 100),
        currency,
        destination: user.stripeAccountId,
      });

      const payoutRecord = await this.prisma.payout.create({
        data: {
          userId,
          stripePayoutId: payout.id,
          amount: amount,
          currency,
          status: payout.status,
        },
      });

      this.logger.log(`Created payout ${payoutRecord.id} for user ${userId}`);
      return { success: true, payout: payoutRecord };
    } catch (error) {
      this.logger.error(`Failed to create payout: ${error}`);
      throw new BadRequestException('Failed to create payout');
    }
  }

  async getPayoutHistory(userId: string, limit: number = 10, offset: number = 0) {
    const payouts = await this.prisma.payout.findMany({
      where: { userId },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const total = await this.prisma.payout.count({ where: { userId } });

    return { success: true, payouts, total };
  }

  async updatePaymentStatus(paymentIntentId: string, status: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status },
    });
  }

  async updatePayoutStatus(payoutId: string, status: string) {
    const payout = await this.prisma.payout.findFirst({
      where: { stripePayoutId: payoutId },
    });
    if (!payout) {
      throw new NotFoundException('Payout not found');
    }
    await this.prisma.payout.update({
      where: { id: payout.id },
      data: { status },
    });
  }

  async handleRefund(chargeId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: chargeId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'refunded' },
    });
  }

  async updateDriverAccount(accountId: string, account: Stripe.Account) {
    await this.prisma.user.updateMany({
      where: { stripeAccountId: accountId },
      data: { /* оновіть статус акаунта водія, якщо потрібно */ },
    });
  }
}