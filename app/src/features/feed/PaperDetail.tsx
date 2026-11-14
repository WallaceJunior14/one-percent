import { Text, View } from 'react-native';

import type { PaperCard as PaperCardData } from '@/features/content/contract';
import { formatShortDate } from '@/shared/lib/dates';
import { openUrlOrWarn } from '@/shared/lib/links';
import { useTheme } from '@/shared/ui/theme';
import { Badge, DetailBody, LinkButton, Section, useCardStyles } from './cardParts';

type Props = {
  card: PaperCardData;
  areaName: string;
  onOpenUrl?(url: string): void;
};

/** Conteúdo completo do artigo, no painel de detalhe (H2-1, H2-2): método, resultado e limitações com destaque. */
export function PaperDetail({ card, areaName, onOpenUrl = openUrlOrWarn }: Props) {
  const styles = useCardStyles();
  const { colors } = useTheme();
  const authors = `${card.authors.join(', ')}${card.authorsTruncated ? ' et al.' : ''}`;
  const { pdfUrl } = card;
  return (
    <DetailBody>
      <View style={styles.row}>
        <Badge label="Artigo científico" color={colors.paper} />
        <Badge label={areaName} />
        {card.isPreprint && (
          <Badge label="Preprint — não revisado por pares" color={colors.warning} />
        )}
      </View>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.subtitle}>{card.originalTitle}</Text>
      <Text style={styles.meta}>
        {authors} · {card.venue}
      </Text>
      <Text style={styles.meta}>{formatShortDate(card.publishedAt)}</Text>
      <Text style={styles.body}>{card.summary}</Text>
      <Section label="Método" text={card.method} />
      <Section label="Resultado" text={card.result} />
      <Section label="Limitações" text={card.limitations} />
      <Section label="Por que importa" text={card.whyItMatters} />
      <LinkButton label="Ler o artigo" onPress={() => onOpenUrl(card.url)} />
      {pdfUrl && <LinkButton label="Abrir o PDF" onPress={() => onOpenUrl(pdfUrl)} />}
    </DetailBody>
  );
}
