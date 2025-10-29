import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { SendEmailDto } from '../dto/send-email.dto'
import { EmailConfig } from '../interfaces/email.interface'
import { HikariConfigService } from '../../../common/config/configs'
import { isArray } from 'class-validator'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly emailConfig: EmailConfig

  constructor(private configService: HikariConfigService) {
    this.emailConfig = {
      provider: this.configService.get('email.emailProvider'),
      apiKey: this.configService.get('email.emailApiKey'),
      endPoint: this.configService.get('email.emailEndPoint'),
      senderAddress: this.configService.get('email.emailSenderAddress'),
      senderName: this.configService.get('email.emailSenderName'),
    }
  }

  async sendEmail(sendEmailDto: SendEmailDto): Promise<boolean> {
    const { subject, to, bodyHtml, from } = sendEmailDto

    if (this.emailConfig.provider === 'elastic') {
      const emailData = {
        apikey: this.emailConfig.apiKey,
        subject,
        from: from || this.emailConfig.senderAddress,
        fromName: this.emailConfig.senderName,
        senderName: this.emailConfig.senderName,
        to,
        bodyHtml,
        isTransactional: true,
      }

      try {
        await axios.post(this.emailConfig.endPoint, null, {
          params: emailData,
          family: 4,
        })

        this.logger.log(`Email sent successfully to ${to}`)
        return true
      } catch (error) {
        this.logger.error(`Failed to send email to ${to}:`, error.message)
        throw new Error('Failed to send email')
      }
    } else if (this.emailConfig.provider === 'postal') {
      const emailData = {
        subject,
        from: `"${this.emailConfig.senderName}" <${from || this.emailConfig.senderAddress}>`,
        to: isArray(to) ? to : [to],
        html_body: bodyHtml,
      }

      try {
        const res = await axios.post(this.emailConfig.endPoint, emailData, {
          headers: {
            'X-Server-API-Key': this.emailConfig.apiKey,
          },
          family: 4,
        })

        if (res.data.status !== 'success') {
          this.logger.error(`Failed to send email to ${to}:`, res.data.message)
          throw new Error(`Failed to send email to ${to}: ${res.data.data.message}`)
        }

        this.logger.log(`Email sent successfully to ${to}`)
        return true
      } catch (error) {
        this.logger.error(`Failed to send email to ${to}:`, error.message)
        throw new Error('Failed to send email')
      }
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    const emailData: SendEmailDto = {
      subject: 'Hikarinagi Verification Code',
      to: email,
      bodyHtml: this.generateVerificationCodeTemplate(code),
    }

    return this.sendEmail(emailData)
  }

  private generateVerificationCodeTemplate(code: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hikarinagi 验证码</h2>
        <p>您的验证码是:</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; color: #007bff;">${code}</span>
        </div>
        <p style="color: #666;">验证码10分钟内有效，请及时使用。</p>
        <p style="color: #999; font-size: 12px;">如果您没有请求此验证码，请忽略此邮件。</p>
      </div>
    `
  }
}
