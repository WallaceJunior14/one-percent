import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Card } from '@/features/content/contract';
import { formatShortDate } from '@/shared/lib/dates';
import { type Theme, useTheme } from '@/shared/ui/theme';
import { Badge } from './cardParts';

export const TEASER_LINES = 4;

type Props = {
  card: Card;
  areaName: string;
  onOpen(card: Card): void;
};

/** Card compacto do feed (H1-2): o essencial para despertar curiosidade; o resto fica no painel. */
export function CardPreview({ card, areaName, onOpen }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const meta =
    card.type === 'paper'
      ? `${card.authors[0]}${card.authors.length > 1 || card.authorsTruncated ? ' et al.' : ''} · ${card.venue}`
      : `${card.sourceName} · ${formatShortDate(card.publishedAt)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ler mais: ${card.title}`}
      onPress={() => onOpen(card)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.badges}>
        {card.type === 'paper' && <Badge label="Artigo científico" color={theme.colors.paper} />}
        <Badge label={areaName} />
        {card.type === 'paper' && card.isPreprint && (
          <Badge label="Preprint — não revisado por pares" color={theme.colors.warning} />
        )}
      </View>
      <Text style={styles.title} numberOfLines={4}>
        {card.title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {meta}
      </Text>
      <Text style={styles.teaser} numberOfLines={TEASER_LINES}>
        {card.summary}
      </Text>
      <Text style={styles.more}>Toque para ler mais</Text>
    </Pressable>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    card: {
      gap: spacing(1.5),
      padding: spacing(3),
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pressed: { opacity: 0.85 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
    title: { fontSize: 21, fontWeight: '700', color: colors.text, lineHeight: 27 },
    meta: { fontSize: 14, color: colors.textMuted },
    teaser: { fontSize: 17, color: colors.text, lineHeight: 25 },
    more: { fontSize: 15, fontWeight: '700', color: colors.primary, marginTop: spacing(1) },
  });
}
