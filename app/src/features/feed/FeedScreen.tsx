import { useCallback, useRef, useState } from 'react';
import { FlatList, type FlatListProps, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Card } from '@/features/content/contract';
import { type Theme, useTheme } from '@/shared/ui/theme';
import { CardDetailSheet } from './CardDetailSheet';
import { CardPreview } from './CardPreview';

type OnViewableItemsChanged = NonNullable<FlatListProps<Card>['onViewableItemsChanged']>;

type Props = {
  cards: Card[];
  areaNames: Record<string, string>;
  /** Conteúdo de um dia anterior (H1-4): mostra um aviso abaixo da barra superior. */
  stale?: boolean;
  /** Chamado uma vez, ao tocar em "Concluir o dia" no fim da lista (H1-3, H4-1). */
  onFinished(): void;
  onEditAreas(): void;
  onOpenSaved(): void;
  /** Ids dos cards salvos, para o painel mostrar "Salvo" (H6). */
  savedIds: ReadonlySet<string>;
  onToggleSave(card: Card): void;
  onOpenUrl?(url: string): void;
};

/** Quantos cards já apareceram na tela: só aumenta e nunca passa do total. */
export function updateSeenCount(previous: number, visibleIndexes: number[], total: number) {
  const furthest = visibleIndexes.length > 0 ? Math.max(...visibleIndexes) + 1 : 0;
  return Math.min(total, Math.max(previous, furthest));
}

/**
 * Feed finito em coluna única (H1-1): cards com a altura do conteúdo, rolagem livre,
 * painel de detalhe ao tocar (H1-2a) e encerramento com "Concluir o dia" no fim (H1-3).
 */
export function FeedScreen({
  cards,
  areaNames,
  stale,
  onFinished,
  onEditAreas,
  onOpenSaved,
  savedIds,
  onToggleSave,
  onOpenUrl,
}: Props) {
  const styles = makeStyles(useTheme());
  const [seen, setSeen] = useState(0);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const finished = useRef(false);

  // O FlatList exige que este callback não mude entre renderizações.
  const onViewableItemsChanged = useCallback<OnViewableItemsChanged>(
    ({ viewableItems }) => {
      const indexes = viewableItems.flatMap((item) =>
        typeof item.index === 'number' ? [item.index] : [],
      );
      setSeen((previous) => updateSeenCount(previous, indexes, cards.length));
    },
    [cards.length],
  );

  const finishOnce = () => {
    if (finished.current) return;
    finished.current = true;
    onFinished();
  };

  return (
    <View style={styles.screen}>
      <View testID="feed-header" style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Editar áreas"
          onPress={onEditAreas}
          hitSlop={8}
          style={styles.areasButton}
        >
          <Text style={styles.areasLabel}>Áreas</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver salvos"
          onPress={onOpenSaved}
          hitSlop={8}
          style={styles.areasButton}
        >
          <Text style={styles.areasLabel}>Salvos</Text>
        </Pressable>
        <View style={styles.spacer} />
        <Text style={styles.progress}>
          {seen} de {cards.length} vistos
        </Text>
      </View>
      {stale && (
        <Text style={styles.warning}>
          O conteúdo de hoje ainda não chegou. Você está vendo o mais recente disponível.
        </Text>
      )}
      <FlatList
        testID="feed-list"
        data={cards}
        keyExtractor={(card) => card.id}
        renderItem={({ item }) => (
          <CardPreview card={item} areaName={areaNames[item.areaId] ?? ''} onOpen={setOpenCard} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        ListFooterComponent={
          <View style={styles.end}>
            <Text style={styles.endTitle}>Você chegou ao fim de hoje</Text>
            <Text style={styles.endText}>
              Sem rolagem infinita: o conteúdo de amanhã chega cedo.
            </Text>
            <Pressable accessibilityRole="button" onPress={finishOnce} style={styles.endButton}>
              <Text style={styles.endButtonLabel}>Concluir o dia</Text>
            </Pressable>
          </View>
        }
      />
      <CardDetailSheet
        card={openCard}
        areaName={openCard ? (areaNames[openCard.areaId] ?? '') : ''}
        onClose={() => setOpenCard(null)}
        onOpenUrl={onOpenUrl}
        saved={openCard !== null && savedIds.has(openCard.id)}
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
      gap: spacing(1),
      paddingHorizontal: spacing(2),
      paddingTop: spacing(5),
      paddingBottom: spacing(1),
    },
    areasButton: {
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.75),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    areasLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    spacer: { flex: 1 },
    progress: { fontSize: 14, color: colors.textMuted },
    warning: {
      marginHorizontal: spacing(2),
      marginBottom: spacing(1),
      padding: spacing(1.5),
      borderRadius: 12,
      backgroundColor: colors.surface,
      color: colors.warning,
      fontSize: 14,
      textAlign: 'center',
    },
    list: { paddingHorizontal: spacing(2), paddingTop: spacing(1), paddingBottom: spacing(4) },
    separator: { height: spacing(1.5) },
    end: {
      alignItems: 'center',
      paddingVertical: spacing(6),
      paddingHorizontal: spacing(2),
      gap: 12,
    },
    endTitle: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
    endText: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
    endButton: {
      marginTop: spacing(1),
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(4),
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    endButtonLabel: { fontSize: 17, fontWeight: '700', color: colors.onPrimary },
  });
}
