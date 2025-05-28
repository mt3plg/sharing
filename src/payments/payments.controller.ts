import { Controller, Post, Get, Body, Query, UseGuards, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SetupPaymentMethodDto, CreatePaymentDto, RequestPayoutDto, ConfirmCashPaymentDto } from './interfaces/interfaces_payment.interface';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../common/decorators/common_decorators_user.decorator';
import { Logger, BadRequestException } from '@nestjs/common';

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
  async setupCustomer(@AuthUser() user: any) {
    return this.paymentsService.setupCustomer(user.sub);
  }

  @Post('setup-driver')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Setup Stripe Connect account for driver' })
  @ApiResponse({ status: 200, description: 'Driver account successfully set up' })
  async setupDriverAccount(@AuthUser() user: any) {
    return this.paymentsService.setupDriverAccount(user.sub);
  }

  @Post('method')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add payment method' })
  @ApiResponse({ status: 201, description: 'Payment method successfully added' })
  async addPaymentMethod(@Body() setupPaymentMethodDto: SetupPaymentMethodDto, @AuthUser() user: any) {
    return this.paymentsService.addPaymentMethod(user.sub, setupPaymentMethodDto);
  }

  @Get('methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user payment methods' })
  @ApiResponse({ status: 200, description: 'Payment methods successfully retrieved' })
  async getPaymentMethods(@AuthUser() user: any) {
    return this.paymentsService.getPaymentMethods(user.sub);
  }

  @Post('ride')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create payment for a ride' })
  @ApiResponse({ status: 201, description: 'Payment successfully created' })
  async createPayment(@Body() createPaymentDto: CreatePaymentDto, @AuthUser() user: any) {
    return this.paymentsService.createPayment(user.sub, createPaymentDto);
  }

  @Post('confirm-cash')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm cash payment by driver' })
  @ApiResponse({ status: 200, description: 'Cash payment confirmed' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async confirmCashPayment(@Body() confirmCashPaymentDto: ConfirmCashPaymentDto, @AuthUser() user: any) {
    return this.paymentsService.confirmCashPayment(user.sub, confirmCashPaymentDto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment history' })
  @ApiResponse({ status: 200, description: 'Payment history successfully retrieved' })
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
  @ApiOperation({ summary: 'Request payout for driver' })
  @ApiResponse({ status: 201, description: 'Payout successfully created' })
  async requestPayout(@Body() requestPayoutDto: RequestPayoutDto, @AuthUser() user: any) {
    return this.paymentsService.requestPayout(user.sub, requestPayoutDto);
  }

  @Get('payout/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payout history' })
  @ApiResponse({ status: 200, description: 'Payout history successfully retrieved' })
  async getPayoutHistory(
    @AuthUser() user: any,
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
  ) {
    return this.paymentsService.getPayoutHistory(user.sub, parseInt(limit), parseInt(offset));
  }

  @Post('webhooks/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhooks' })
  @ApiResponse({ status: 200, description: 'Webhook successfully processed' })
  @ApiResponse({ status: 400, description: 'Invalid webhook' })
  async handleWebhook(@Request() request: any, @Body() payload: any) {
    const sig = request.headers['stripe-signature'] as string;
    try {
      await this.paymentsService.handleWebhook(payload, sig, request.rawBody);
      return { received: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Webhook Error: ${errorMessage}`);
      throw new BadRequestException('Webhook Error');
    }
  }
}