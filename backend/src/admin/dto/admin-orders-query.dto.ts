import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class AdminOrdersQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20

  @ApiPropertyOptional({ enum: ['PENDING', 'PAID', 'FAILED'] })
  @IsOptional()
  @IsIn(['PENDING', 'PAID', 'FAILED'])
  status?: 'PENDING' | 'PAID' | 'FAILED'

  @ApiPropertyOptional({ maxLength: 100, description: 'Matches buyer, email, phone, or reference.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string
}
