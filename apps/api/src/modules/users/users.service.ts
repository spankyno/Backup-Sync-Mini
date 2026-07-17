import { Injectable, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { UserRole } from "@prisma/client";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(params: { email: string; name: string; passwordHash: string; role?: UserRole }) {
    const existing = await this.findByEmail(params.email);
    if (existing) {
      throw new ConflictException("Ya existe un usuario con ese email");
    }

    return this.prisma.user.create({
      data: {
        email: params.email,
        name: params.name,
        passwordHash: params.passwordHash,
        role: params.role ?? "MEMBER",
      },
    });
  }

  /** Devuelve el usuario sin el hash de contraseña, para respuestas de API. */
  toPublicUser(user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
