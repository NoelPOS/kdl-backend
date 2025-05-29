import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { AuthService } from '../services/auth.service';

@Injectable()
export class BearerStrategy extends PassportStrategy(Strategy, 'bearer') {
    constructor(private authService: AuthService) {
        super();
    }

    async validate(token: string) {
        const user = await this.authService.validateUserByApiKey(token);

        if (!user) {
            throw new UnauthorizedException('Invalid API key');
        }

        return user;
    }
} 