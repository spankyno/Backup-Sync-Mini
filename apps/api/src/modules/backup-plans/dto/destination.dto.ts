import { IsEnum, IsString, MinLength } from "class-validator";
import { DestinationType } from "@prisma/client";

export class DestinationDto {
  @IsEnum(DestinationType)
  type!: DestinationType;

  @IsString()
  @MinLength(1)
  path!: string;
}
