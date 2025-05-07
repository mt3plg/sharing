import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { SignUpDto, SignInDto } from './interfaces/interfaces_auth.interface';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly emailService: EmailService,
    ) {}

    // Зберігаємо коди верифікації для зміни пароля
    private passwordChangeCodes: Map<string, { code: string; expiresAt: number }> = new Map();

    async signup(signUpDto: SignUpDto) {
        const { name, email, phone, password } = signUpDto;

        const existingUser = await this.prisma.user.findFirst({
            where: { OR: [{ email }, { phone }] },
        });

        if (existingUser) {
            console.log(`User with email ${email} or phone ${phone} already exists`);
            throw new BadRequestException('Email or phone already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = Math.floor(1000 + Math.random() * 9000).toString();

        const user = await this.prisma.user.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword,
                status: 'pending',
                verificationToken,
            },
        });

        console.log(`Generated verification code for ${email}: ${verificationToken}`);

        try {
            await this.emailService.sendVerificationEmail(email, verificationToken);
        } catch (error: any) {
            console.error(`Failed to send verification code to ${email}:`, error.message || error);
            throw new BadRequestException('Failed to send verification code');
        }

        return { userId: user.id, verificationToken };
    }

    async verifyEmail(email: string, token: string) {
        if (!email || !token) {
            console.log('Missing email or token in verifyEmail request');
            throw new BadRequestException('Email and token are required');
        }

        const user = await this.prisma.user.findUnique({ where: { email } });

        if (!user) {
            console.log(`User with email ${email} not found`);
            throw new BadRequestException('User not found');
        }

        if (user.verificationToken !== token) {
            console.log(`Invalid verification code for ${email}. Expected: ${user.verificationToken}, Got: ${token}`);
            throw new BadRequestException('Invalid verification code');
        }

        const updatedUser = await this.prisma.user.update({
            where: { email },
            data: { status: 'active', verificationToken: null },
        });

        const payload = { sub: updatedUser.id, email: updatedUser.email };
        const jwtToken = this.jwtService.sign(payload);

        console.log(`User ${email} verified successfully. JWT: ${jwtToken}`);
        return { token: jwtToken };
    }

    async signin(signInDto: SignInDto) {
        const { email, password } = signInDto;

        const user = await this.prisma.user.findUnique({ where: { email } });

        if (!user) {
            console.log(`User with email ${email} not found`);
            throw new BadRequestException('Invalid credentials');
        }

        if (user.status !== 'active') {
            console.log(`User ${email} is not verified`);
            throw new BadRequestException('User not verified');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log(`Invalid password for ${email}`);
            throw new BadRequestException('Invalid credentials');
        }

        const payload = { sub: user.id, email: user.email };
        const jwtToken = this.jwtService.sign(payload);

        console.log(`User ${email} signed in successfully. JWT: ${jwtToken}`);
        return { token: jwtToken, user };
    }

    async getMe(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            console.log(`User with ID ${userId} not found`);
            throw new BadRequestException('User not found');
        }

        console.log(`Fetched user data for ID ${userId}:`, user);
        return user;
    }

    async sendVerificationCode(email: string) {
        if (!email) {
            console.log('Missing email in sendVerificationCode request');
            throw new BadRequestException('Email is required');
        }

        const user = await this.prisma.user.findUnique({ where: { email } });

        if (!user) {
            console.log(`User with email ${email} not found`);
            throw new BadRequestException('User not found');
        }

        const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // Код дійсний 10 хвилин

        // Зберігаємо код для зміни пароля
        this.passwordChangeCodes.set(email, { code: verificationCode, expiresAt });

        try {
            await this.emailService.sendVerificationEmail(email, verificationCode);
            console.log(`Verification code ${verificationCode} sent to ${email}`);
            return { success: true, message: 'Verification code sent' };
        } catch (error: any) {
            console.error(`Failed to send verification code to ${email}:`, error.message || error);
            throw new BadRequestException('Failed to send verification code');
        }
    }

    async verifyPasswordChangeCode(email: string, code: string) {
        if (!email || !code) {
            console.log('Missing email or code in verifyPasswordChangeCode request');
            throw new BadRequestException('Email and code are required');
        }

        const storedData = this.passwordChangeCodes.get(email);
        if (!storedData) {
            console.log(`No verification code found for ${email}`);
            throw new BadRequestException('Verification code not found or expired');
        }

        const { code: storedCode, expiresAt } = storedData;
        if (Date.now() > expiresAt) {
            this.passwordChangeCodes.delete(email);
            console.log(`Verification code for ${email} has expired`);
            throw new BadRequestException('Verification code has expired');
        }

        if (storedCode !== code) {
            console.log(`Invalid verification code for ${email}. Expected: ${storedCode}, Got: ${code}`);
            throw new BadRequestException('Invalid verification code');
        }

        console.log(`Verification code for ${email} verified successfully`);
        return { success: true, message: 'Verification code verified' };
    }
}