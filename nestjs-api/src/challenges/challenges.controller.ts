import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { PushQuestionsDto } from './dto/push-questions.dto';

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly service: ChallengesService) {}

  /**
   * Consome o próximo desafio disponível para o vídeo.
   * Segue o circuit-breaker: pool → vector → static.
   */
  @Get(':videoId')
  getChallenge(@Param('videoId') videoId: string) {
    return this.service.getChallenge(videoId);
  }

  /**
   * Endpoint para o python-worker enviar perguntas geradas pela IA.
   * Persiste no banco e empurra no pool Redis.
   */
  @Post(':videoId/questions')
  pushQuestions(
    @Param('videoId') videoId: string,
    @Body() dto: PushQuestionsDto,
  ) {
    return this.service.pushQuestionsToPool(videoId, dto.questions);
  }

  /** Observabilidade: tamanho atual do pool Redis para o vídeo. */
  @Get(':videoId/pool-size')
  poolSize(@Param('videoId') videoId: string) {
    return this.service.getPoolSize(videoId);
  }
}
