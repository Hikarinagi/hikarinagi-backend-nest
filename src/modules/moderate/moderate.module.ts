import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { MODERATION_QUEUE } from './constants/moderation.constants'
import { HikariConfigService } from '../../common/config/configs'
import { MongooseModule } from '@nestjs/mongoose'
import { Comment, CommentSchema } from '../comment/schemas/comment.schema'
import { ModerationEvent, ModerationEventSchema } from './schemas/moderation-event.schema'
import { ModerationProcessor } from './queues/moderation.processor'

const ModerationQueueModule = BullModule.registerQueueAsync({
  name: MODERATION_QUEUE,
  inject: [HikariConfigService],
  useFactory: (config: HikariConfigService) => ({
    connection: {
      host: config.get('redis.host'),
      port: config.get('redis.port'),
      password: config.get('redis.password') || undefined,
      db: Number(config.get('redis.database') || 0),
    },
    defaultJobOptions: {
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600, count: 1000 },
    },
  }),
})

@Module({
  imports: [
    ModerationQueueModule,
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: ModerationEvent.name, schema: ModerationEventSchema },
    ]),
  ],
  providers: [ModerationProcessor],
  exports: [ModerationQueueModule],
})
export class ModerateModule {}
