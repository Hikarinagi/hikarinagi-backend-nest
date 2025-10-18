import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Rate, RateSchema } from './schemas/rate.schema'
import { RateInteraction, RateInteractionSchema } from './schemas/rate-interaction.schema'
import { RateService } from './services/rate.service'
import { RateController } from './controllers/rate.controller'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rate.name, schema: RateSchema },
      { name: RateInteraction.name, schema: RateInteractionSchema },
    ]),
  ],
  providers: [RateService],
  controllers: [RateController],
  exports: [RateService],
})
export class RateModule {}
