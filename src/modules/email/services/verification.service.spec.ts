import { Test, TestingModule } from '@nestjs/testing'
import { Logger, BadRequestException } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { VerificationService } from './verification.service'
import { EmailService } from './email.service'

describe('VerificationService', () => {
  let service: VerificationService

  const mockEmailService = {
    sendVerificationCode: jest.fn(),
  }

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }

  const mockLogger = {
    error: jest.fn(),
    log: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile()

    service = module.get<VerificationService>(VerificationService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('requestVerificationCode', () => {
    it('should request verification code for registration', async () => {
      const email = 'test@example.com'
      const type = 'register'

      mockEmailService.sendVerificationCode.mockResolvedValueOnce(true)
      mockCacheManager.set.mockResolvedValueOnce(undefined)

      const result = await service.requestVerificationCode(email, type)

      expect(result.success).toBe(true)
      expect(result.uuid).toBeDefined()
      expect(mockEmailService.sendVerificationCode).toHaveBeenCalledWith(email, expect.any(String))
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining(email),
        expect.any(String),
        600000, // 10 minutes in milliseconds
      )
    })

    it('should allow password reset without email match check', async () => {
      const email = 'test@example.com'
      const type = 'password-reset'
      const req = {
        user: { email: 'different@example.com' },
      }

      mockEmailService.sendVerificationCode.mockResolvedValueOnce(true)
      mockCacheManager.set.mockResolvedValueOnce(undefined)

      const result = await service.requestVerificationCode(email, type, req as any)

      expect(result.success).toBe(true)
      expect(result.uuid).toBeDefined()
    })

    it('should throw BadRequestException for unsupported type with email mismatch', async () => {
      const email = 'test@example.com'
      const type = 'unknown-type'
      const req = {
        user: { email: 'different@example.com' },
      }

      await expect(service.requestVerificationCode(email, type, req as any)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should handle email sending failure', async () => {
      const email = 'test@example.com'
      const type = 'register'

      mockEmailService.sendVerificationCode.mockRejectedValueOnce(new Error('Email failed'))
      mockCacheManager.set.mockResolvedValueOnce(undefined)

      await expect(service.requestVerificationCode(email, type)).rejects.toThrow(
        'Failed to request verification code',
      )
    })
  })

  describe('verifyCode', () => {
    it('should verify code successfully', async () => {
      const verificationDto = {
        uuid: 'test-uuid',
        code: '123456',
        email: 'test@example.com',
      }

      const cachedData = {
        email: 'test@example.com',
        code: '123456',
        type: 'register',
        createdAt: Date.now(),
      }

      mockCacheManager.get.mockResolvedValueOnce(JSON.stringify(cachedData))
      mockCacheManager.del.mockResolvedValueOnce(undefined)

      const result = await service.verifyCode(verificationDto)

      expect(result.verified).toBe(true)
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        `verificationCode:${verificationDto.uuid}-${verificationDto.email}`,
      )
    })

    it('should fail verification for non-existent code', async () => {
      const verificationDto = {
        uuid: 'test-uuid',
        code: '123456',
        email: 'test@example.com',
      }

      mockCacheManager.get.mockResolvedValueOnce(null)

      const result = await service.verifyCode(verificationDto)

      expect(result.verified).toBe(false)
      expect(result.message).toBe('验证码不存在或已过期')
    })

    it('should fail verification for wrong code', async () => {
      const verificationDto = {
        uuid: 'test-uuid',
        code: '123456',
        email: 'test@example.com',
      }

      const cachedData = {
        email: 'test@example.com',
        code: '654321', // Different code
        type: 'register',
        createdAt: Date.now(),
      }

      mockCacheManager.get.mockResolvedValueOnce(JSON.stringify(cachedData))

      const result = await service.verifyCode(verificationDto)

      expect(result.verified).toBe(false)
      expect(result.message).toBe('验证码错误')
    })

    it('should fail verification for email mismatch', async () => {
      const verificationDto = {
        uuid: 'test-uuid',
        code: '123456',
        email: 'test@example.com',
      }

      const cachedData = {
        email: 'different@example.com', // Different email
        code: '123456',
        type: 'register',
        createdAt: Date.now(),
      }

      mockCacheManager.get.mockResolvedValueOnce(JSON.stringify(cachedData))

      const result = await service.verifyCode(verificationDto)

      expect(result.verified).toBe(false)
      expect(result.message).toBe('验证码错误')
    })

    it('should handle cache errors', async () => {
      const verificationDto = {
        uuid: 'test-uuid',
        code: '123456',
        email: 'test@example.com',
      }

      mockCacheManager.get.mockRejectedValueOnce(new Error('Cache error'))

      await expect(service.verifyCode(verificationDto)).rejects.toThrow('Failed to verify code')
    })
  })
})
