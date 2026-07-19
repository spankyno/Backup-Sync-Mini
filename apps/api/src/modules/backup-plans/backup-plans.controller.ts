import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtAccessPayload } from "@backuphub/auth";
import { BackupPlansService } from "./backup-plans.service";
import { ExecutionsService } from "../executions/executions.service";
import { CreateBackupPlanDto } from "./dto/create-backup-plan.dto";
import { UpdateBackupPlanDto } from "./dto/update-backup-plan.dto";

@ApiTags("backup-plans")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("backup-plans")
export class BackupPlansController {
  constructor(
    private readonly backupPlansService: BackupPlansService,
    private readonly executionsService: ExecutionsService,
  ) {}

  @Get()
  findAll() {
    return this.backupPlansService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.backupPlansService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBackupPlanDto, @CurrentUser() user: JwtAccessPayload) {
    return this.backupPlansService.create(dto, user.sub);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBackupPlanDto) {
    return this.backupPlansService.update(id, dto);
  }

  @Post(":id/pause")
  pause(@Param("id") id: string) {
    return this.backupPlansService.setStatus(id, "paused");
  }

  @Post(":id/resume")
  resume(@Param("id") id: string) {
    return this.backupPlansService.setStatus(id, "active");
  }

  @Post(":id/run")
  run(@Param("id") id: string) {
    return this.executionsService.create(id);
  }

  @Get(":id/executions")
  executions(@Param("id") id: string) {
    return this.executionsService.findAllForPlan(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.backupPlansService.remove(id);
  }
}
