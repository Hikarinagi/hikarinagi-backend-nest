import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { EmailService } from './email.service'
import { HikariConfigService } from '../../../common/config/configs'
import axios from 'axios'

// Mock axios
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('EmailService', () => {
  let service: EmailService

  const mockConfigService = {
    get: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: HikariConfigService,
          useValue: mockConfigService,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<EmailService>(EmailService)

    // Setup default config values
    mockConfigService.get.mockImplementation((key: string) => {
      const config = {
        'email.emailProvider': 'elastic',
        'email.emailApiKey': 'test-api-key',
        'email.emailEndPoint': 'https://api.elasticemail.com/v2/email/send',
        'email.emailSenderAddress': 'noreply@hikarinagi.com',
        'email.emailSenderName': 'Hikarinagi',
      }
      return config[key]
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const sendEmailDto = {
        subject: 'Test Subject',
        to: 'test@example.com',
        bodyHtml: '<p>Test content</p>',
      }

      mockedAxios.post.mockResolvedValueOnce({ data: 'success' })

      const result = await service.sendEmail(sendEmailDto)

      expect(result).toBe(true)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.elasticemail.com/v2/email/send',
        null,
        {
          family: 4,
          params: expect.objectContaining({
            apikey: 'test-api-key',
            subject: 'Test Subject',
            to: 'test@example.com',
            bodyHtml: '<p>Test content</p>',
            from: 'noreply@hikarinagi.com',
            fromName: 'Hikarinagi',
            senderName: 'Hikarinagi',
            isTransactional: true,
          }),
        },
      )
    })

    it('should throw error when email sending fails', async () => {
      const sendEmailDto = {
        subject: 'Test Subject',
        to: 'test@example.com',
        bodyHtml: '<p>Test content</p>',
      }

      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'))

      await expect(service.sendEmail(sendEmailDto)).rejects.toThrow('Failed to send email')
    })

    it('should use custom from address when provided', async () => {
      const sendEmailDto = {
        subject: 'Test Subject',
        to: 'test@example.com',
        bodyHtml: '<p>Test content</p>',
        from: 'custom@example.com',
      }

      mockedAxios.post.mockResolvedValueOnce({ data: 'success' })

      await service.sendEmail(sendEmailDto)

      expect(mockedAxios.post).toHaveBeenCalledWith(expect.any(String), null, {
        family: 4,
        params: expect.objectContaining({
          from: 'custom@example.com',
          fromName: 'Hikarinagi',
          senderName: 'Hikarinagi',
          isTransactional: true,
        }),
      })
    })
  })

  describe('sendVerificationCode', () => {
    it('should send verification code email', async () => {
      const email = 'test@example.com'
      const code = '123456'

      mockedAxios.post.mockResolvedValueOnce({ data: 'success' })

      const result = await service.sendVerificationCode(email, code)

      expect(result).toBe(true)
      expect(mockedAxios.post).toHaveBeenCalledWith(expect.any(String), null, {
        family: 4,
        params: expect.objectContaining({
          to: email,
          subject: 'Hikarinagi Verification Code',
          bodyHtml: expect.stringContaining(code),
          from: 'noreply@hikarinagi.com',
          fromName: 'Hikarinagi',
          senderName: 'Hikarinagi',
          isTransactional: true,
        }),
      })
    })

    it('should generate proper verification code template', async () => {
      const email = 'test@example.com'
      const code = '123456'

      mockedAxios.post.mockResolvedValueOnce({ data: 'success' })

      await service.sendVerificationCode(email, code)

      const calledParams = mockedAxios.post.mock.calls[0][2].params
      expect(calledParams.bodyHtml).toContain('Hikarinagi 验证码')
      expect(calledParams.bodyHtml).toContain('123456')
      expect(calledParams.bodyHtml).toContain('验证码10分钟内有效')
    })
  })
})
