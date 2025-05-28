import { Controller, Post, Get, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SetupPaymentMethodDto, CreatePaymentDto, RequestPayoutDto } from './interfaces/interfaces_payment.interface';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../common/decorators/common_decorators_user.decorator';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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
}