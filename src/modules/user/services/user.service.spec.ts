import { Test, TestingModule } from '@nestjs/testing'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { getModelToken } from '@nestjs/mongoose'
import { JwtService } from '@nestjs/jwt'
import { UserService } from './user.service'
import { User } from '../schemas/user.schema'
import { UserSetting } from '../schemas/user-setting.schema'
import { HikariConfigService } from '../../../common/config/configs'
import { VerificationService } from '../../email/services/verification.service'
import { CounterService } from '../../shared/services/counter.service'
import { SystemMessage } from '../../message/schemas/system-message.schema'

describe('UserService', () => {
  let service: UserService

  const mockUserModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const mockUserSettingModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const mockSystemMessageModel = {
    countDocuments: jest.fn(),
  }

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  }

  const mockConfigService = {
    get: jest.fn(),
  }

  const mockVerificationService = {
    requestVerificationCode: jest.fn(),
    verifyCode: jest.fn(),
  }

  const mockCounterService = {
    getNextSequence: jest.fn(),
  }

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(UserSetting.name),
          useValue: mockUserSettingModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: HikariConfigService,
          useValue: mockConfigService,
        },
        {
          provide: VerificationService,
          useValue: mockVerificationService,
        },
        {
          provide: CounterService,
          useValue: mockCounterService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: getModelToken(SystemMessage.name),
          useValue: mockSystemMessageModel,
        },
      ],
    }).compile()

    service = module.get<UserService>(UserService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('findById', () => {
    it('should return a user if found', async () => {
      const mockUser = { _id: '123', name: 'test', email: 'test@test.com' }
      mockUserModel.findById.mockResolvedValue(mockUser)

      const result = await service.findById('123')
      expect(result).toEqual(mockUser)
      expect(mockUserModel.findById).toHaveBeenCalledWith('123')
    })

    it('should throw NotFoundException if user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null)

      await expect(service.findById('123')).rejects.toThrow('用户不存在')
    })
  })

  describe('findByUsername', () => {
    it('should return a user if found', async () => {
      const mockUser = {
        _id: '123',
        name: 'testuser',
        email: 'test@test.com',
        toJSON: jest.fn().mockReturnValue({ _id: '123', name: 'testuser', email: 'test@test.com' }),
      }
      mockUserModel.findOne.mockResolvedValue(mockUser)

      const result = await service.findByUsername('testuser')
      expect(result).toBeDefined()
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ name: 'testuser' })
    })

    it('should throw NotFoundException if user not found', async () => {
      mockUserModel.findOne.mockResolvedValue(null)

      await expect(service.findByUsername('testuser')).rejects.toThrow('用户不存在')
    })
  })

  describe('findByEmail', () => {
    it('should return a user if found', async () => {
      const mockUser = {
        _id: '123',
        name: 'testuser',
        email: 'test@test.com',
        toJSON: jest.fn().mockReturnValue({ _id: '123', name: 'testuser', email: 'test@test.com' }),
      }
      mockUserModel.findOne.mockResolvedValue(mockUser)

      const result = await service.findByEmail('test@test.com')
      expect(result).toBeDefined()
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'test@test.com' })
    })

    it('should throw NotFoundException if user not found', async () => {
      mockUserModel.findOne.mockResolvedValue(null)

      await expect(service.findByEmail('test@test.com')).rejects.toThrow('用户不存在')
    })
  })
})
