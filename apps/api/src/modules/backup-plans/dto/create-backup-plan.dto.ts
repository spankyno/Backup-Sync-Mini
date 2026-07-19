import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { DestinationDto } from "./destination.dto";

export class CreateBackupPlanDto {
  // --- Datos generales ---
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // --- Paso 1: equipo + carpetas de origen ---
  @IsString()
  agentId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Selecciona al menos una carpeta de origen" })
  @IsString({ each: true })
  sourcePaths!: string[];

  // --- Paso 2: destino ---
  @ValidateNested()
  @Type(() => DestinationDto)
  destination!: DestinationDto;

  // --- Paso 3: configuración ---
  @IsOptional()
  @IsString()
  schedule?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  versioningMax?: number;

  @IsOptional()
  @IsBoolean()
  compression?: boolean;

  @IsOptional()
  @IsBoolean()
  encryption?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeFilters?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
