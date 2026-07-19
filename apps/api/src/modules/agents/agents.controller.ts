import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AgentsService } from "./agents.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { UpdateAgentDto } from "./dto/update-agent.dto";

@ApiTags("agents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("agents")
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  findAll() {
    return this.agentsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.agentsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAgentDto) {
    return this.agentsService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAgentDto) {
    return this.agentsService.update(id, dto);
  }

  @Get(":id/filesystem")
  browseFilesystem(@Param("id") id: string, @Query("path") path?: string) {
    return this.agentsService.browseFilesystem(id, path);
  }

  @Post(":id/sync")
  sync(@Param("id") id: string) {
    return this.agentsService.sync(id);
  }

  @Post(":id/restart")
  restart(@Param("id") id: string) {
    return this.agentsService.restart(id);
  }

  @Post(":id/update")
  requestUpdate(@Param("id") id: string) {
    return this.agentsService.requestUpdate(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.agentsService.remove(id);
  }
}
