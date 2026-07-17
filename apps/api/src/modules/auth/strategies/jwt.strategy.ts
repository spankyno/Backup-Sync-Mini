import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { JwtAccessPayload } from "@backuphub/auth";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET") ?? "change-me-in-production",
    });
  }

  // El valor de retorno queda disponible como `request.user`.
  validate(payload: JwtAccessPayload): JwtAccessPayload {
    return payload;
  }
}
