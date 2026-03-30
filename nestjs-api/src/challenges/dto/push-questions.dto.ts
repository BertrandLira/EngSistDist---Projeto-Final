export class QuestionItemDto {
  question: string;
  options: string[];
  answer: string;
  /** Embedding 1536-dim gerado pelo worker (OpenAI text-embedding-3-small). Opcional. */
  embedding?: number[];
}

export class PushQuestionsDto {
  questions: QuestionItemDto[];
}
