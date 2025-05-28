import { Controller, Post, Get, Body, Query, UseGuards, HttpCode, HttpStatus, Request, Logger } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SetupPaymentMethodDto, CreatePaymentDto, RequestPayoutDto, ConfirmCashPaymentDto } from './interfaces/interfaces_payment.interface';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../common/decorators/common_decorators_user.decorator';
import Stripe from 'stripe';
import { BadRequestException } from '@nestjs/common'; // Додаємо імпорт BadRequestException

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(PaymentsController.name); // Створюємо власний logger для PaymentsController

  constructor(private readonly paymentsService: PaymentsService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-04-30.basil',
    });
  }

  @Post('setup-customer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Налаштування Stripe клієнта для пасажира' })
  @ApiResponse({ status: 200, description: 'Клієнт успішно налаштований' })
  async setupCustomer(@AuthUser() user: any) {
    return this.paymentsService.setupCustomer(user.sub);
  }

  @Post('setup-driver')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Налаштування Stripe Connect акаунта для водія' })
  @ApiResponse({ status: 200, description: 'Акаунт водія успішно налаштований' })
  async setupDriverAccount(@AuthUser() user: any) {
    return this.paymentsService.setupDriverAccount(user.sub);
  }

  @Post('method')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Додавання платіжного методу' })
  @ApiResponse({ status: 201, description: 'Платіжний метод успішно додано' })
  async addPaymentMethod(@Body() setupPaymentMethodDto: SetupPaymentMethodDto, @AuthUser() user: any) {
    return this.paymentsService.addPaymentMethod(user.sub, setupPaymentMethodDto);
  }

  @Get('methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отримання платіжних методів користувача' })
  @ApiResponse({ status: 200, description: 'Платіжні методи успішно отримано' })
  async getPaymentMethods(@AuthUser() user: any) {
    return this.paymentsService.getPaymentMethods(user.sub);
  }

  @Post('ride')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Створення платежу за поїздку' })
  @ApiResponse({ status: 201, description: 'Платіж успішно створено' })
  async createPayment(@Body() createPaymentDto: CreatePaymentDto, @AuthUser() user: any) {
    return this.paymentsService.createPayment(user.sub, createPaymentDto);
  }

  @Post('confirm-cash')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Підтвердження оплати готівкою водієм' })
  @ApiResponse({ status: 200, description: 'Оплату готівкою підтверджено' })
  @ApiResponse({ status: 403, description: 'Заборонено' })
  @ApiResponse({ status: 404, description: 'Платіж не знайдено' })
  async confirmCashPayment(@Body() confirmCashPaymentDto: ConfirmCashPaymentDto, @AuthUser() user: any) {
    return this.paymentsService.confirmCashPayment(user.sub, confirmCashPaymentDto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отримання історії платежів' })
  @ApiResponse({ status: 200, description: 'Історія платежів успішно отримана' })
  async getPaymentHistory(
    @AuthUser() user: any,
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
  ) {
    return this.paymentsService.getPaymentHistory(user.sub, parseInt(limit), parseInt(offset));
  }

  @Post('payout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Запит на виплату для водія' })
  @ApiResponse({ status: 201, description: 'Виплата успішно створена' })
  async requestPayout(@Body() requestPayoutDto: RequestPayoutDto, @AuthUser() user: any) {
    return this.paymentsService.requestPayout(user.sub, requestPayoutDto);
  }

  @Get('payout/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отримання історії виплат' })
  @ApiResponse({ status: 200, description: 'Історія виплат успішно отримана' })
  async getPayoutHistory(
    @AuthUser() user: any,
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
  ) {
    return this.paymentsService.getPayoutHistory(user.sub, parseInt(limit), parseInt(offset));
  }

  @Post('webhooks/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обробка вебхуків від Stripe' })
  @ApiResponse({ status: 200, description: 'Вебхук успішно оброблено' })
  @ApiResponse({ status: 400, description: 'Невірний вебхук' })
  async handleWebhook(@Request() request: any, @Body() payload: any) {
    const sig = request.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        request.rawBody || JSON.stringify(payload),
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      // Приводимо err до типу Error для безпечного доступу до message
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Webhook Error: ${errorMessage}`);
      throw new BadRequestException('Webhook Error');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.paymentsService.updatePaymentStatus(paymentIntent.id, 'succeeded');
        this.logger.log(`Payment succeeded: ${paymentIntent.id}`);
        break;
      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.paymentsService.updatePaymentStatus(failedPaymentIntent.id, 'failed');
        this.logger.log(`Payment failed: ${failedPaymentIntent.id}`);
        break;
      case 'payout.created':
        const payout = event.data.object as Stripe.Payout;
        await this.paymentsService.updatePayoutStatus(payout.id, 'completed');
        this.logger.log(`Payout created: ${payout.id}`);
        break;
      case 'payout.failed':
        const failedPayout = event.data.object as Stripe.Payout;
        await this.paymentsService.updatePayoutStatus(failedPayout.id, 'failed');
        this.logger.log(`Payout failed: ${failedPayout.id}`);
        break;
      default:
        this.logger.log(`Unhandled event type ${event.type}`);
    }

    return { received: true };
  }
}