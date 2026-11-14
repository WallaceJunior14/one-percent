import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Theme, useTheme } from '@/shared/ui/theme';

/** Versão inicial; a T092 acrescenta cards lidos, áreas cobertas e a sequência de dias. */
export default function DayCompleteRoute() {
  const router = useRouter();
  const styles = makeStyles(useTheme());
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Dia concluído</Text>
      <Text style={styles.text}>Você ficou 1% mais sábio hoje. Até amanhã!</Text>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.button}>
        <Text style={styles.buttonLabel}>Rever os cards</Text>
      </Pressable>
    </View>
  );
}

function makeStyles({ colors, spacing }: Theme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing(4),
      gap: 12,
      backgroundColor: colors.background,
    },
    title: { fontSize: 30, fontWeight: '700', color: colors.text },
    text: { fontSize: 17, color: colors.textMuted, textAlign: 'center' },
    button: {
      marginTop: spacing(2),
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(4),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    buttonLabel: { fontSize: 17, fontWeight: '700', color: colors.primary },
  });
}
