import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ContentApi } from '@/features/content/contentApi';
import type { Card, Story } from '@/features/content/contract';
import { resolveContent } from '@/features/content/resolveContent';
import type { PreferencesRepository } from '@/features/onboarding/preferences';
import type { ReminderService } from '@/features/reminders/reminderScheduler';
import type { QuizRepository } from '@/features/quiz/quizRepository';
import { selectQuiz } from '@/features/quiz/selectQuiz';
import type { SavedCardsRepository } from '@/features/saved/savedCards';
import type { SeenStoriesRepository } from '@/features/stories/seenStories';
import type { ProgressRepository } from '@/features/streak/progress';
import type { Clock } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
import { type Theme, useTheme } from '@/shared/ui/theme';
import { composeFeed } from './composeFeed';
import { resolveFeedSettings } from './feedSettings';
import { FeedScreen } from './FeedScreen';
import { t } from '@/shared/i18n/pt-BR';

export type DailyFeedDependencies = {
  api: ContentApi;
  cache: KeyValueStore;
  clock: Clock;
  preferences: PreferencesRepository;
  progress: ProgressRepository;
  saved: SavedCardsRepository;
  quiz: QuizRepository;
  seenStories: SeenStoriesRepository;
  reminders: Pick<ReminderService, 'refresh'>;
};

type Props = {
  deps: DailyFeedDependencies;
  onNeedOnboarding(): void;
  onFinished(): void;
  onEditAreas(): void;
  onOpenSaved(): void;
  onOpenProfile(): void;
};

type ViewState =
  | { kind: 'loading' }
  | { kind: 'redirect' }
  | { kind: 'empty'; updateSuggested: boolean }
  | {
      kind: 'ready';
      cards: Card[];
      areaNames: Record<string, string>;
      expectedSize: number;
      quizQuestions: number;
      stale: boolean;
      updateSuggested: boolean;
      savedIds: Set<string>;
      stories: Story[];
      seenStoryAreaIds: Set<string>;
      cardsById: Record<string, Card>;
    };

/** Decide o que mostrar a partir das preferências e do conteúdo disponível. */
async function loadView(deps: DailyFeedDependencies): Promise<ViewState> {
  const preferences = await deps.preferences.load();
  if (preferences === null) return { kind: 'redirect' };

  const content = await resolveContent(deps);
  const updateSuggested = content.updateSuggested === true;
  if (content.status === 'empty') return { kind: 'empty', updateSuggested };

  const published = new Set(content.content.areas.map((area) => area.id));
  const areaIds = preferences.areaIds.filter((id) => published.has(id));
  if (areaIds.length === 0) return { kind: 'redirect' };
  const settings = resolveFeedSettings(content.content.settings);

  return {
    kind: 'ready',
    cards: composeFeed(content.content, { ...preferences, areaIds }, settings),
    expectedSize: settings.feedSize,
    quizQuestions: settings.quizQuestions,
    areaNames: Object.fromEntries(content.content.areas.map((area) => [area.id, area.name])),
    stale: content.status === 'stale',
    updateSuggested,
    savedIds: await deps.saved.savedIds(),
    stories: content.content.stories.filter((story) => preferences.areaIds.includes(story.areaId)),
    seenStoryAreaIds: await deps.seenStories.seenToday(),
    cardsById: Object.fromEntries(content.content.cards.map((card) => [card.id, card])),
  };
}

/** Lembrete é acessório: uma falha nas notificações não pode travar o feed. */
async function refreshReminders(deps: DailyFeedDependencies) {
  try {
    await deps.reminders.refresh();
  } catch {
    // sem notificação hoje; a próxima abertura tenta de novo
  }
}

/** Junta preferências + conteúdo + composição e escolhe o que mostrar. */
export function DailyFeed({
  deps,
  onNeedOnboarding,
  onFinished,
  onEditAreas,
  onOpenSaved,
  onOpenProfile,
}: Props) {
  const styles = makeStyles(useTheme());
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    void refreshReminders(deps);
  }, [deps]);

  useEffect(() => {
    let cancelled = false;
    void loadView(deps).then((view) => {
      if (cancelled) return;
      setState(view);
      if (view.kind === 'redirect') onNeedOnboarding();
    });
    return () => {
      cancelled = true;
    };
  }, [deps, attempt, onNeedOnboarding]);

  /** Registra o progresso e prepara o quiz antes de ir para a tela de dia concluído. */
  const completeDay = async (cards: Card[], quizQuestions: number) => {
    await deps.progress.completeDay(cards);
    await deps.quiz.prepare(selectQuiz(cards, quizQuestions));
    await refreshReminders(deps); // tira o lembrete de hoje
    onFinished();
  };

  const toggleSave = async (card: Card) => {
    const nowSaved = await deps.saved.toggle(card);
    setState((current) => {
      if (current.kind !== 'ready') return current;
      const savedIds = new Set(current.savedIds);
      if (nowSaved) savedIds.add(card.id);
      else savedIds.delete(card.id);
      return { ...current, savedIds };
    });
  };

  const markStorySeen = async (areaId: string) => {
    await deps.seenStories.markSeen(areaId);
    setState((current) =>
      current.kind === 'ready'
        ? { ...current, seenStoryAreaIds: new Set([...current.seenStoryAreaIds, areaId]) }
        : current,
    );
  };

  const retry = () => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  switch (state.kind) {
    case 'loading':
      return (
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel={t.feed.loading} />
        </View>
      );
    case 'redirect':
      return <View testID="daily-feed-redirect" style={styles.screen} />;
    case 'empty':
      return (
        <View style={styles.center}>
          <Text style={styles.title}>{t.feed.loadFailed}</Text>
          <Text style={styles.text}>{t.feed.checkConnection}</Text>
          {state.updateSuggested && <Text style={styles.text}>{t.feed.updateSuggestion}</Text>}
          <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
            <Text style={styles.buttonLabel}>{t.feed.retry}</Text>
          </Pressable>
        </View>
      );
    case 'ready':
      return (
        <FeedScreen
          cards={state.cards}
          areaNames={state.areaNames}
          stale={state.stale}
          updateSuggested={state.updateSuggested}
          expectedSize={state.expectedSize}
          onFinished={() => void completeDay(state.cards, state.quizQuestions)}
          onEditAreas={onEditAreas}
          onOpenSaved={onOpenSaved}
          onOpenProfile={onOpenProfile}
          savedIds={state.savedIds}
          onToggleSave={(card) => void toggleSave(card)}
          stories={state.stories}
          seenStoryAreaIds={state.seenStoryAreaIds}
          onStorySeen={(areaId) => void markStorySeen(areaId)}
          cardsById={state.cardsById}
        />
      );
  }
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing(4),
      gap: 12,
      backgroundColor: colors.background,
    },
    title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
    text: { fontSize: 16, color: colors.textMuted, textAlign: 'center' },
    button: {
      marginTop: spacing(2),
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(4),
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    buttonLabel: { fontSize: 17, fontWeight: '700', color: colors.onPrimary },
  });
}
