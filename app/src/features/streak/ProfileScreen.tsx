import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatTime, type ReminderSettings } from '@/features/reminders/reminderScheduler';
import { Pill } from '@/shared/ui/Pill';
import { type Theme, useTheme } from '@/shared/ui/theme';
import type { Streak } from './calculateStreak';
import type { Progress } from './progress';
import { Stat, StreakSummary } from './StreakSummary';
import { t } from '@/shared/i18n/pt-BR';

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

/** Progresso acumulado: sequências, totais lidos, distribuição por área e quiz. */
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
  const reminderLabel = reminder.enabled ? formatTime(reminder) : t.profile.reminderOff;
  const areas = Object.entries(totals.byArea)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pill label={t.common.back} onPress={onBack} />
        <Text accessibilityRole="header" style={styles.title}>
          {t.profile.title}
        </Text>
      </View>

      <StreakSummary streak={streak} />

      <View style={styles.stats}>
        <Stat value={totals.cards} label={t.common.cardsRead} />
        <Stat value={totals.papers} label={t.common.papersRead} />
      </View>

      <Text style={styles.quiz}>{t.profile.quizAverage(quizAveragePercent)}</Text>

      <View style={styles.box}>
        <Text style={styles.sectionTitle}>{t.profile.byArea}</Text>
        {areas.length === 0 ? (
          <Text style={styles.muted}>{t.profile.noAreas}</Text>
        ) : (
          areas.map(([areaId, count]) => {
            const name = areaNames[areaId] ?? areaId;
            const percent = Math.round((count / totals.cards) * 100);
            return (
              <View
                key={areaId}
                testID="area-row"
                accessible
                accessibilityLabel={t.profile.areaRow(name, count, percent)}
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
        accessibilityLabel={t.profile.reminderLabel(reminderLabel)}
        onPress={onEditReminder}
        style={[styles.box, styles.reminder]}
      >
        <Text style={styles.sectionTitle}>{t.profile.reminder}</Text>
        <Text style={styles.muted}>{reminderLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2), paddingTop: spacing(5), gap: spacing(2) },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
    title: { fontSize: 26, fontWeight: '700', color: colors.text },
    box: {
      gap: spacing(1),
      padding: spacing(2),
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    stats: { flexDirection: 'row', justifyContent: 'space-around' },
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
