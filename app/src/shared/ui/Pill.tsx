import { Pressable, type StyleProp, StyleSheet, Text, type ViewStyle } from 'react-native';

import { type Theme, useTheme } from './theme';

type Props = {
  label: string;
  onPress(): void;
  accessibilityLabel?: string;
  /** Para filtros: mostra e anuncia o estado selecionado. */
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Pill({ label, onPress, accessibilityLabel, selected, style }: Props) {
  const styles = makeStyles(useTheme());
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      hitSlop={8}
      style={[styles.pill, selected && styles.selected, style]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    pill: {
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.75),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selected: { backgroundColor: colors.primary, borderColor: colors.primary },
    label: { fontSize: 14, fontWeight: '700', color: colors.text },
    selectedLabel: { color: colors.onPrimary },
  });
}
