import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UserController } from './controllers/user.controller'
import { UserService } from './services/user.service'
import { User, UserSchema } from './schemas/user.schema'
import { UserSetting, UserSettingSchema } from './schemas/user-setting.schema'
import { UserSearchService } from './services/user-search.service'
import { UserSearchController } from './controllers/user-search.controller'
import { EmailModule } from '../email/email.module'
import { UserCheckInService } from './services/check-in/user-check-in.service'
import { CheckInRecord, CheckInRecordSchema } from './schemas/check-in/check-in-record.schema'
import { HikariPointsRecord, HikariPointsRecordSchema } from './schemas/hikari-point-record.schema'
import { HikariPointService } from './services/hikari-point.service'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserSetting.name, schema: UserSettingSchema },
      { name: CheckInRecord.name, schema: CheckInRecordSchema },
      { name: HikariPointsRecord.name, schema: HikariPointsRecordSchema },
    ]),
    EmailModule,
  ],
  controllers: [UserController, UserSearchController],
  providers: [UserService, UserSearchService, UserCheckInService, HikariPointService],
  exports: [UserService],
})
export class UserModule {}
