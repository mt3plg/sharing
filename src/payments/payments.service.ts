import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SetupPaymentMethodDto, CreatePaymentDto, RequestPayoutDto, ConfirmCashPaymentDto } from './interfaces/interfaces_payment.interface';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      this.logger.error('STRIPE_SECRET_KEY is not defined in environment variables');
      throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
    }
    this.logger.log('Initializing Stripe with STRIPE_SECRET_KEY (hidden for security)');
    this.stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-04-30.basil' });
  }

  async setupCustomer(userId: string): Promise<string> {
    this.logger.log(`Setting up Stripe customer for user ${userId}`);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.error(`User ${userId} not found`);
      throw new NotFoundException('User not found');
    }

    if (user.stripeCustomerId) {
      this.logger.log(`User ${userId} already has Stripe customer ID: ${user.stripeCustomerId}`);
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
    this.logger.log(`Setting up Stripe Connect account for user ${userId}`);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.error(`User ${userId} not found`);
      throw new NotFoundException('User not found');
    }

    if (user.stripeAccountId) {
      this.logger.log(`User ${userId} already has Stripe account ID: ${user.stripeAccountId}`);
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
    this.logger.log(`Adding payment method ${paymentMethodId} for user ${userId}`);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) {
      this.logger.error(`User ${userId} or Stripe customer not found`);
      throw new NotFoundException('User or Stripe customer not found');
    }

    try {
      this.logger.log(`Attaching payment method ${paymentMethodId} to customer ${user.stripeCustomerId}`);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to add payment method: ${message}`);
      throw new BadRequestException(`Failed to add payment method: ${message}`);
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

  private async validateRideAndPassenger(userId: string, rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        driver: true,
        bookingRequests: { include: { passenger: true } },
        payments: true,
      },
    });

    if (!ride || !ride.driverId) {
      this.logger.error(`Ride ${rideId} or driver not found`);
      throw new NotFoundException('Ride or driver not found');
    }

    const acceptedBooking = ride.bookingRequests.find(
      (req) => req.passengerId === userId && req.status === 'accepted'
    );
    if (!acceptedBooking) {
      this.logger.error(`User ${userId} is not an accepted passenger for ride ${rideId}`);
      throw new ForbiddenException('You are not the passenger of this ride');
    }

    if (ride.fare == null) {
      this.logger.error(`Ride ${rideId} fare not set`);
      throw new BadRequestException('Ride fare not set');
    }

    const existingPayment = ride.payments.find(p => p.userId === userId);
    if (existingPayment && ['succeeded', 'pending'].includes(existingPayment.status)) {
      this.logger.warn(`Payment already exists for user ${userId} on ride ${rideId}`);
      throw new BadRequestException('Payment for this ride already exists');
    }

    return ride;
  }

  private calculatePaymentDetails(fare: number, commissionRate: number) {
    const amount = Math.round(fare * 100); // Convert to cents
    const commission = amount * commissionRate;
    const driverAmount = amount - commission;
    return { amount, commission, driverAmount };
  }

  async createPayment(userId: string, createPaymentDto: CreatePaymentDto) {
    const { rideId, paymentMethodId, paymentMethod } = createPaymentDto;
    this.logger.log(`Creating payment for user ${userId} for ride ${rideId}`);

    const ride = await this.validateRideAndPassenger(userId, rideId);

    const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE ?? '0.15');
    const currency = 'uah';
    const { amount, commission, driverAmount } = this.calculatePaymentDetails(ride.fare!, commissionRate);

    if (paymentMethod === 'cash') {
      const payment = await this.prisma.payment.create({
        data: {
          rideId,
          userId,
          amount: amount / 100,
          currency,
          paymentMethod: 'cash',
          status: 'pending',
          isPaid: false,
          commission: commission / 100,
          driverAmount: driverAmount / 100,
        },
      });

      this.logger.log(`Created cash payment ${payment.id} for ride ${rideId}`);
      return { success: true, payment };
    }

    if (paymentMethod === 'google_pay' || paymentMethod === 'apple_pay') {
      let user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        this.logger.error(`User ${userId} not found`);
        throw new NotFoundException('User not found');
      }

      if (!user.stripeCustomerId) {
        await this.setupCustomer(userId);
        user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user?.stripeCustomerId) {
          this.logger.error(`Failed to set up Stripe customer for user ${userId}`);
          throw new BadRequestException('Failed to set up Stripe customer');
        }
      }

      if (!ride.driver.stripeAccountId) {
        this.logger.log(`Setting up Stripe Connect account for driver ${ride.driverId}`);
        await this.setupDriverAccount(ride.driverId);
        const updatedDriver = await this.prisma.user.findUnique({ where: { id: ride.driverId } });
        if (!updatedDriver?.stripeAccountId) {
          this.logger.error(`Failed to set up Stripe account for driver ${ride.driverId}`);
          throw new BadRequestException('Failed to set up driver payout account');
        }
        ride.driver.stripeAccountId = updatedDriver.stripeAccountId;
      }

      if (!paymentMethodId) {
        this.logger.error(`Payment method ID missing for digital payment`);
        throw new BadRequestException('Payment method ID is required for digital payments');
      }

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
            paymentMethod,
            status: paymentIntent.status,
            isPaid: paymentIntent.status === 'succeeded',
            commission: commission / 100,
            driverAmount: driverAmount / 100,
          },
        });

        this.logger.log(`Created digital payment ${payment.id} for ride ${rideId}`);
        return { success: true, payment };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to create digital payment for ride ${rideId}: ${message}`);
        throw new BadRequestException(`Failed to create digital payment: ${message}`);
      }
    }

    this.logger.error(`Invalid payment method: ${paymentMethod}`);
    throw new BadRequestException('Invalid payment method');
  }

  async confirmCashPayment(userId: string, confirmCashPaymentDto: ConfirmCashPaymentDto) {
    const { paymentId } = confirmCashPaymentDto;

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { ride: { include: { driver: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.paymentMethod !== 'cash') {
      throw new BadRequestException('This payment is not a cash payment');
    }

    if (payment.ride.driverId !== userId) {
      throw new ForbiddenException('You are not the driver of this ride');
    }

    if (payment.isPaid) {
      throw new BadRequestException('Payment already confirmed');
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        isPaid: true,
        status: 'succeeded',
      },
    });

    this.logger.log(`Cash payment ${paymentId} confirmed by driver ${userId}`);
    return { success: true, payment: updatedPayment };
  }

  async getPaymentHistory(userId: string, limit: number = 10, offset: number = 0, rideId?: string) {
    const whereClause: any = {
      OR: [
        { userId }, // Платежі, створені користувачем (пасажиром)
        { ride: { driverId: userId } }, // Платежі для поїздок, де користувач є водієм
      ],
    };

    if (rideId) {
      whereClause.rideId = rideId; // Фільтр за rideId, якщо вказано
    }

    const payments = await this.prisma.payment.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: { ride: { select: { startLocation: true, endLocation: true } } },
    });

    const total = await this.prisma.payment.count({ where: whereClause });

    return {
      success: true,
      payments: payments.map((payment) => ({
        id: payment.id,
        rideId: payment.rideId,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        isPaid: payment.isPaid,
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
    if (!user?.stripeAccountId) {
      throw new NotFoundException('User or Stripe account not found');
    }

    const availableBalance = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: { ride: { driverId: userId }, status: 'succeeded', isPaid: true },
    });

    const paidOut = await this.prisma.payout.aggregate({
      _sum: { amount: true },
      where: { userId, status: 'completed' },
    });

    const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE ?? '0.15');
    const balance = ((availableBalance._sum?.amount ?? 0) - (paidOut._sum?.amount ?? 0)) * (1 - commissionRate);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create payout: ${message}`);
      throw new BadRequestException(`Failed to create payout: ${message}`);
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
      data: { status, isPaid: status === 'succeeded' },
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
      data: { status: 'refunded', isPaid: false },
    });
  }

  async updateDriverAccount(accountId: string, account: Stripe.Account) {
    await this.prisma.user.updateMany({
      where: { stripeAccountId: accountId },
      data: { /* оновіть статус акаунта водія, якщо потрібно */ },
    });
  }

  private async handlePaymentIntentSucceeded(event: Stripe.Event) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    await this.updatePaymentStatus(paymentIntent.id, 'succeeded');
    this.logger.log(`Payment succeeded: ${paymentIntent.id}`);
  }

  private async handlePaymentIntentFailed(event: Stripe.Event) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    await this.updatePaymentStatus(paymentIntent.id, 'failed');
    this.logger.log(`Payment failed: ${paymentIntent.id}`);
  }

  private async handlePayoutCreated(event: Stripe.Event) {
    const payout = event.data.object as Stripe.Payout;
    await this.updatePayoutStatus(payout.id, 'completed');
    this.logger.log(`Payout created: ${payout.id}`);
  }

  private async handlePayoutFailed(event: Stripe.Event) {
    const payout = event.data.object as Stripe.Payout;
    await this.updatePayoutStatus(payout.id, 'failed');
    this.logger.log(`Payout failed: ${payout.id}`);
  }

  async handleWebhook(payload: any, signature: string, rawBody: Buffer) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Webhook Error: ${message}`);
      throw new BadRequestException(`Webhook Error: ${message}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event);
        break;
      case 'payout.created':
        await this.handlePayoutCreated(event);
        break;
      case 'payout.failed':
        await this.handlePayoutFailed(event);
        break;
      default:
        this.logger.log(`Unhandled event type ${event.type}`);
    }
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    this.logger.log(`Deleting payment method ${paymentMethodId} for user ${userId}`);

    const paymentMethod = await this.prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId },
    });

    if (!paymentMethod || paymentMethod.userId !== userId) {
      this.logger.error(`Payment method ${paymentMethodId} not found or does not belong to user ${userId}`);
      throw new NotFoundException('Payment method not found');
    }

    try {
      await this.stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);
      await this.prisma.paymentMethod.delete({
        where: { id: paymentMethodId },
      });

      this.logger.log(`Deleted payment method ${paymentMethodId} for user ${userId}`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete payment method: ${message}`);
      throw new BadRequestException(`Failed to delete payment method: ${message}`);
    }
  }
}