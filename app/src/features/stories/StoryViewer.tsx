import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Story } from '@/features/content/contract';
import { type Theme, useTheme } from '@/shared/ui/theme';

export const SLIDE_DURATION_MS = 5000;

type Props = {
  story: Story;
  areaName: string;
  /** Chamado uma vez, ao passar da última manchete: o story conta como visto (H5-3). */
  onFinished(): void;
  onClose(): void;
  onOpenCard(cardId: string): void;
};

/** Story em tela cheia (H5-2): manchetes que avançam por toque ou sozinhas. */
export function StoryViewer({ story, areaName, onFinished, onClose, onOpenCard }: Props) {
  const styles = makeStyles(useTheme());
  const [index, setIndex] = useState(0);
  const finished = useRef(false);
  const slide = story.slides[index];

  const next = () => {
    if (index < story.slides.length - 1) {
      setIndex(index + 1);
    } else if (!finished.current) {
      finished.current = true;
      onFinished();
    }
  };
  const previous = () => setIndex(Math.max(0, index - 1));

  useEffect(() => {
    const timer = setTimeout(next, SLIDE_DURATION_MS);
    return () => clearTimeout(timer);
  });

  return (
    <View style={styles.screen}>
      <View style={styles.segments}>
        {story.slides.map((s, i) => (
          <View key={s.cardId} style={[styles.segment, i <= index && styles.segmentDone]} />
        ))}
      </View>
      <View style={styles.top}>
        <Text style={styles.area}>{areaName}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar story"
          onPress={onClose}
          hitSlop={12}
        >
          <Text style={styles.close}>Fechar</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manchete anterior"
          onPress={previous}
          style={[styles.tapZone, styles.left]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Próxima manchete"
          onPress={next}
          style={[styles.tapZone, styles.right]}
        />
        <Text style={styles.headline} pointerEvents="none">
          {slide.headline}
        </Text>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.counter}>
          {index + 1} de {story.slides.length}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenCard(slide.cardId)}
          style={styles.cardButton}
        >
          <Text style={styles.cardButtonLabel}>Ler o card</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, paddingTop: spacing(5) },
    segments: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing(2) },
    segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
    segmentDone: { backgroundColor: colors.primary },
    top: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing(2),
    },
    area: { fontSize: 16, fontWeight: '700', color: colors.text },
    close: { fontSize: 16, fontWeight: '700', color: colors.primary },
    body: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing(3) },
    tapZone: { position: 'absolute', top: 0, bottom: 0 },
    left: { left: 0, width: '30%' },
    right: { right: 0, width: '70%' },
    headline: { fontSize: 30, fontWeight: '700', color: colors.text, lineHeight: 38 },
    bottom: { alignItems: 'center', gap: spacing(1.5), padding: spacing(3) },
    counter: { fontSize: 14, color: colors.textMuted },
    cardButton: {
      paddingVertical: spacing(1.5),
      paddingHorizontal: spacing(4),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    cardButtonLabel: { fontSize: 16, fontWeight: '700', color: colors.primary },
  });
}
