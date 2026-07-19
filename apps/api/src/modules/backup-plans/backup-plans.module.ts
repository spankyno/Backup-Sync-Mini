import { Module } from "@nestjs/common";
import { BackupPlansController } from "./backup-plans.controller";
import { BackupPlansService } from "./backup-plans.service";
import { ExecutionsModule } from "../executions/executions.module";

@Module({
  imports: [ExecutionsModule],
  controllers: [BackupPlansController],
  providers: [BackupPlansService],
})
export class BackupPlansModule {}
