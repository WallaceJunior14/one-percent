import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ContentApi } from '@/features/content/contentApi';
import type { Card } from '@/features/content/contract';
import { resolveContent } from '@/features/content/resolveContent';
import type { PreferencesRepository } from '@/features/onboarding/preferences';
import type { Clock } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
import { type Theme, useTheme } from '@/shared/ui/theme';
import { composeFeed } from './composeFeed';
import { FeedScreen } from './FeedScreen';

export type DailyFeedDependencies = {
  api: ContentApi;
  cache: KeyValueStore;
  clock: Clock;
  preferences: PreferencesRepository;
};

type Props = {
  deps: DailyFeedDependencies;
  onNeedOnboarding(): void;
  onFinished(): void;
  onEditAreas(): void;
};

type ViewState =
  | { kind: 'loading' }
  | { kind: 'redirect' }
  | { kind: 'empty' }
  | { kind: 'ready'; cards: Card[]; areaNames: Record<string, string>; stale: boolean };

/** Decide o que mostrar a partir das preferências e do conteúdo disponível. */
async function loadView(deps: DailyFeedDependencies): Promise<ViewState> {
  const preferences = await deps.preferences.load();
  if (preferences === null) return { kind: 'redirect' };

  const content = await resolveContent(deps);
  if (content.status === 'empty') return { kind: 'empty' };

  return {
    kind: 'ready',
    cards: composeFeed(content.content, preferences),
    areaNames: Object.fromEntries(content.content.areas.map((area) => [area.id, area.name])),
    stale: content.status === 'stale',
  };
}

/** Junta preferências + conteúdo + composição e escolhe o que mostrar (H1, H3, RNF-006). */
export function DailyFeed({ deps, onNeedOnboarding, onFinished, onEditAreas }: Props) {
  const styles = makeStyles(useTheme());
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

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

  const retry = () => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  switch (state.kind) {
    case 'loading':
      return (
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel="Carregando o conteúdo do dia" />
        </View>
      );
    case 'redirect':
      return <View testID="daily-feed-redirect" style={styles.screen} />;
    case 'empty':
      return (
        <View style={styles.center}>
          <Text style={styles.title}>Não foi possível carregar o conteúdo</Text>
          <Text style={styles.text}>Verifique a internet e tente de novo.</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
            <Text style={styles.buttonLabel}>Tentar de novo</Text>
          </Pressable>
        </View>
      );
    case 'ready':
      return (
        <View style={styles.screen}>
          <FeedScreen
            cards={state.cards}
            areaNames={state.areaNames}
            stale={state.stale}
            onFinished={onFinished}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Editar áreas"
            onPress={onEditAreas}
            style={styles.editAreas}
          >
            <Text style={styles.editAreasLabel}>Áreas</Text>
          </Pressable>
        </View>
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
    editAreas: { position: 'absolute', top: spacing(4.5), left: spacing(2), padding: spacing(0.5) },
    editAreasLabel: { fontSize: 13, fontWeight: '700', color: colors.primary },
  });
}
