import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ScoreEntry } from '@/features/quiz/quizRepository';
import { formatTime, type ReminderSettings } from '@/features/reminders/reminderScheduler';
import { type Theme, useTheme } from '@/shared/ui/theme';
import type { Streak } from './calculateStreak';
import type { Progress } from './progress';

type Props = {
  streak: Streak;
  totals: Progress['totals'];
  /** Média de acertos no quiz, de 0 a 100; `null` se nenhum quiz foi feito. */
  quizAveragePercent: number | null;
  areaNames: Record<string, string>;
  onBack(): void;
  reminder: ReminderSettings;
  onEditReminder(): void;
};

/** Acertos sobre perguntas respondidas em todo o histórico, em % arredondado (H9-1). */
export function quizAverage(history: readonly ScoreEntry[]): number | null {
  const questions = history.reduce((sum, entry) => sum + entry.total, 0);
  if (questions === 0) return null;
  const correct = history.reduce((sum, entry) => sum + entry.score, 0);
  return Math.round((correct / questions) * 100);
}

const days = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/** Progresso acumulado (H9): sequências, totais lidos, distribuição por área e quiz. */
export function ProfileScreen({
  streak,
  totals,
  quizAveragePercent,
  areaNames,
  onBack,
  reminder,
  onEditReminder,
}: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const reminderLabel = reminder.enabled ? formatTime(reminder) : 'desligado';
  const areas = Object.entries(totals.byArea)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8} style={styles.pill}>
          <Text style={styles.pillLabel}>Voltar</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          Meu progresso
        </Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.streakValue}>
          {streak.current} {streak.current === 1 ? 'dia seguido' : 'dias seguidos'}
        </Text>
        <Text style={styles.muted}>Maior sequência: {days(streak.best)}</Text>
      </View>

      <View style={styles.stats}>
        <Stat value={totals.cards} label="cards lidos" styles={styles} />
        <Stat value={totals.papers} label="artigos científicos" styles={styles} />
      </View>

      <Text style={styles.quiz}>
        Média no quiz:{' '}
        {quizAveragePercent === null
          ? 'nenhum quiz feito ainda'
          : `${quizAveragePercent}% de acertos`}
      </Text>

      <View style={styles.box}>
        <Text style={styles.sectionTitle}>Por área</Text>
        {areas.length === 0 ? (
          <Text style={styles.muted}>
            Conclua seu primeiro dia para ver a distribuição por área.
          </Text>
        ) : (
          areas.map(([areaId, count]) => {
            const name = areaNames[areaId] ?? areaId;
            const percent = Math.round((count / totals.cards) * 100);
            return (
              <View
                key={areaId}
                testID="area-row"
                accessible
                accessibilityLabel={`${name}: ${count} cards, ${percent}%`}
                style={styles.areaRow}
              >
                <View style={styles.areaText}>
                  <Text style={styles.areaName}>{name}</Text>
                  <Text style={styles.muted}>{count}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${percent}%` }]} />
                </View>
              </View>
            );
          })
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Lembrete diário: ${reminderLabel}`}
        onPress={onEditReminder}
        style={[styles.box, styles.reminder]}
      >
        <Text style={styles.sectionTitle}>Lembrete diário</Text>
        <Text style={styles.muted}>{reminderLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function Stat({ value, label, styles }: { value: number; label: string; styles: Styles }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2), paddingTop: spacing(5), gap: spacing(2) },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
    pill: {
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.75),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    title: { fontSize: 26, fontWeight: '700', color: colors.text },
    box: {
      gap: spacing(1),
      padding: spacing(2),
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    streakValue: { fontSize: 24, fontWeight: '700', color: colors.primary },
    stats: { flexDirection: 'row', justifyContent: 'space-around' },
    stat: { alignItems: 'center' },
    statValue: { fontSize: 32, fontWeight: '700', color: colors.text },
    muted: { fontSize: 15, color: colors.textMuted },
    quiz: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    reminder: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    areaRow: { gap: 4 },
    areaText: { flexDirection: 'row', justifyContent: 'space-between' },
    areaName: { fontSize: 15, color: colors.text },
    barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
    barFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  });
}
