import { useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Card } from '@/features/content/contract';
import { type Theme, useTheme } from '@/shared/ui/theme';
import { CardDetailSheet } from './CardDetailSheet';
import { CardPreview } from './CardPreview';

type Props = {
  cards: Card[];
  areaNames: Record<string, string>;
  /** Conteúdo de um dia anterior (H1-4): mostra um aviso abaixo da barra superior. */
  stale?: boolean;
  /** Chamado uma vez, quando a pessoa passa do último card (H1-3). */
  onFinished(): void;
  onEditAreas(): void;
  onOpenUrl?(url: string): void;
};

type Page = { kind: 'card'; card: Card } | { kind: 'end' };

/**
 * Feed vertical e finito: barra superior (áreas e progresso), um card compacto por página,
 * painel de detalhe ao tocar (H1-2a) e uma página de conclusão no fim.
 */
export function FeedScreen({ cards, areaNames, stale, onFinished, onEditAreas, onOpenUrl }: Props) {
  const styles = makeStyles(useTheme());
  const [pageHeight, setPageHeight] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const finished = useRef(false);

  const pages: Page[] = [
    ...cards.map((card) => ({ kind: 'card' as const, card })),
    { kind: 'end' },
  ];

  const finishOnce = () => {
    if (finished.current) return;
    finished.current = true;
    onFinished();
  };

  const onLayout = (event: LayoutChangeEvent) => setPageHeight(event.nativeEvent.layout.height);

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const height = layoutMeasurement.height || pageHeight;
    if (height <= 0) return;
    const index = Math.round(contentOffset.y / height);
    setPageIndex(index);
    if (index >= cards.length) finishOnce();
  };

  const renderPage = ({ item }: { item: Page }) => (
    <View style={[styles.page, { height: pageHeight }]}>
      {item.kind === 'end' ? (
        <View style={styles.end}>
          <Text style={styles.endTitle}>Você chegou ao fim de hoje</Text>
          <Text style={styles.endText}>Sem rolagem infinita: o conteúdo de amanhã chega cedo.</Text>
          <Pressable accessibilityRole="button" onPress={finishOnce} style={styles.endButton}>
            <Text style={styles.endButtonLabel}>Ver o resumo do dia</Text>
          </Pressable>
        </View>
      ) : (
        <CardPreview
          card={item.card}
          areaName={areaNames[item.card.areaId] ?? ''}
          onOpen={setOpenCard}
        />
      )}
    </View>
  );

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
        {pageIndex < cards.length && (
          <Text style={styles.progress} accessibilityLiveRegion="polite">
            {pageIndex + 1} de {cards.length}
          </Text>
        )}
      </View>
      {stale && (
        <Text style={styles.warning}>
          O conteúdo de hoje ainda não chegou. Você está vendo o mais recente disponível.
        </Text>
      )}
      <FlatList
        testID="feed-list"
        data={pages}
        keyExtractor={(page) => (page.kind === 'end' ? 'end' : page.card.id)}
        renderItem={renderPage}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onLayout={onLayout}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
      />
      <CardDetailSheet
        card={openCard}
        areaName={openCard ? (areaNames[openCard.areaId] ?? '') : ''}
        onClose={() => setOpenCard(null)}
        onOpenUrl={onOpenUrl}
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
      justifyContent: 'space-between',
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
    page: { paddingHorizontal: spacing(2), paddingVertical: spacing(1.5) },
    end: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(4), gap: 12 },
    endTitle: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center' },
    endText: { fontSize: 16, color: colors.textMuted, textAlign: 'center' },
    endButton: {
      marginTop: spacing(2),
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(4),
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    endButtonLabel: { fontSize: 17, fontWeight: '700', color: colors.onPrimary },
  });
}
