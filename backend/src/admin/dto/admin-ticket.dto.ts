import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator'

export class CreateAdminTicketDto {
  @ApiProperty({ example: 'regular' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(40)
  slug!: string

  @ApiProperty({ example: 'Regular' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string

  @ApiProperty({ example: 'Full access to the festival experience.' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  detail!: string

  @ApiProperty({ example: 50000, description: 'Price in KES minor units.' })
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  priceMinor!: number

  @ApiPropertyOptional({ minimum: 1, nullable: true, description: 'Total ticket slots. Null means unlimited.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  capacity?: number | null

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean
}

export class UpdateAdminTicketDto {
  @ApiPropertyOptional({ example: 'regular' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(40)
  slug?: string

  @ApiPropertyOptional({ example: 'Regular' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string

  @ApiPropertyOptional({ example: 'Full access to the festival experience.' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  detail?: string

  @ApiPropertyOptional({ example: 50000, description: 'Price in KES minor units.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  priceMinor?: number

  @ApiPropertyOptional({ minimum: 1, nullable: true, description: 'Total ticket slots. Null means unlimited.' })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  capacity?: number | null

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean
}
