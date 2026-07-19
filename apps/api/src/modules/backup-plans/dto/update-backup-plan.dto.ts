import { PartialType } from "@nestjs/mapped-types";
import { CreateBackupPlanDto } from "./create-backup-plan.dto";

export class UpdateBackupPlanDto extends PartialType(CreateBackupPlanDto) {}
