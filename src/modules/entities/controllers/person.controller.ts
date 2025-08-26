import { Controller, Get, Inject, Param, Req } from '@nestjs/common'
import { PersonService } from '../services/person.service'
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'

@Controller('person')
export class PersonController {
  constructor(
    private readonly personService: PersonService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get('/:id')
  async findById(@Param('id') id: number, @Req() req: RequestWithUser) {
    const cacheKey = `person-detail:${id}`
    const cachedData = await this.cacheManager.get(cacheKey)
    if (cachedData) {
      return {
        data: cachedData,
        cached: true,
      }
    }

    const person = await this.personService.findById(id, req)
    await this.cacheManager.set(cacheKey, person, 60 * 60 * 1000)

    return {
      data: person,
    }
  }
}
