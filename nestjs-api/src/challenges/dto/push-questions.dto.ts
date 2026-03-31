export class QuestionItemDto {
  question: string;
  options: string[];
  answer: string;
  /** Embedding gerado pelo worker (OpenAI ou Gemini). Opcional. */
  embedding?: number[];
}

export class PushQuestionsDto {
  questions: QuestionItemDto[];
}
