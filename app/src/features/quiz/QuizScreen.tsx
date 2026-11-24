import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Card } from '@/features/content/contract';
import { CardDetailSheet } from '@/features/feed/CardDetailSheet';
import { type Theme, useTheme } from '@/shared/ui/theme';
import { t } from '@/shared/i18n/pt-BR';

type Props = {
  questions: Card[];
  areaNames: Record<string, string>;
  /** Chamado uma vez, com o número de acertos, ao ver o resultado. */
  onComplete(score: number): void;
  onExit(): void;
};

/** Quiz do dia: uma pergunta por vez, resposta revelada na hora e atalho para o card. */
export function QuizScreen({ questions, areaNames, onComplete, onExit }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [openCard, setOpenCard] = useState<Card | null>(null);

  if (finished) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text accessibilityRole="header" style={styles.title}>
          {t.quiz.result(score, questions.length)}
        </Text>
        <Text style={styles.muted}>{t.quiz.resultNote}</Text>
        <Pressable accessibilityRole="button" onPress={onExit} style={styles.primary}>
          <Text style={styles.primaryLabel}>{t.common.back}</Text>
        </Pressable>
      </View>
    );
  }

  const card = questions[index];
  const { question, options, answerIndex } = card.quiz;
  const answered = chosen !== null;
  const isLast = index === questions.length - 1;

  const choose = (option: number) => {
    if (answered) return;
    setChosen(option);
    if (option === answerIndex) setScore((value) => value + 1);
  };

  const next = () => {
    if (isLast) {
      setFinished(true);
      onComplete(score);
      return;
    }
    setIndex(index + 1);
    setChosen(null);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.muted}>{t.quiz.progress(index + 1, questions.length)}</Text>
        <Text style={styles.question}>{question}</Text>

        {options.map((text, i) => {
          const isCorrect = answered && i === answerIndex;
          const isWrongChoice = answered && i === chosen && i !== answerIndex;
          return (
            <Pressable
              key={text}
              accessibilityRole="button"
              accessibilityLabel={t.quiz.option(text)}
              accessibilityState={{ disabled: answered, selected: i === chosen }}
              disabled={answered}
              onPress={() => choose(i)}
              style={[
                styles.option,
                isCorrect && { borderColor: theme.colors.primary, borderWidth: 2 },
                isWrongChoice && { borderColor: theme.colors.warning, borderWidth: 2 },
              ]}
            >
              <Text style={styles.optionText}>{text}</Text>
            </Pressable>
          );
        })}

        {answered && (
          <View style={styles.feedback}>
            {chosen === answerIndex ? (
              <Text style={[styles.feedbackTitle, { color: theme.colors.primary }]}>
                {t.quiz.correct}
              </Text>
            ) : (
              <>
                <Text style={[styles.feedbackTitle, { color: theme.colors.warning }]}>
                  {t.quiz.wrong}
                </Text>
                <Text style={styles.optionText}>{t.quiz.rightAnswer(options[answerIndex])}</Text>
              </>
            )}
            <Pressable accessibilityRole="button" onPress={() => setOpenCard(card)} hitSlop={8}>
              <Text style={styles.link}>{t.quiz.sourceCard}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={next} style={styles.primary}>
              <Text style={styles.primaryLabel}>
                {isLast ? t.quiz.seeResult : t.quiz.nextQuestion}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <CardDetailSheet
        card={openCard}
        areaName={openCard ? (areaNames[openCard.areaId] ?? '') : ''}
        onClose={() => setOpenCard(null)}
      />
    </View>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing(4),
      gap: spacing(2),
    },
    content: { padding: spacing(3), paddingTop: spacing(6), gap: spacing(1.5) },
    title: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center' },
    muted: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
    question: { fontSize: 22, fontWeight: '700', color: colors.text, marginVertical: spacing(1) },
    option: {
      padding: spacing(2),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionText: { fontSize: 16, color: colors.text },
    feedback: { gap: spacing(1.5), marginTop: spacing(1) },
    feedbackTitle: { fontSize: 18, fontWeight: '700' },
    link: { fontSize: 16, fontWeight: '700', color: colors.primary },
    primary: {
      marginTop: spacing(1),
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(4),
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    primaryLabel: { fontSize: 17, fontWeight: '700', color: colors.onPrimary },
  });
}
