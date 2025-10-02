import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Rate, RateSchema } from './schemas/rate.schema'
import { RateService } from './services/rate.service'
import { RateController } from './controllers/rate.controller'

@Module({
  imports: [MongooseModule.forFeature([{ name: Rate.name, schema: RateSchema }])],
  providers: [RateService],
  controllers: [RateController],
  exports: [RateService],
})
export class RateModule {}
