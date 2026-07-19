import { Controller, Get, Header, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ExecutionsService, type ExecutionFilters } from "./executions.service";

@ApiTags("executions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("executions")
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get()
  findAll(@Query() filters: ExecutionFilters) {
    return this.executionsService.findAll(filters);
  }

  @Get("export")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="historial-backups.csv"')
  async export(@Query() filters: ExecutionFilters) {
    return this.executionsService.exportCsv(filters);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.executionsService.sync(id);
  }

  @Get(":id/logs")
  logs(@Param("id") id: string) {
    return this.executionsService.getLogs(id);
  }

  @Get(":id/files")
  files(@Param("id") id: string) {
    return this.executionsService.getFiles(id);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.executionsService.cancel(id);
  }
}
