import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Card } from '@/features/content/contract';
import { type Theme, useTheme } from '@/shared/ui/theme';
import { NewsDetail } from './NewsDetail';
import { PaperDetail } from './PaperDetail';

type Props = {
  /** Card aberto; `null` mantém o painel fechado. */
  card: Card | null;
  areaName: string;
  onClose(): void;
  onOpenUrl?(url: string): void;
  /** Se o card aberto já está nos salvos (H6). */
  saved?: boolean;
  /** Sem esta função, o botão de salvar não aparece. */
  onToggleSave?(card: Card): void;
};

/** Painel que sobe de baixo com o conteúdo completo e rolagem própria (H1-2a). */
export function CardDetailSheet({
  card,
  areaName,
  onClose,
  onOpenUrl,
  saved = false,
  onToggleSave,
}: Props) {
  const styles = makeStyles(useTheme());
  return (
    <Modal
      testID="card-detail-sheet"
      visible={card !== null}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.outside}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.handle} />
            {card && onToggleSave && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Remover dos salvos' : 'Salvar card'}
                accessibilityState={{ selected: saved }}
                onPress={() => onToggleSave(card)}
                hitSlop={12}
                style={[styles.save, saved && styles.saveActive]}
              >
                <Text style={[styles.saveLabel, saved && styles.saveLabelActive]}>
                  {saved ? 'Salvo' : 'Salvar'}
                </Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>Fechar</Text>
            </Pressable>
          </View>
          {card && (
            <ScrollView contentContainerStyle={styles.content}>
              {card.type === 'paper' ? (
                <PaperDetail card={card} areaName={areaName} onOpenUrl={onOpenUrl} />
              ) : (
                <NewsDetail card={card} areaName={areaName} onOpenUrl={onOpenUrl} />
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    outside: { height: '8%' },
    sheet: {
      flex: 1,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: spacing(2),
      paddingHorizontal: spacing(3),
      paddingTop: spacing(2),
      paddingBottom: spacing(1),
    },
    handle: {
      position: 'absolute',
      top: spacing(1),
      alignSelf: 'center',
      left: '45%',
      width: '10%',
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    close: { fontSize: 16, fontWeight: '700', color: colors.primary },
    save: {
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.5),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    saveActive: { backgroundColor: colors.primary },
    saveLabel: { fontSize: 14, fontWeight: '700', color: colors.primary },
    saveLabelActive: { color: colors.onPrimary },
    content: { padding: spacing(3), paddingTop: spacing(1), paddingBottom: spacing(6) },
  });
}
