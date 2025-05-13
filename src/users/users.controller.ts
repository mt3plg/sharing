import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    NotFoundException,
    HttpCode,
    HttpStatus,
    Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateLocationDto } from '../dto/update-location.dto';
import { CreateReviewDto } from '../dto/create-review.dto';
import { SearchUsersQueryDto } from './interfaces/search-users-query.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser } from '../common/decorators/common_decorators_user.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    @ApiOperation({ summary: 'Створити нового користувача' })
    @ApiResponse({ status: 201, description: 'Користувача успішно створено.' })
    @ApiResponse({ status: 400, description: 'Помилка запиту.' })
    create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get('me')
    @ApiOperation({ summary: 'Отримати дані поточного користувача' })
    @ApiResponse({ status: 200, description: 'Повертає дані користувача.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async getCurrentUser(@Request() req) {
        return this.usersService.findOne(req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Patch('me')
    @ApiOperation({ summary: 'Оновити профіль поточного користувача' })
    @ApiResponse({ status: 200, description: 'Профіль користувача успішно оновлений.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(req.user.id, updateUserDto);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Patch('me/password')
    @ApiOperation({ summary: 'Змінити пароль поточного користувача' })
    @ApiResponse({ status: 200, description: 'Пароль успішно змінений.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    @ApiResponse({ status: 400, description: 'Помилка запиту.' })
    async changePassword(
        @Request() req,
        @Body('currentPassword') currentPassword: string,
        @Body('newPassword') newPassword: string,
        @Body('verificationCode') verificationCode: string,
    ) {
        return this.usersService.changePassword(req.user.id, req.user.email, currentPassword, newPassword, verificationCode);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Patch('me/location')
    @ApiOperation({ summary: "Оновити місце розташування поточного користувача" })
    @ApiResponse({ status: 200, description: "Місце розташування користувача успішно оновлено." })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async updateLocation(@Request() req, @Body() updateLocationDto: UpdateLocationDto) {
        return this.usersService.updateLocation(req.user.id, updateLocationDto);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('me/avatar')
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: "Завантажити аватар поточного користувача" })
    @ApiResponse({ status: 200, description: "Аватар користувача успішно завантажено." })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    @ApiResponse({ status: 400, description: 'Помилка запиту.' })
    @UseInterceptors(FileInterceptor('avatar'))
    async uploadAvatar(@Request() req, @UploadedFile() file: Express.Multer.File) {
        console.log('Received file:', file);
        if (!file) {
            throw new BadRequestException('Файл не завантажено');
        }
        if (!file.filename) {
            throw new BadRequestException('File upload failed: filename is undefined');
        }
        const avatarPath = `/uploads/avatars/${file.filename}`;
        console.log('Saving avatar with path:', avatarPath);
        const updatedUser = await this.usersService.updateAvatar(req.user.id, avatarPath);
        return updatedUser;
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Отримати профіль користувача за ID' })
    @ApiResponse({ status: 200, description: 'Повертає профіль користувача.' })
    @ApiResponse({ status: 404, description: 'Користувача не знайдено.' })
    async getUserProfile(@Param('id') userId: string, @AuthUser() user: any) {
        return this.usersService.getUserProfile(userId, user.id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Оновити користувача за ID' })
    @ApiResponse({ status: 200, description: 'Користувача успішно оновлено.' })
    @ApiResponse({ status: 404, description: 'Користувача не знайдено.' })
    update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(id, updateUserDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Видалити користувача за ID' })
    @ApiResponse({ status: 200, description: 'Користувача успішно видалено.' })
    @ApiResponse({ status: 404, description: 'Користувача не знайдено.' })
    remove(@Param('id') id: string) {
        return this.usersService.remove(id);
    }

    @Post(':id/reviews')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Додати відгук користувачу' })
    @ApiResponse({ status: 201, description: 'Відгук успішно додано.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async createReview(
        @Param('id') userId: string,
        @Body() createReviewDto: CreateReviewDto,
        @AuthUser() user: any,
    ) {
        return this.usersService.createReview(userId, createReviewDto, user.id);
    }

    @Post('friends')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Додати користувача в друзі' })
    @ApiResponse({ status: 201, description: 'Користувача успішно додано в друзі.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async addFriend(@Body('friendId') friendId: string, @AuthUser() user: any) {
        return this.usersService.addFriend(user.id, friendId);
    }

    @Get('me/reviews')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Отримати відгуки поточного користувача' })
    @ApiResponse({ status: 200, description: 'Повертає список відгуків.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async getUserReviews(@AuthUser() user: any) {
        return this.usersService.getUserReviews(user.id);
    }

    @Get(':id/can-review')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Перевірити, чи можна залишити відгук користувачу' })
    @ApiResponse({ status: 200, description: 'Повертає, чи можна залишити відгук.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async checkCanReview(@Param('id') userId: string, @AuthUser() user: any) {
        return this.usersService.checkCanReview(userId, user.id);
    }

    @Post('me/booking-requests')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Створити запит на бронювання' })
    @ApiResponse({ status: 201, description: 'Запит на бронювання успішно створено.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async createBookingRequest(
        @Body('rideId') rideId: string,
        @AuthUser() user: any,
    ) {
        return this.usersService.createBookingRequest(rideId, user.id);
    }

    @Get('me/booking-requests')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Отримати запити на бронювання для водія' })
    @ApiResponse({ status: 200, description: 'Повертає список запитів на бронювання.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async getBookingRequests(@AuthUser() user: any) {
        return this.usersService.getBookingRequests(user.id);
    }

    @Post('booking-requests/:id/accept')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Прийняти запит на бронювання' })
    @ApiResponse({ status: 200, description: 'Запит на бронювання прийнято.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async acceptBookingRequest(
        @Param('id') bookingRequestId: string,
        @AuthUser() user: any,
    ) {
        return this.usersService.acceptBookingRequest(bookingRequestId, user.id);
    }

    @Post('booking-requests/:id/reject')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Відхилити запит на бронювання' })
    @ApiResponse({ status: 200, description: 'Запит на бронювання відхилено.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async rejectBookingRequest(
        @Param('id') bookingRequestId: string,
        @AuthUser() user: any,
    ) {
        return this.usersService.rejectBookingRequest(bookingRequestId, user.id);
    }

    @Get('search')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Search users by name or email with pagination and category filter' })
    @ApiResponse({ status: 200, description: 'Returns a list of users.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async searchUsers(
        @Query() queryDto: SearchUsersQueryDto,
        @AuthUser() user: any,
    ) {
        return this.usersService.searchUsers(
            queryDto.query,
            user.id,
            queryDto.category,
            queryDto.limit,
            queryDto.offset,
        );
    }

    // users.controller.ts
@Get('me/friends')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({ summary: 'Get friends of the current user' })
@ApiResponse({ status: 200, description: 'Returns list of friends.' })
async getFriends(@AuthUser() user: any) {
    return this.usersService.getFriends(user.id);
}
}