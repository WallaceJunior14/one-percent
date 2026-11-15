import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Card } from '@/features/content/contract';
import { CardDetailSheet } from '@/features/feed/CardDetailSheet';
import { CardPreview } from '@/features/feed/CardPreview';
import { type Theme, useTheme } from '@/shared/ui/theme';
import type { SavedCard } from './savedCards';

type Props = {
  /** Já na ordem de exibição (mais recente primeiro). */
  items: SavedCard[];
  areaNames: Record<string, string>;
  onToggleSave(card: Card): void;
  onBack(): void;
};

/** Biblioteca pessoal (H6-2): cards salvos, com filtro por área e o mesmo painel de detalhe. */
export function SavedScreen({ items, areaNames, onToggleSave, onBack }: Props) {
  const styles = makeStyles(useTheme());
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<Card | null>(null);

  const areasWithItems = [...new Set(items.map((saved) => saved.card.areaId))];
  const visible = items.filter((saved) => areaFilter === null || saved.card.areaId === areaFilter);
  const filters: { id: string | null; label: string }[] = [
    { id: null, label: 'Todas' },
    ...areasWithItems.map((id) => ({ id, label: areaNames[id] ?? id })),
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8} style={styles.pill}>
          <Text style={styles.pillLabel}>Voltar</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          Salvos
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nenhum card salvo ainda</Text>
          <Text style={styles.emptyText}>
            Toque em “Salvar” no detalhe de um card para guardá-lo aqui, mesmo sem internet.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.filters}>
            {filters.map((filter) => {
              const active = filter.id === areaFilter;
              return (
                <Pressable
                  key={filter.id ?? 'all'}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtrar: ${filter.label}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setAreaFilter(filter.id)}
                  style={[styles.pill, active && styles.pillActive]}
                >
                  <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
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
    pill: {
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.75),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    pillLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    pillLabelActive: { color: colors.onPrimary },
    list: { paddingHorizontal: spacing(2), paddingTop: spacing(1), paddingBottom: spacing(4) },
    separator: { height: spacing(1.5) },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(4), gap: 8 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    emptyText: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  });
}
