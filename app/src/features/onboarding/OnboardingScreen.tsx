import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BUNDLED_CATALOG, type Catalog } from '@/features/content/catalog';
import { type Theme, useTheme } from '@/shared/ui/theme';
import type { Preferences } from './preferences';
import { t } from '@/shared/i18n/pt-BR';

type Props = {
  /** Escolhas atuais, ao editar pelas configurações. */
  initial?: Preferences;
  /** Áreas e grupos do último conteúdo baixado; sem nenhum, o catálogo embutido. */
  catalog?: Catalog;
  onComplete(preferences: Preferences): void;
};

export function OnboardingScreen({ initial, catalog = BUNDLED_CATALOG, onComplete }: Props) {
  const theme = useTheme();
  const [areaIds, setAreaIds] = useState<string[]>(initial?.areaIds ?? []);
  const [subareaIds, setSubareaIds] = useState<string[]>(initial?.subareaIds ?? []);

  const toggleArea = (areaId: string) => {
    if (areaIds.includes(areaId)) {
      setAreaIds(areaIds.filter((id) => id !== areaId));
      setSubareaIds(subareaIds.filter((id) => !id.startsWith(`${areaId}.`)));
    } else {
      setAreaIds([...areaIds, areaId]);
    }
  };
  const toggleSubarea = (subareaId: string) =>
    setSubareaIds(
      subareaIds.includes(subareaId)
        ? subareaIds.filter((id) => id !== subareaId)
        : [...subareaIds, subareaId],
    );

  const complete = () => {
    const inCatalogOrder = <T extends { id: string }>(items: readonly T[], ids: string[]) =>
      items.filter((item) => ids.includes(item.id)).map((item) => item.id);
    onComplete({
      areaIds: inCatalogOrder(catalog.areas, areaIds),
      subareaIds: inCatalogOrder(
        catalog.areas.flatMap((area) => area.subareas),
        subareaIds,
      ),
    });
  };

  const styles = makeStyles(theme);
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t.onboarding.title}</Text>
        <Text style={styles.subtitle}>{t.onboarding.subtitle}</Text>

        {catalog.groups.map((group) => (
          <View key={group.id} style={styles.group}>
            <Text accessibilityRole="header" style={styles.groupTitle}>
              {group.name}
            </Text>
            {catalog.areas
              .filter((area) => area.groupId === group.id)
              .map((area) => {
                const selected = areaIds.includes(area.id);
                return (
                  <View key={area.id}>
                    <Option
                      label={area.name}
                      checked={selected}
                      onPress={() => toggleArea(area.id)}
                      theme={theme}
                    />
                    {selected && (
                      <View style={styles.subareas}>
                        {area.subareas.map((subarea) => (
                          <Option
                            key={subarea.id}
                            label={subarea.name}
                            checked={subareaIds.includes(subarea.id)}
                            onPress={() => toggleSubarea(subarea.id)}
                            theme={theme}
                            compact
                          />
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
          </View>
        ))}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: areaIds.length === 0 }}
        disabled={areaIds.length === 0}
        onPress={complete}
        style={[styles.button, areaIds.length === 0 && styles.buttonDisabled]}
      >
        <Text style={styles.buttonLabel}>{t.onboarding.continue}</Text>
      </Pressable>
    </View>
  );
}

type OptionProps = {
  label: string;
  checked: boolean;
  onPress(): void;
  theme: Theme;
  compact?: boolean;
};

function Option({ label, checked, onPress, theme, compact }: OptionProps) {
  const { colors } = theme;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: compact ? 8 : 12,
        paddingHorizontal: 12,
        marginVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: checked ? colors.primary : colors.border,
        backgroundColor: checked ? colors.surface : colors.background,
      }}
    >
      <Text style={{ fontSize: compact ? 15 : 17, color: colors.text, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 17, color: checked ? colors.primary : colors.textMuted }}>
        {checked ? '✓' : '+'}
      </Text>
    </Pressable>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingTop: spacing(8) },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 16, color: colors.textMuted, marginTop: spacing(1) },
    group: { marginTop: spacing(3) },
    groupTitle: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
    subareas: { marginLeft: spacing(2) },
    button: {
      margin: spacing(3),
      padding: spacing(2),
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    buttonDisabled: { opacity: 0.4 },
    buttonLabel: { fontSize: 17, fontWeight: '700', color: colors.onPrimary },
  });
}
