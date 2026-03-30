import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Perguntas estáticas de fallback (PT-BR).
 * Servidas quando o pool Redis e a busca vetorial estão vazios.
 */
const STATIC_QUESTIONS = [
  {
    question: 'Qual das alternativas melhor descreve o tema central do vídeo?',
    options: ['Inovação tecnológica', 'História e cultura', 'Saúde e bem-estar', 'Finanças pessoais'],
    answer: 'Inovação tecnológica',
    category: 'general',
  },
  {
    question: 'O que você aprendeu de mais relevante neste conteúdo?',
    options: [
      'Uma nova perspectiva sobre o tema',
      'Dados e estatísticas atualizados',
      'Técnicas práticas aplicáveis',
      'Contexto histórico do assunto',
    ],
    answer: 'Técnicas práticas aplicáveis',
    category: 'general',
  },
  {
    question: 'Como o apresentador estruturou a argumentação principal?',
    options: [
      'Problema → Solução → Resultado',
      'Histórico → Presente → Futuro',
      'Teoria → Prática → Conclusão',
      'Dados → Análise → Recomendação',
    ],
    answer: 'Problema → Solução → Resultado',
    category: 'structure',
  },
  {
    question: 'Qual é a principal mensagem que o vídeo tenta transmitir?',
    options: [
      'A importância da educação continuada',
      'O impacto das novas tecnologias',
      'A necessidade de mudança de comportamento',
      'A relevância da colaboração',
    ],
    answer: 'A importância da educação continuada',
    category: 'comprehension',
  },
  {
    question: 'Que evidência o autor usa para sustentar seu argumento?',
    options: [
      'Estudos de caso e exemplos reais',
      'Pesquisas acadêmicas citadas',
      'Comparações históricas',
      'Testemunhos de especialistas',
    ],
    answer: 'Estudos de caso e exemplos reais',
    category: 'analysis',
  },
  {
    question: 'Qual conceito apresentado no vídeo você considerou mais desafiador?',
    options: [
      'A definição técnica do tema',
      'As implicações práticas',
      'A relação com outros conceitos',
      'O contexto em que se aplica',
    ],
    answer: 'As implicações práticas',
    category: 'reflection',
  },
  {
    question: 'De que forma o conteúdo do vídeo pode ser aplicado no dia a dia?',
    options: [
      'Melhorando hábitos de estudo',
      'Otimizando processos de trabalho',
      'Aprimorando relações interpessoais',
      'Desenvolvendo habilidades técnicas',
    ],
    answer: 'Otimizando processos de trabalho',
    category: 'application',
  },
  {
    question: 'Qual foi o momento mais impactante do vídeo?',
    options: [
      'A revelação de um dado surpreendente',
      'A demonstração prática do conceito',
      'A conclusão e chamada à ação',
      'A apresentação do problema central',
    ],
    answer: 'A demonstração prática do conceito',
    category: 'engagement',
  },
];

async function main() {
  console.log('Seeding static fallback questions...');
  await prisma.staticQuestion.deleteMany();
  const { count } = await prisma.staticQuestion.createMany({ data: STATIC_QUESTIONS });
  console.log(`✓ ${count} static questions created.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
