import { StyleSheet, Text, View } from 'react-native';

import { type Theme, useTheme } from '@/shared/ui/theme';
import type { Streak } from './calculateStreak';

export const formatDays = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

export function StreakSummary({ streak }: { streak: Streak }) {
  const styles = makeStyles(useTheme());
  return (
    <View style={styles.box}>
      <Text style={styles.value}>
        {streak.current} {streak.current === 1 ? 'dia seguido' : 'dias seguidos'}
      </Text>
      <Text style={styles.muted}>Maior sequência: {formatDays(streak.best)}</Text>
    </View>
  );
}

export function Stat({ value, label }: { value: number; label: string }) {
  const styles = makeStyles(useTheme());
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    box: {
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(4),
      borderRadius: 20,
      backgroundColor: colors.surface,
    },
    value: { fontSize: 26, fontWeight: '700', color: colors.primary },
    stat: { alignItems: 'center' },
    statValue: { fontSize: 32, fontWeight: '700', color: colors.text },
    muted: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  });
}
