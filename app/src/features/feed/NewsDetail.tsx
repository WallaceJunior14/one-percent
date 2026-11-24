import { Text, View } from 'react-native';

import type { NewsCard as NewsCardData } from '@/features/content/contract';
import { formatShortDate } from '@/shared/lib/dates';
import { openUrlOrWarn } from '@/shared/lib/links';
import { Badge, DetailBody, LinkButton, Section, useCardStyles } from './cardParts';
import { t } from '@/shared/i18n/pt-BR';

type Props = {
  card: NewsCardData;
  areaName: string;
  onOpenUrl?(url: string): void;
};

/** Conteúdo completo da notícia, no painel de detalhe: textos do LLM exibidos como texto puro; link sempre da fonte. */
export function NewsDetail({ card, areaName, onOpenUrl = openUrlOrWarn }: Props) {
  const styles = useCardStyles();
  return (
    <DetailBody>
      <View style={styles.row}>
        <Badge label={areaName} />
      </View>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.meta}>
        {t.common.byline(card.sourceName, formatShortDate(card.publishedAt))}
      </Text>
      <Text style={styles.body}>{card.summary}</Text>
      <Section label={t.card.whyItMatters} text={card.whyItMatters} />
      <LinkButton label={t.card.readOriginal} onPress={() => onOpenUrl(card.url)} />
    </DetailBody>
  );
}
