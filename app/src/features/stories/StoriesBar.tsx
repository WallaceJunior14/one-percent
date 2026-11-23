import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Story } from '@/features/content/contract';
import { type Theme, useTheme } from '@/shared/ui/theme';

type Props = {
  /** Já filtrados para as áreas escolhidas que têm conteúdo hoje. */
  stories: Story[];
  areaNames: Record<string, string>;
  seenAreaIds: ReadonlySet<string>;
  onOpen(areaId: string): void;
};

/** Círculos no topo do feed, um por área, com o resumo do dia. */
export function StoriesBar({ stories, areaNames, seenAreaIds, onOpen }: Props) {
  const styles = makeStyles(useTheme());
  if (stories.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.bar}
    >
      {stories.map((story) => {
        const name = areaNames[story.areaId] ?? story.areaId;
        const seen = seenAreaIds.has(story.areaId);
        return (
          <Pressable
            key={story.areaId}
            accessibilityRole="button"
            accessibilityLabel={`Story: ${name}${seen ? ' (visto)' : ''}`}
            onPress={() => onOpen(story.areaId)}
            style={styles.item}
          >
            <View style={[styles.circle, seen ? styles.circleSeen : styles.circleNew]}>
              {/* O círculo tem tamanho fixo; o nome completo fica no rótulo e no leitor de tela. */}
              <Text style={styles.initial} maxFontSizeMultiplier={1.3}>
                {name.charAt(0)}
              </Text>
            </View>
            <Text style={[styles.label, seen && styles.labelSeen]} numberOfLines={1}>
              {name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    bar: { gap: spacing(2), paddingHorizontal: spacing(0.5), paddingVertical: spacing(1) },
    item: { alignItems: 'center', width: 68, gap: 4 },
    circle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    circleNew: { borderWidth: 3, borderColor: colors.primary },
    circleSeen: { borderWidth: 1, borderColor: colors.border },
    initial: { fontSize: 22, fontWeight: '700', color: colors.text },
    label: { fontSize: 12, color: colors.text },
    labelSeen: { color: colors.textMuted },
  });
}
