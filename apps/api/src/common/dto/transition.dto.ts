import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class TransitionDto {
  @ApiProperty({ example: 'submit' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  action: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;
}

export class IdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  id: string;
}
