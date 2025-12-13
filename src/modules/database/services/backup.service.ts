import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { spawn } from 'child_process'
import { BACKUP_STORAGE } from '../../s3/constants/s3.constants'
import { S3Service } from '../../s3/services/s3.service'
import { Inject } from '@nestjs/common'
import { HikariConfigService } from '../../../common/config/services/config.service'
import { Readable } from 'stream'
import type { _Object } from '@aws-sdk/client-s3'

@Injectable()
export class BackupService {
  private readonly logger: Logger
  private readonly backupPrefix = 'hikarinagi-backup/database/'
  constructor(
    @Inject(BACKUP_STORAGE) private readonly backupStorage: S3Service,
    private readonly configService: HikariConfigService,
  ) {
    this.logger = new Logger(BackupService.name)
  }

  private get databaseUri() {
    return this.configService.get('database.backup.uri') || this.configService.get('database.uri')
  }
  private get enableBackup() {
    return Boolean(this.configService.get('database.backup.enable'))
  }
  private get backupRetentionLimit() {
    return this.configService.get('database.backup.retention') ?? 0
  }

  async dumpDatabase() {
    if (!this.enableBackup) return
    if (!this.databaseUri) {
      this.logger.error('Database URI is not set')
      throw new InternalServerErrorException('Database URI is not set')
    }

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      let stderr = ''

      const mongoDump = spawn('mongodump', ['--uri', this.databaseUri, '--archive', '--gzip'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      mongoDump.stdout.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      mongoDump.stderr.on('data', (data: Buffer) => {
        const msg = data.toString()
        stderr += msg
      })

      mongoDump.on('error', err => {
        this.logger.error(`Failed to start mongodump: ${err.message}`)
        reject(new InternalServerErrorException('Failed to start mongodump'))
      })

      mongoDump.on('close', code => {
        if (code === 0) {
          this.logger.log('mongodump finished successfully')
          resolve(Buffer.concat(chunks))
        } else {
          this.logger.error(`mongodump exited with code ${code}: ${stderr}`)
          reject(new InternalServerErrorException(`mongodump failed with code ${code}`))
        }
      })
    })
  }

  async backupToS3() {
    if (!this.enableBackup) {
      this.logger.log('Database backup is disabled')
      return
    }
    if (!this.backupStorage) {
      this.logger.error('Backup storage is not set')
      throw new InternalServerErrorException('Backup storage is not set')
    }

    const backupFile = await this.dumpDatabase()
    if (!backupFile) {
      this.logger.error('Failed to dump database')
      throw new InternalServerErrorException('Failed to dump database')
    }

    const key = `${this.backupPrefix}${this.formatTimestamp(new Date())}.gz`

    const uploadResult = await this.backupStorage.uploadFileStream(
      key,
      Readable.from(backupFile),
      'application/octet-stream',
    )

    await this.cleanupOldBackups(key)

    return uploadResult
  }

  private async cleanupOldBackups(latestKey: string) {
    const retention = this.backupRetentionLimit
    if (!retention || retention <= 0) return

    try {
      const backups = await this.listAllBackupObjects()
      if (backups.length <= retention) return

      const sorted = backups.sort((a, b) => {
        const aTime = a.LastModified?.getTime() ?? 0
        const bTime = b.LastModified?.getTime() ?? 0
        return bTime - aTime
      })

      const toDelete = sorted.slice(retention)
      for (const item of toDelete) {
        if (!item.Key || item.Key === latestKey) continue
        await this.backupStorage.deleteFile(item.Key)
        this.logger.log(`Deleted old backup ${item.Key}`)
      }
    } catch (error) {
      this.logger.error('Failed to prune old backups', error as Error)
    }
  }

  private async listAllBackupObjects() {
    const objects: _Object[] = []
    let continuationToken: string | undefined

    do {
      const result = await this.backupStorage.getFileList({
        prefix: this.backupPrefix,
        continuationToken,
      })
      if (result.Contents?.length)
        objects.push(...result.Contents.filter(item => item.Key?.startsWith(this.backupPrefix)))
      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined
    } while (continuationToken)

    return objects
  }

  private formatTimestamp(date: Date) {
    const pad = (v: number) => v.toString().padStart(2, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hours = pad(date.getHours())
    const minutes = pad(date.getMinutes())
    const seconds = pad(date.getSeconds())
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
  }
}
