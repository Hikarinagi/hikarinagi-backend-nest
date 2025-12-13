import { Module, Global } from '@nestjs/common'
import { S3Client } from '@aws-sdk/client-s3'
import { HikariConfigService } from '../../common/config/services/config.service'
import { S3Service } from './services/s3.service'
import { BACKUP_STORAGE, S3_BACKUP_CLIENT } from './constants/s3.constants'

@Global()
@Module({
  providers: [
    {
      provide: S3_BACKUP_CLIENT,
      useFactory: (config: HikariConfigService) =>
        new S3Client({
          region: config.get('s3.backup.region'),
          endpoint: config.get('s3.backup.endpoint'),
          credentials: {
            accessKeyId: config.get('s3.backup.accessKeyId'),
            secretAccessKey: config.get('s3.backup.secretAccessKey'),
          },
        }),
      inject: [HikariConfigService],
    },
    {
      provide: BACKUP_STORAGE,
      useFactory: (client: S3Client, config: HikariConfigService) =>
        new S3Service(client, config.get('s3.backup.bucket')),
      inject: [S3_BACKUP_CLIENT, HikariConfigService],
    },
  ],
  exports: [BACKUP_STORAGE],
})
export class S3Module {}
