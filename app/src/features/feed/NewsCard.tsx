import { Text, View } from 'react-native';

import type { NewsCard as NewsCardData } from '@/features/content/contract';
import { formatShortDate } from '@/shared/lib/dates';
import { openExternalUrl } from '@/shared/lib/links';
import { Badge, CardFrame, LinkButton, Section, useCardStyles } from './cardParts';

type Props = {
  card: NewsCardData;
  areaName: string;
  onOpenUrl?(url: string): void;
};

/** Card de notícia (H1-2): textos do LLM exibidos como texto puro; link sempre da fonte. */
export function NewsCard({ card, areaName, onOpenUrl = openExternalUrl }: Props) {
  const styles = useCardStyles();
  return (
    <CardFrame>
      <View style={styles.row}>
        <Badge label={areaName} />
      </View>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.meta}>
        {card.sourceName} · {formatShortDate(card.publishedAt)}
      </Text>
      <Text style={styles.body}>{card.summary}</Text>
      <Section label="Por que importa" text={card.whyItMatters} />
      <LinkButton label="Ler a matéria original" onPress={() => onOpenUrl(card.url)} />
    </CardFrame>
  );
}
