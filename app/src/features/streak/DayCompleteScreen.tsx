import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Theme, useTheme } from '@/shared/ui/theme';
import type { Streak } from './calculateStreak';
import type { DaySummary } from './progress';

type Props = {
  summary: DaySummary;
  streak: Streak;
  areaNames: Record<string, string>;
  onReview(): void;
};

const days = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/** Recompensa do fim do dia (H4-1): o que foi lido e a sequência de dias. */
export function DayCompleteScreen({ summary, streak, areaNames, onReview }: Props) {
  const styles = makeStyles(useTheme());
  const areas = summary.areaIds.map((id) => areaNames[id] ?? id).join(' · ');

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Dia concluído
      </Text>
      <Text style={styles.subtitle}>Você ficou 1% mais sábio hoje.</Text>

      <View style={styles.streak}>
        <Text style={styles.streakValue}>
          {streak.current} {streak.current === 1 ? 'dia seguido' : 'dias seguidos'}
        </Text>
        <Text style={styles.muted}>Maior sequência: {days(streak.best)}</Text>
      </View>

      <View style={styles.stats}>
        <Stat value={summary.cardsRead} label="cards lidos" styles={styles} />
        <Stat value={summary.papersRead} label="artigos científicos" styles={styles} />
      </View>
      {areas.length > 0 && <Text style={styles.muted}>{areas}</Text>}

      <Pressable accessibilityRole="button" onPress={onReview} style={styles.button}>
        <Text style={styles.buttonLabel}>Rever os cards</Text>
      </Pressable>
    </View>
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
    streak: {
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(4),
      borderRadius: 20,
      backgroundColor: colors.surface,
    },
    streakValue: { fontSize: 26, fontWeight: '700', color: colors.primary },
    stats: { flexDirection: 'row', gap: spacing(4) },
    stat: { alignItems: 'center' },
    statValue: { fontSize: 32, fontWeight: '700', color: colors.text },
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
  });
}
