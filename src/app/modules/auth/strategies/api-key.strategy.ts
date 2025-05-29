import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-http-bearer";
import { AuthService } from "../services/auth.service";

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
    constructor(private authService: AuthService) {
        super()
    }

    async validate(apiKey: string) {
        const user = await this.authService.validateUserByApiKey(apiKey)
        if (!user) {
            throw new UnauthorizedException('Invalid API key');
        } else {
            return user
        }
    }
}