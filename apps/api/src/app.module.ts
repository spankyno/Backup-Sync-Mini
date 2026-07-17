import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AgentsModule } from "./modules/agents/agents.module";
import { BackupPlansModule } from "./modules/backup-plans/backup-plans.module";
import { ExecutionsModule } from "./modules/executions/executions.module";
import { HistoryModule } from "./modules/history/history.module";
import { RestoreModule } from "./modules/restore/restore.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { UsersModule } from "./modules/users/users.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL ?? 60) * 1000,
        limit: Number(process.env.RATE_LIMIT_MAX ?? 100),
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AgentsModule,
    BackupPlansModule,
    ExecutionsModule,
    HistoryModule,
    RestoreModule,
    InventoryModule,
    SettingsModule,
    DashboardModule,
  ],
})
export class AppModule {}
