import { Text, View } from 'react-native';

import type { PaperCard as PaperCardData } from '@/features/content/contract';
import { formatShortDate } from '@/shared/lib/dates';
import { openUrlOrWarn } from '@/shared/lib/links';
import { useTheme } from '@/shared/ui/theme';
import { Badge, DetailBody, LinkButton, Section, useCardStyles } from './cardParts';
import { t } from '@/shared/i18n/pt-BR';

type Props = {
  card: PaperCardData;
  areaName: string;
  onOpenUrl?(url: string): void;
};

/** Conteúdo completo do artigo, no painel de detalhe: método, resultado e limitações com destaque. */
export function PaperDetail({ card, areaName, onOpenUrl = openUrlOrWarn }: Props) {
  const styles = useCardStyles();
  const { colors } = useTheme();
  const authors = `${card.authors.join(', ')}${card.authorsTruncated ? t.common.etAl : ''}`;
  const { pdfUrl } = card;
  return (
    <DetailBody>
      <View style={styles.row}>
        <Badge label={t.card.paperBadge} color={colors.paper} />
        <Badge label={areaName} />
        {card.isPreprint && <Badge label={t.card.preprintBadge} color={colors.warning} />}
      </View>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.subtitle}>{card.originalTitle}</Text>
      <Text style={styles.meta}>{t.common.byline(authors, card.venue)}</Text>
      <Text style={styles.meta}>{formatShortDate(card.publishedAt)}</Text>
      <Text style={styles.body}>{card.summary}</Text>
      <Section label={t.card.method} text={card.method} />
      <Section label={t.card.result} text={card.result} />
      <Section label={t.card.limitations} text={card.limitations} />
      <Section label={t.card.whyItMatters} text={card.whyItMatters} />
      <LinkButton label={t.card.readPaper} onPress={() => onOpenUrl(card.url)} />
      {pdfUrl && <LinkButton label={t.card.openPdf} onPress={() => onOpenUrl(pdfUrl)} />}
    </DetailBody>
  );
}
