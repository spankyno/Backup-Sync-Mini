import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}
