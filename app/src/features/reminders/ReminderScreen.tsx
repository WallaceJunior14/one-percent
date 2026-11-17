import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type Theme, useTheme } from '@/shared/ui/theme';
import { formatTime, type ReminderSaveStatus, type ReminderSettings } from './reminderScheduler';

type Props = {
  initial: ReminderSettings;
  /** "Começar" no fim do onboarding, "Salvar" a partir do perfil. */
  saveLabel: string;
  onSave(settings: ReminderSettings): Promise<{ status: ReminderSaveStatus }>;
  onBack?(): void;
};

const SUGGESTED_HOURS = [6, 7, 8, 12, 18, 21];

/** Lembrete diário (H8): oferecido no fim do onboarding, desligado por padrão. */
export function ReminderScreen({ initial, saveLabel, onSave, onBack }: Props) {
  const styles = makeStyles(useTheme());
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState<ReminderSaveStatus>('saved');

  const times = SUGGESTED_HOURS.map((hour) => ({ hour, minute: 0 }));
  if (!times.some((time) => formatTime(time) === formatTime(initial))) {
    times.push({ hour: initial.hour, minute: initial.minute });
    times.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  }

  const save = async () => {
    const result = await onSave(settings);
    setStatus(result.status);
    if (result.status !== 'saved') setSettings({ ...settings, enabled: false });
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {onBack && (
          <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8} style={styles.pill}>
            <Text style={styles.pillLabel}>Voltar</Text>
          </Pressable>
        )}
        <Text accessibilityRole="header" style={styles.title}>
          Quer um lembrete?
        </Text>
        <Text style={styles.subtitle}>
          Um aviso por dia, no horário que você escolher, quando o conteúdo estiver pronto. Se você
          já tiver concluído o dia, o aviso não aparece.
        </Text>

        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Lembrete diário"
          accessibilityState={{ checked: settings.enabled }}
          onPress={() => setSettings({ ...settings, enabled: !settings.enabled })}
          style={styles.row}
        >
          <Text style={styles.rowLabel}>Lembrete diário</Text>
          <View style={[styles.track, settings.enabled && styles.trackOn]}>
            <View style={[styles.thumb, settings.enabled && styles.thumbOn]} />
          </View>
        </Pressable>

        {settings.enabled && (
          <View accessibilityRole="radiogroup" style={styles.times}>
            {times.map((time) => {
              const label = formatTime(time);
              const checked = label === formatTime(settings);
              return (
                <Pressable
                  key={label}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ checked }}
                  onPress={() => setSettings({ ...settings, ...time })}
                  style={[styles.time, checked && styles.timeChecked]}
                >
                  <Text style={[styles.timeLabel, checked && styles.timeLabelChecked]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {status === 'unavailable' && (
          <Text style={styles.warning}>
            Não foi possível ativar o lembrete neste aparelho. O restante do app funciona
            normalmente.
          </Text>
        )}
        {status === 'permission-denied' && (
          <Text style={styles.warning}>
            Sem permissão para notificações. Ative nas configurações do Android para usar o
            lembrete.
          </Text>
        )}
      </ScrollView>

      <Pressable accessibilityRole="button" onPress={() => void save()} style={styles.button}>
        <Text style={styles.buttonLabel}>{saveLabel}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingTop: spacing(6), gap: spacing(2) },
    pill: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.75),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 16, color: colors.textMuted },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing(2),
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    rowLabel: { fontSize: 17, fontWeight: '700', color: colors.text },
    track: {
      width: 48,
      height: 28,
      borderRadius: 14,
      padding: 3,
      backgroundColor: colors.border,
    },
    trackOn: { backgroundColor: colors.primary },
    thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.background },
    thumbOn: { alignSelf: 'flex-end' },
    times: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
    time: {
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timeChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
    timeLabel: { fontSize: 16, color: colors.text },
    timeLabelChecked: { color: colors.onPrimary, fontWeight: '700' },
    warning: { fontSize: 15, color: colors.warning },
    button: {
      margin: spacing(3),
      padding: spacing(2),
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    buttonLabel: { fontSize: 17, fontWeight: '700', color: colors.onPrimary },
  });
}
