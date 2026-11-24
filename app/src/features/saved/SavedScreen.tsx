import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import type { Card } from '@/features/content/contract';
import { CardDetailSheet } from '@/features/feed/CardDetailSheet';
import { CardPreview } from '@/features/feed/CardPreview';
import { Pill } from '@/shared/ui/Pill';
import { type Theme, useTheme } from '@/shared/ui/theme';
import type { SavedCard } from './savedCards';
import { t } from '@/shared/i18n/pt-BR';

type Props = {
  /** Já na ordem de exibição (mais recente primeiro). */
  items: SavedCard[];
  areaNames: Record<string, string>;
  onToggleSave(card: Card): void;
  onBack(): void;
};

/** Biblioteca pessoal: cards salvos, com filtro por área e o mesmo painel de detalhe. */
export function SavedScreen({ items, areaNames, onToggleSave, onBack }: Props) {
  const styles = makeStyles(useTheme());
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<Card | null>(null);

  const areasWithItems = [...new Set(items.map((saved) => saved.card.areaId))];
  const visible = items.filter((saved) => areaFilter === null || saved.card.areaId === areaFilter);
  const filters: { id: string | null; label: string }[] = [
    { id: null, label: t.saved.all },
    ...areasWithItems.map((id) => ({ id, label: areaNames[id] ?? id })),
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pill label={t.common.back} onPress={onBack} />
        <Text accessibilityRole="header" style={styles.title}>
          {t.saved.title}
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t.saved.emptyTitle}</Text>
          <Text style={styles.emptyText}>{t.saved.emptyText}</Text>
        </View>
      ) : (
        <>
          <View style={styles.filters}>
            {filters.map((filter) => (
              <Pill
                key={filter.id ?? 'all'}
                label={filter.label}
                accessibilityLabel={t.saved.filter(filter.label)}
                selected={filter.id === areaFilter}
                onPress={() => setAreaFilter(filter.id)}
              />
            ))}
          </View>
          <FlatList
            data={visible}
            keyExtractor={(saved) => saved.card.id}
            renderItem={({ item }) => (
              <CardPreview
                card={item.card}
                areaName={areaNames[item.card.areaId] ?? ''}
                onOpen={setOpenCard}
              />
            )}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </>
      )}

      <CardDetailSheet
        card={openCard}
        areaName={openCard ? (areaNames[openCard.areaId] ?? '') : ''}
        onClose={() => setOpenCard(null)}
        saved={openCard !== null && items.some((saved) => saved.card.id === openCard.id)}
        onToggleSave={onToggleSave}
      />
    </View>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing(2),
      paddingHorizontal: spacing(2),
      paddingTop: spacing(5),
      paddingBottom: spacing(1),
    },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    filters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing(1),
      paddingHorizontal: spacing(2),
      paddingBottom: spacing(1),
    },
    list: { paddingHorizontal: spacing(2), paddingTop: spacing(1), paddingBottom: spacing(4) },
    separator: { height: spacing(1.5) },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(4), gap: 8 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    emptyText: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  });
}
