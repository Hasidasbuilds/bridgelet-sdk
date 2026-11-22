import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { verifyWithRotation } from './jwt-rotation.util.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      // #1061: API tokens, like claim tokens, must survive a JWT_SECRET
      // rotation window. Without the fallback every caller holding a token
      // minted under the old secret is logged out at deploy time.
      const payload = await verifyWithRotation<{ type?: string }>(
        this.jwtService,
        token,
      );
      // #956: claim tokens must never authenticate general API requests.
      if (payload.type === 'claim' || payload.type !== 'api') {
        throw new UnauthorizedException();
      }
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
