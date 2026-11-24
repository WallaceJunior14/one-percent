const pluralRules = new Intl.PluralRules('pt-BR');

/**
 * Escolhe a forma pelo número. O zero fica no plural ("0 dias"): a regra do
 * idioma o trata como singular, mas assim a frase soa natural na tela.
 */
export function plural(n: number, forms: { one: string; other: string }): string {
  if (n === 0) return forms.other;
  return pluralRules.select(n) === 'one' ? forms.one : forms.other;
}

const days = (n: number) => `${n} ${plural(n, { one: 'dia', other: 'dias' })}`;

/** Textos da interface, agrupados por tela. Funções recebem os valores a inserir. */
export const t = {
  common: {
    back: 'Voltar',
    close: 'Fechar',
    save: 'Salvar',
    saved: 'Salvo',
    cardsRead: 'cards lidos',
    papersRead: 'artigos científicos',
    byline: (first: string, second: string) => `${first} · ${second}`,
    etAl: ' et al.',
  },
  card: {
    paperBadge: 'Artigo científico',
    preprintBadge: 'Preprint — não revisado por pares',
    readMoreHint: 'Toque para ler mais',
    readMore: (title: string) => `Ler mais: ${title}`,
    whyItMatters: 'Por que importa',
    method: 'Método',
    result: 'Resultado',
    limitations: 'Limitações',
    readPaper: 'Ler o artigo',
    openPdf: 'Abrir o PDF',
    readOriginal: 'Ler a matéria original',
    removeFromSaved: 'Remover dos salvos',
    saveCard: 'Salvar card',
  },
  feed: {
    seen: (seen: number, total: number) => `${seen} de ${total} vistos`,
    editAreas: 'Áreas',
    editAreasLabel: 'Editar áreas',
    saved: 'Salvos',
    savedLabel: 'Ver salvos',
    profile: 'Perfil',
    profileLabel: 'Ver meu progresso',
    stale: 'O conteúdo de hoje ainda não chegou. Você está vendo o mais recente disponível.',
    updateSuggestion:
      'Há conteúdo novo num formato que esta versão não lê. Atualize o app para recebê-lo.',
    endTitle: 'Você chegou ao fim de hoje',
    shortFeed: 'Hoje houve menos conteúdo nas áreas que você escolheu.',
    endNote: 'Sem rolagem infinita: o conteúdo de amanhã chega cedo.',
    finishDay: 'Concluir o dia',
    loading: 'Carregando o conteúdo do dia',
    loadFailed: 'Não foi possível carregar o conteúdo',
    checkConnection: 'Verifique a internet e tente de novo.',
    retry: 'Tentar de novo',
  },
  stories: {
    story: (name: string, seen: boolean) => `Story: ${name}${seen ? ' (visto)' : ''}`,
    closeLabel: 'Fechar story',
    previous: 'Manchete anterior',
    next: 'Próxima manchete',
    counter: (index: number, total: number) => `${index} de ${total}`,
    readCard: 'Ler o card',
  },
  saved: {
    title: 'Salvos',
    all: 'Todas',
    filter: (label: string) => `Filtrar: ${label}`,
    emptyTitle: 'Nenhum card salvo ainda',
    emptyText: 'Toque em “Salvar” no detalhe de um card para guardá-lo aqui, mesmo sem internet.',
  },
  onboarding: {
    title: 'O que você quer aprender?',
    subtitle:
      'Escolha as áreas do seu feed diário. Subáreas são opcionais: sem nenhuma, você recebe todas.',
    continue: 'Continuar',
  },
  dayComplete: {
    title: 'Dia concluído',
    subtitle: 'Você ficou 1% mais sábio hoje.',
    quizScore: (score: number, total: number) => `Quiz: ${score} de ${total} acertos`,
    startQuiz: (total: number) => `Fazer o quiz (${total} perguntas)`,
    review: 'Rever os cards',
  },
  streak: {
    days,
    current: (n: number) => `${n} ${plural(n, { one: 'dia seguido', other: 'dias seguidos' })}`,
    best: (n: number) => `Maior sequência: ${days(n)}`,
  },
  profile: {
    title: 'Meu progresso',
    quizAverage: (percent: number | null) =>
      `Média no quiz: ${percent === null ? 'nenhum quiz feito ainda' : `${percent}% de acertos`}`,
    byArea: 'Por área',
    noAreas: 'Conclua seu primeiro dia para ver a distribuição por área.',
    areaRow: (name: string, count: number, percent: number) =>
      `${name}: ${count} cards, ${percent}%`,
    reminder: 'Lembrete diário',
    reminderOff: 'desligado',
    reminderLabel: (value: string) => `Lembrete diário: ${value}`,
  },
  quiz: {
    result: (score: number, total: number) => `Você acertou ${score} de ${total}`,
    resultNote: 'Revisar o que leu é o que faz o conhecimento ficar.',
    progress: (index: number, total: number) => `Pergunta ${index} de ${total}`,
    option: (text: string) => `Alternativa: ${text}`,
    correct: 'Acertou!',
    wrong: 'Não foi dessa vez',
    rightAnswer: (text: string) => `Resposta certa: ${text}`,
    sourceCard: 'Ver o card de origem',
    seeResult: 'Ver resultado',
    nextQuestion: 'Próxima pergunta',
  },
  reminder: {
    appName: '1% ao Dia',
    body: (cards: number, minutes: number) =>
      `Seu dia está pronto: ${cards} cards, ~${minutes} min`,
    title: 'Quer um lembrete?',
    subtitle:
      'Um aviso por dia, no horário que você escolher, quando o conteúdo estiver pronto. Se você já tiver concluído o dia, o aviso não aparece.',
    toggle: 'Lembrete diário',
    unavailable:
      'Não foi possível ativar o lembrete neste aparelho. O restante do app funciona normalmente.',
    permissionDenied:
      'Sem permissão para notificações. Ative nas configurações do Android para usar o lembrete.',
  },
  links: {
    openFailedTitle: 'Não foi possível abrir o link',
    openFailedMessage: 'Verifique se há um navegador instalado e tente de novo.',
  },
};
