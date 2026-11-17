import { IsEmail, IsIn, IsInt, IsString, Matches, Max, Min, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

const counties = ['Marsabit', 'Isiolo', 'Laikipia', 'Samburu', 'Turkana', 'Wajir', 'Garissa', 'Mandera'] as const

export class InitializePaymentDto {
  @ApiProperty({
    example: 'regular',
    description: 'Slug of an active ticket type from the public ticket catalog.',
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    maxLength: 40,
  })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(40)
  ticketType!: string

  @ApiProperty({ minimum: 1, maximum: 10, example: 2 })
  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number

  @ApiProperty({ minLength: 2, maxLength: 100, example: 'Amina Hassan' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @ApiProperty({ maxLength: 254, example: 'amina@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string

  @ApiProperty({ minLength: 7, maxLength: 30, example: '+254712345678' })
  @IsString()
  @MinLength(7)
  @MaxLength(30)
  phone!: string

  @ApiProperty({ enum: counties, example: 'Marsabit' })
  @IsIn(counties)
  county!: string
}
