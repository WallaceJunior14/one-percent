import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Theme, useTheme } from '@/shared/ui/theme';
import type { Streak } from './calculateStreak';
import type { DaySummary } from './progress';
import { Stat, StreakSummary } from './StreakSummary';
import { t } from '@/shared/i18n/pt-BR';

type Props = {
  summary: DaySummary;
  streak: Streak;
  areaNames: Record<string, string>;
  onReview(): void;
  /** Quiz de hoje: `null` se não houver; `score` nulo enquanto não for respondido. */
  quiz?: { score: number | null; total: number } | null;
  onStartQuiz?(): void;
};

/** Recompensa do fim do dia: o que foi lido e a sequência de dias. */
export function DayCompleteScreen({
  summary,
  streak,
  areaNames,
  onReview,
  quiz = null,
  onStartQuiz,
}: Props) {
  const styles = makeStyles(useTheme());
  const areas = summary.areaIds.map((id) => areaNames[id] ?? id).join(' · ');

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {t.dayComplete.title}
      </Text>
      <Text style={styles.subtitle}>{t.dayComplete.subtitle}</Text>

      <StreakSummary streak={streak} />

      <View style={styles.stats}>
        <Stat value={summary.cardsRead} label={t.common.cardsRead} />
        <Stat value={summary.papersRead} label={t.common.papersRead} />
      </View>
      {areas.length > 0 && <Text style={styles.muted}>{areas}</Text>}

      {quiz && quiz.score !== null && (
        <Text style={styles.quizScore}>{t.dayComplete.quizScore(quiz.score, quiz.total)}</Text>
      )}
      {quiz && quiz.score === null && onStartQuiz && (
        <Pressable accessibilityRole="button" onPress={onStartQuiz} style={styles.quizButton}>
          <Text style={styles.quizButtonLabel}>{t.dayComplete.startQuiz(quiz.total)}</Text>
        </Pressable>
      )}

      <Pressable accessibilityRole="button" onPress={onReview} style={styles.button}>
        <Text style={styles.buttonLabel}>{t.dayComplete.review}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing(4),
      gap: spacing(2),
      backgroundColor: colors.background,
    },
    title: { fontSize: 30, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 17, color: colors.textMuted, textAlign: 'center' },
    stats: { flexDirection: 'row', gap: spacing(4) },
    muted: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
    button: {
      marginTop: spacing(2),
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(4),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    buttonLabel: { fontSize: 17, fontWeight: '700', color: colors.primary },
    quizScore: { fontSize: 17, fontWeight: '700', color: colors.text },
    quizButton: {
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(4),
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    quizButtonLabel: { fontSize: 17, fontWeight: '700', color: colors.onPrimary },
  });
}
