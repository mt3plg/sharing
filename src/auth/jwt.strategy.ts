import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
    this.logger.log(`Using JWT_SECRET: ${secret}`); // Перенесено після super
  }

  async validate(payload: { sub: string; email: string }) {
    this.logger.log(`Validating JWT payload: ${JSON.stringify(payload)}`);
    if (!payload.sub) {
      this.logger.error('No sub in JWT payload');
      throw new UnauthorizedException('Invalid token payload');
    }
    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      this.logger.error(`User not found for ID: ${payload.sub}`);
      throw new UnauthorizedException('User not found');
    }
    return { id: user.id, email: user.email }; // Повертаємо { id, email }
  }
}