import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import type { JwtAccessPayload } from "@backuphub/auth";

const REFRESH_TOKEN_NAME = "refresh-token";
const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Lee una variable de entorno obligatoria; falla rápido si falta. */
  private requireSecret(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`Falta la variable de entorno obligatoria ${key}`);
    }
    return value;
  }

  async register(params: { email: string; password: string; name: string }) {
    const passwordHash = await bcrypt.hash(params.password, BCRYPT_SALT_ROUNDS);
    const user = await this.users.create({
      email: params.email,
      name: params.name,
      passwordHash,
    });

    return this.issueSession(user);
  }

  async login(params: { email: string; password: string }) {
    const user = await this.users.findByEmail(params.email);
    if (!user) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const passwordMatches = await bcrypt.compare(params.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    return this.issueSession(user);
  }

  async refresh(rawRefreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(rawRefreshToken, {
        secret: this.requireSecret("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException("Usuario no encontrado");
    }

    // El refresh token se guarda hasheado (igual que una contraseña) para
    // que una fuga de la base de datos no permita reutilizar tokens.
    const storedTokens = await this.prisma.token.findMany({
      where: { userId: user.id, name: REFRESH_TOKEN_NAME },
    });

    let matchedTokenId: string | null = null;
    for (const stored of storedTokens) {
      if (await bcrypt.compare(rawRefreshToken, stored.hashedKey)) {
        matchedTokenId = stored.id;
        break;
      }
    }

    if (!matchedTokenId) {
      throw new UnauthorizedException("Refresh token revocado");
    }

    // Rotación: se invalida el token usado y se emite uno nuevo.
    await this.prisma.token.delete({ where: { id: matchedTokenId } });

    return this.issueSession(user);
  }

  async logout(userId: string, rawRefreshToken?: string) {
    if (!rawRefreshToken) {
      // Sin token concreto: revoca todas las sesiones del usuario.
      await this.prisma.token.deleteMany({
        where: { userId, name: REFRESH_TOKEN_NAME },
      });
      return { success: true };
    }

    const storedTokens = await this.prisma.token.findMany({
      where: { userId, name: REFRESH_TOKEN_NAME },
    });
    for (const stored of storedTokens) {
      if (await bcrypt.compare(rawRefreshToken, stored.hashedKey)) {
        await this.prisma.token.delete({ where: { id: stored.id } });
        break;
      }
    }

    return { success: true };
  }

  private async issueSession(user: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "MEMBER" | "VIEWER";
    createdAt: Date;
  }) {
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.requireSecret("JWT_SECRET"),
      expiresIn: this.config.get<string>("JWT_EXPIRES_IN") ?? "15m",
    });

    const refreshToken = this.jwt.sign(
      { sub: user.id },
      {
        secret: this.requireSecret("JWT_REFRESH_SECRET"),
        expiresIn: this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d",
      },
    );

    const hashedRefreshToken = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await this.prisma.token.create({
      data: {
        userId: user.id,
        name: REFRESH_TOKEN_NAME,
        hashedKey: hashedRefreshToken,
        expiresAt: this.addDuration(
          new Date(),
          this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d",
        ),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: this.users.toPublicUser(user),
    };
  }

  /** Suma una duración estilo JWT ("15m", "7d", "1h") a una fecha base. */
  private addDuration(base: Date, duration: string): Date {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);

    const value = Number(match[1]);
    const unit = match[2] as "s" | "m" | "h" | "d";
    const unitMs: Record<"s" | "m" | "h" | "d", number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return new Date(base.getTime() + value * unitMs[unit]);
  }
}
