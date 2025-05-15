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
    @ApiOperation({ summary: 'Оновити місце розташування поточного користувача' })
    @ApiResponse({ status: 200, description: 'Місце розташування користувача успішно оновлено.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async updateLocation(@Request() req, @Body() updateLocationDto: UpdateLocationDto) {
        return this.usersService.updateLocation(req.user.id, updateLocationDto);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('me/avatar')
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Завантажити аватар поточного користувача' })
    @ApiResponse({ status: 200, description: 'Аватар користувача успішно завантажено.' })
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
        const avatarPath = `/Uploads/avatars/${file.filename}`;
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

    @Get('me/reviews')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Отримати відгуки поточного користувача' })
    @ApiResponse({ status: 200, description: 'Повертає список відгуків користувача.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async getUserReviews(@AuthUser() user: any) {
        return this.usersService.getUserReviews(user.id);
    }

    @Post('friend-requests')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Надіслати запит на дружбу' })
    @ApiResponse({ status: 201, description: 'Запит на дружбу успішно надіслано.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async sendFriendRequest(
        @AuthUser() user: any,
        @Body('receiverId') receiverId: string,
    ) {
        return this.usersService.createFriendRequest(user.id, receiverId);
    }

    @Get('friend-requests/incoming')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Отримати вхідні запити на дружбу' })
    @ApiResponse({ status: 200, description: 'Повертає список вхідних запитів на дружбу.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async getIncomingFriendRequests(@AuthUser() user: any) {
        return this.usersService.getIncomingFriendRequests(user.id);
    }

    @Patch('friend-requests/:id/accept')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Прийняти запит на дружбу' })
    @ApiResponse({ status: 200, description: 'Запит на дружбу прийнято.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async acceptFriendRequest(
        @Param('id') requestId: string,
        @AuthUser() user: any,
    ) {
        return this.usersService.acceptFriendRequest(requestId, user.id);
    }

    @Patch('friend-requests/:id/reject')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Відхилити запит на дружбу' })
    @ApiResponse({ status: 200, description: 'Запит на дружбу відхилено.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async rejectFriendRequest(
        @Param('id') requestId: string,
        @AuthUser() user: any,
    ) {
        return this.usersService.rejectFriendRequest(requestId, user.id);
    }

    @Get('me/friends')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Отримати друзів поточного користувача' })
    @ApiResponse({ status: 200, description: 'Повертає список друзів.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async getFriends(@AuthUser() user: any) {
        return this.usersService.getFriends(user.id);
    }

    @Get('me/friends-list')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Отримати список друзів поточного користувача' })
    @ApiResponse({ status: 200, description: 'Повертає список друзів користувача.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async getFriendsList(@AuthUser() user: any) {
        return this.usersService.getFriendsList(user.id);
    }

    @Get('me/passengers')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Отримати список пасажирів, з якими користувач їздив як водій' })
    @ApiResponse({ status: 200, description: 'Повертає список пасажирів.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async getPassengers(@AuthUser() user: any) {
        return this.usersService.getPassengers(user.id);
    }

    @Get('me/drivers')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Отримати список водіїв, з якими користувач їздив як пасажир' })
    @ApiResponse({ status: 200, description: 'Повертає список водіїв.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    async getDrivers(@AuthUser() user: any) {
        return this.usersService.getDrivers(user.id);
    }

    @Delete('friends/:friendId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Видалити користувача з друзів' })
    @ApiResponse({ status: 200, description: 'Дружбу успішно розірвано.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
    @ApiResponse({ status: 404, description: 'Користувачі не є друзями.' })
    async removeFriend(
        @Param('friendId') friendId: string,
        @AuthUser() user: any,
    ) {
        return this.usersService.removeFriend(user.id, friendId);
    }

    @Get('search')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Пошук користувачів за ім’ям або email з пагінацією та фільтром за категорією' })
    @ApiResponse({ status: 200, description: 'Повертає список користувачів.' })
    @ApiResponse({ status: 401, description: 'Неавторизовано.' })
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
}