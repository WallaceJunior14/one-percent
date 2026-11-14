import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type Theme, useTheme } from '@/shared/ui/theme';

/** Moldura comum dos cards: ocupa a página do feed e rola se o texto for longo. */
export function CardFrame({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <ScrollView style={styles.frame} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

export function Badge({ label, color }: { label: string; color?: string }) {
  const theme = useTheme();
  const tint = color ?? theme.colors.primary;
  return (
    <View style={[makeStyles(theme).badge, { borderColor: tint }]}>
      <Text style={{ color: tint, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Section({ label, text }: { label: string; text: string }) {
  const styles = makeStyles(useTheme());
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress(): void }) {
  const styles = makeStyles(useTheme());
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.link}
    >
      <Text style={styles.linkLabel}>{label} ↗</Text>
    </Pressable>
  );
}

export function useCardStyles() {
  return makeStyles(useTheme());
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    frame: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingTop: spacing(6), gap: spacing(1.5) },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), alignItems: 'center' },
    badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    title: { fontSize: 24, fontWeight: '700', color: colors.text, lineHeight: 30 },
    subtitle: { fontSize: 14, fontStyle: 'italic', color: colors.textMuted },
    body: { fontSize: 17, color: colors.text, lineHeight: 25 },
    meta: { fontSize: 14, color: colors.textMuted },
    section: { gap: 2 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    link: { paddingVertical: spacing(1.5) },
    linkLabel: { fontSize: 16, fontWeight: '700', color: colors.primary },
  });
}
