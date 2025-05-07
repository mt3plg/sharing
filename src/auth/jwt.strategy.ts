import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        private usersService: UsersService,
        private configService: ConfigService,
    ) {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('JWT_SECRET is not defined in environment variables');
        }
        console.log('Using JWT_SECRET:', secret); // Логування для діагностики
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    async validate(payload: any) {
        console.log('JWT payload:', payload); // Логування для діагностики
        const user = await this.usersService.findOne(payload.sub);
        if (!user) {
            console.log('User not found for ID:', payload.sub);
            throw new UnauthorizedException();
        }
        return user; // Це додається до req.user
    }
}