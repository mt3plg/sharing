import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Get,
    UseGuards,
    Query, // Додай імпорт Query
    BadRequestException, // Додай імпорт для BadRequestException
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto, SignInDto, VerifyDto } from './interfaces/interfaces_auth.interface';
import { ApiTags, ApiBearerAuth, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthUser } from '../common/decorators/common_decorators_user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('signup')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Реєстрація нового користувача' })
    @ApiResponse({ status: 201, description: 'Користувач зареєстрований успішно' })
    @ApiResponse({ status: 400, description: 'Email або номер телефону вже існує' })
    async signup(@Body() signupDto: SignUpDto) {
        return this.authService.signup(signupDto);
    }

    @Post('signin')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Вхід користувача' })
    @ApiResponse({ status: 200, description: 'Користувач увійшов успішно' })
    @ApiResponse({ status: 400, description: 'Невірні облікові дані' })
    async signin(@Body() signinDto: SignInDto) {
        return this.authService.signin(signinDto);
    }

    @Post('verify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Верифікація email користувача' })
    @ApiResponse({ status: 200, description: 'Email верифіковано успішно' })
    @ApiResponse({ status: 400, description: 'Невірний код верифікації' })
    async verify(@Body() verifyDto: VerifyDto) {
        return this.authService.verifyEmail(verifyDto.email, verifyDto.token);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Отримати дані поточного користувача' })
    @ApiResponse({ status: 200, description: 'Дані користувача отримані успішно' })
    @ApiResponse({ status: 400, description: 'Користувача не знайдено' })
    async me(@AuthUser() user: any) {
        return this.authService.getMe(user.id);
    }

    @Post('send-verification-code')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Надіслати код верифікації для зміни пароля' })
    @ApiResponse({ status: 200, description: 'Код верифікації надіслано' })
    @ApiResponse({ status: 400, description: 'Користувача не знайдено' })
    async sendVerificationCode(@Body('email') email: string) {
        return this.authService.sendVerificationCode(email);
    }

    @Post('verify-password-change')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Верифікувати код для зміни пароля' })
    @ApiResponse({ status: 200, description: 'Код верифіковано успішно' })
    @ApiResponse({ status: 400, description: 'Невірний код верифікації' })
    async verifyPasswordChangeCode(@Body('email') email: string, @Body('code') code: string) {
        return this.authService.verifyPasswordChangeCode(email, code);
    }

    // Новий маршрут для обробки OAuth callback
    @Get('callback')
    @ApiOperation({ summary: 'Обробка OAuth callback від Google' })
    @ApiResponse({ status: 200, description: 'Токени отримані успішно' })
    @ApiResponse({ status: 400, description: 'Помилка авторизації' })
    async handleOAuthCallback(@Query('code') code: string) {
        if (!code) {
            throw new BadRequestException('Authorization code not provided');
        }
        const tokens = await this.authService.exchangeCodeForTokens(code);
        return {
            message: 'Authorization successful',
            refresh_token: tokens.refresh_token,
        };
    }
}