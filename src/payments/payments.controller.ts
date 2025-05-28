import { Controller, Post, Get, Body, Query, UseGuards, HttpCode, HttpStatus, Request, Logger, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SetupPaymentMethodDto, CreatePaymentDto, RequestPayoutDto, ConfirmCashPaymentDto } from './interfaces/interfaces_payment.interface';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('setup-customer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Setup Stripe customer for passenger' })
  @ApiResponse({ status: 200, description: 'Customer successfully set up' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async setupCustomer(@Request() req) {
    const userId = req.user?.id;
    this.logger.log(`Setting up Stripe customer for user ${userId}`);
    return this.paymentsService.setupCustomer(userId);
  }

  @Post('setup-driver')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Setup Stripe Connect account for driver' })
  @ApiResponse({ status: 200, description: 'Driver account successfully set up' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async setupDriverAccount(@Request() req) {
    const userId = req.user?.id;
    this.logger.log(`Setting up Stripe Connect account for user ${userId}`);
    return this.paymentsService.setupDriverAccount(userId);
  }

  @Post('method')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add payment method' })
  @ApiResponse({ status: 201, description: 'Payment method successfully added' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addPaymentMethod(@Body() setupPaymentMethodDto: SetupPaymentMethodDto, @Request() req) {
    const userId = req.user?.id;
    this.logger.log(`Adding payment method for user ${userId}: ${JSON.stringify(setupPaymentMethodDto)}`);
    return this.paymentsService.addPaymentMethod(userId, setupPaymentMethodDto);
  }

  @Get('methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user payment methods' })
  @ApiResponse({ status: 200, description: 'Payment methods successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPaymentMethods(@Request() req) {
    const userId = req.user?.id;
    this.logger.log(`Fetching payment methods for user ${userId}`);
    return this.paymentsService.getPaymentMethods(userId);
  }

  @Post('ride')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create payment for a ride' })
  @ApiResponse({ status: 201, description: 'Payment successfully created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPayment(@Body() createPaymentDto: CreatePaymentDto, @Request() req) {
    const userId = req.user?.id;
    this.logger.log(`Creating payment for user ${userId}: ${JSON.stringify(createPaymentDto)}`);
    return this.paymentsService.createPayment(userId, createPaymentDto);
  }

  @Post('confirm-cash')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm cash payment by driver' })
  @ApiResponse({ status: 200, description: 'Cash payment confirmed' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async confirmCashPayment(@Body() confirmCashPaymentDto: ConfirmCashPaymentDto, @Request() req) {
    const userId = req.user?.id;
    this.logger.log(`Confirming cash payment for user ${userId}: ${JSON.stringify(confirmCashPaymentDto)}`);
    return this.paymentsService.confirmCashPayment(userId, confirmCashPaymentDto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment history' })
  @ApiResponse({ status: 200, description: 'Payment history successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPaymentHistory(
    @Request() req,
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
  ) {
    const userId = req.user?.id;
    this.logger.log(`Fetching payment history for user ${userId} with limit ${limit}, offset ${offset}`);
    return this.paymentsService.getPaymentHistory(userId, parseInt(limit), parseInt(offset));
  }

  @Post('payout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request payout for driver' })
  @ApiResponse({ status: 201, description: 'Payout successfully created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async requestPayout(@Body() requestPayoutDto: RequestPayoutDto, @Request() req) {
    const userId = req.user?.id;
    this.logger.log(`Requesting payout for user ${userId}: ${JSON.stringify(requestPayoutDto)}`);
    return this.paymentsService.requestPayout(userId, requestPayoutDto);
  }

  @Get('payout/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payout history' })
  @ApiResponse({ status: 200, description: 'Payout history successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPayoutHistory(
    @Request() req,
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
  ) {
    const userId = req.user?.id;
    this.logger.log(`Fetching payout history for user ${userId} with limit ${limit}, offset ${offset}`);
    return this.paymentsService.getPayoutHistory(userId, parseInt(limit), parseInt(offset));
  }

  @Post('webhooks/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhooks' })
  @ApiResponse({ status: 200, description: 'Webhook successfully processed' })
  @ApiResponse({ status: 400, description: 'Invalid webhook' })
  async handleWebhook(@Request() request: any, @Body() payload: any) {
    const sig = request.headers['stripe-signature'] as string;
    try {
      this.logger.log('Processing Stripe webhook');
      await this.paymentsService.handleWebhook(payload, sig, request.rawBody);
      return { received: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Webhook error: ${errorMessage}`);
      throw new BadRequestException(`Webhook error: ${errorMessage}`);
    }
  }
}