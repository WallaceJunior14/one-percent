import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  type FlatListProps,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Card, Story } from '@/features/content/contract';
import { StoriesBar } from '@/features/stories/StoriesBar';
import { StoryViewer } from '@/features/stories/StoryViewer';
import { Pill } from '@/shared/ui/Pill';
import { type Theme, useTheme } from '@/shared/ui/theme';
import { CardDetailSheet } from './CardDetailSheet';
import { CardPreview } from './CardPreview';
import { t } from '@/shared/i18n/pt-BR';

type OnViewableItemsChanged = NonNullable<FlatListProps<Card>['onViewableItemsChanged']>;

type Props = {
  cards: Card[];
  areaNames: Record<string, string>;
  /** Conteúdo de um dia anterior: mostra um aviso abaixo da barra superior. */
  stale?: boolean;
  /** Tamanho que o feed teria com conteúdo suficiente; menos cards mostram um aviso no fim. */
  expectedSize?: number;
  /** O conteúdo novo saiu num formato que só uma versão nova do app lê. */
  updateSuggested?: boolean;
  /** Chamado uma vez, ao tocar em "Concluir o dia" no fim da lista. */
  onFinished(): void;
  onEditAreas(): void;
  onOpenSaved(): void;
  onOpenProfile(): void;
  savedIds: ReadonlySet<string>;
  onToggleSave(card: Card): void;
  stories: Story[];
  seenStoryAreaIds: ReadonlySet<string>;
  onStorySeen(areaId: string): void;
  /** Todos os cards do dia, para abrir o card de uma manchete de story. */
  cardsById: Record<string, Card>;
  onOpenUrl?(url: string): void;
};

/** Quantos cards já apareceram na tela: só aumenta e nunca passa do total. */
export function updateSeenCount(previous: number, visibleIndexes: number[], total: number) {
  const furthest = visibleIndexes.length > 0 ? Math.max(...visibleIndexes) + 1 : 0;
  return Math.min(total, Math.max(previous, furthest));
}

/**
 * Feed finito em coluna única: cards com a altura do conteúdo, rolagem livre,
 * painel de detalhe ao tocar e encerramento com "Concluir o dia" no fim.
 */
export function FeedScreen({
  cards,
  areaNames,
  stale,
  updateSuggested,
  expectedSize,
  onFinished,
  onEditAreas,
  onOpenSaved,
  onOpenProfile,
  savedIds,
  onToggleSave,
  stories,
  seenStoryAreaIds,
  onStorySeen,
  cardsById,
  onOpenUrl,
}: Props) {
  const styles = makeStyles(useTheme());
  const [seen, setSeen] = useState(0);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [openStory, setOpenStory] = useState<Story | null>(null);
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

  const openStoryCard = (cardId: string) => {
    setOpenStory(null);
    setOpenCard(cardsById[cardId] ?? null);
  };

  const finishOnce = () => {
    if (finished.current) return;
    finished.current = true;
    onFinished();
  };

  return (
    <View style={styles.screen}>
      <View testID="feed-header" style={styles.header}>
        <Pill
          label={t.feed.editAreas}
          accessibilityLabel={t.feed.editAreasLabel}
          onPress={onEditAreas}
        />
        <Pill label={t.feed.saved} accessibilityLabel={t.feed.savedLabel} onPress={onOpenSaved} />
        <Pill
          label={t.feed.profile}
          accessibilityLabel={t.feed.profileLabel}
          onPress={onOpenProfile}
        />
        <View style={styles.spacer} />
        <Text style={styles.progress}>{t.feed.seen(seen, cards.length)}</Text>
      </View>
      {stale && <Text style={styles.warning}>{t.feed.stale}</Text>}
      {updateSuggested && <Text style={styles.warning}>{t.feed.updateSuggestion}</Text>}
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
        ListHeaderComponent={
          <StoriesBar
            stories={stories}
            areaNames={areaNames}
            seenAreaIds={seenStoryAreaIds}
            onOpen={(areaId) => setOpenStory(stories.find((s) => s.areaId === areaId) ?? null)}
          />
        }
        ListFooterComponent={
          <View style={styles.end}>
            <Text style={styles.endTitle}>{t.feed.endTitle}</Text>
            {expectedSize !== undefined && cards.length < expectedSize && (
              <Text style={styles.endText}>{t.feed.shortFeed}</Text>
            )}
            <Text style={styles.endText}>{t.feed.endNote}</Text>
            <Pressable accessibilityRole="button" onPress={finishOnce} style={styles.endButton}>
              <Text style={styles.endButtonLabel}>{t.feed.finishDay}</Text>
            </Pressable>
          </View>
        }
      />
      <Modal
        visible={openStory !== null}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpenStory(null)}
      >
        {openStory && (
          <StoryViewer
            story={openStory}
            areaName={areaNames[openStory.areaId] ?? ''}
            onFinished={() => {
              onStorySeen(openStory.areaId);
              setOpenStory(null);
            }}
            onClose={() => setOpenStory(null)}
            onOpenCard={openStoryCard}
          />
        )}
      </Modal>
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
      flexWrap: 'wrap', // com fonte grande, os botões descem de linha
      alignItems: 'center',
      gap: spacing(1),
      paddingHorizontal: spacing(2),
      paddingTop: spacing(5),
      paddingBottom: spacing(1),
    },
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
