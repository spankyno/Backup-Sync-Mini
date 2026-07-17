import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";

// Fase 2+: se completara con controllers adicionales (perfil, gestion
// de usuarios por un admin) siguiendo DDD ligero.
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
