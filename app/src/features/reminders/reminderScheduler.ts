import { z } from 'zod';

import { estimatedMinutes, FEED_DEFAULTS, type FeedSettings } from '@/features/feed/feedSettings';
import type { ProgressRepository } from '@/features/streak/progress';
import { type Clock, toLocalDateString } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
import { createVersionedStore, sameFormat } from '@/shared/lib/versionedStore';

export const REMINDER_KEY = 'reminder';
/** Dias agendados à frente; cada abertura do app e cada dia concluído renovam a janela. */
export const DAYS_AHEAD = 7;

const settingsSchema = z.object({
  enabled: z.boolean(),
  hour: z.int().min(0).max(23),
  minute: z.int().min(0).max(59),
});

export type ReminderSettings = z.infer<typeof settingsSchema>;

/** Desligado por padrão; o horário é só a sugestão inicial. */
export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 8, minute: 0 };

export function reminderMessage(feed: FeedSettings) {
  return {
    title: '1% ao Dia',
    body: `Seu dia está pronto: ${feed.feedSize} cards, ~${estimatedMinutes(feed)} min`,
  };
}

const pad = (value: number) => String(value).padStart(2, '0');
/** Ex.: "07:30". */
export const formatTime = ({ hour, minute }: { hour: number; minute: number }) =>
  `${pad(hour)}:${pad(minute)}`;

/** Porta para as notificações locais do sistema (adaptador real em `expoNotificationScheduler`). */
export type NotificationScheduler = {
  /** `true` se o usuário permitir notificações. */
  requestPermission(): Promise<boolean>;
  cancelAll(): Promise<void>;
  schedule(at: Date, message: { title: string; body: string }): Promise<void>;
};

/** `unavailable`: o aparelho não conseguiu pedir permissão ou agendar (ex.: limite do Expo Go). */
export type ReminderSaveStatus = 'saved' | 'permission-denied' | 'unavailable';

export type ReminderService = {
  settings(): Promise<ReminderSettings>;
  /**
   * Salva e reagenda. Ao ligar, pede permissão; sem permissão ou se o agendamento falhar,
   * o lembrete fica desligado. Nunca rejeita.
   */
  update(
    settings: ReminderSettings,
  ): Promise<{ settings: ReminderSettings; status: ReminderSaveStatus }>;
  /** Reagenda a partir de agora: chamar ao abrir o app e ao concluir o dia. */
  refresh(): Promise<void>;
};

type Dependencies = {
  store: KeyValueStore;
  scheduler: NotificationScheduler;
  progress: ProgressRepository;
  clock: Clock;
  /** Parâmetros do último conteúdo baixado, para a mensagem refletir o feed real. */
  feedSettings?: () => Promise<FeedSettings>;
};

/**
 * Lembrete diário com notificações de data fixa, uma por dia, nos próximos
 * {@link DAYS_AHEAD} dias. Pular o dia de hoje quando ele já foi concluído evita o aviso
 * sem precisar de servidor de push.
 */
export function createReminderService({
  store,
  scheduler,
  progress,
  clock,
  feedSettings = async () => FEED_DEFAULTS,
}: Dependencies): ReminderService {
  const stored = createVersionedStore({
    store,
    clock,
    key: REMINDER_KEY,
    version: 2,
    schema: settingsSchema,
    migrations: { 1: sameFormat },
    legacyKeys: ['reminder.v1'],
  });
  const settings = async (): Promise<ReminderSettings> => (await stored.read()) ?? DEFAULT_REMINDER;

  const reschedule = async (current: ReminderSettings) => {
    await scheduler.cancelAll();
    if (!current.enabled) return;
    const now = clock.now();
    const { completedDays } = await progress.load();
    const completedToday = completedDays.includes(toLocalDateString(now));
    const message = reminderMessage(await feedSettings());
    for (const at of upcomingTimes(current, now, completedToday)) {
      await scheduler.schedule(at, message);
    }
  };

  return {
    settings,
    async update(requested) {
      const save = async (settings: ReminderSettings, status: ReminderSaveStatus) => {
        await stored.write(settings);
        return { settings, status };
      };
      const off = { ...requested, enabled: false };
      try {
        if (requested.enabled && !(await scheduler.requestPermission())) {
          await reschedule(off);
          return await save(off, 'permission-denied');
        }
        await reschedule(requested);
        return await save(requested, 'saved');
      } catch {
        await scheduler.cancelAll().catch(() => undefined);
        // Desligar não depende de notificação: o pedido foi atendido mesmo com o erro.
        return save(off, requested.enabled ? 'unavailable' : 'saved');
      }
    },
    async refresh() {
      await reschedule(await settings());
    },
  };
}

function upcomingTimes(settings: ReminderSettings, now: Date, completedToday: boolean): Date[] {
  const times: Date[] = [];
  for (let offset = 0; times.length < DAYS_AHEAD; offset += 1) {
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      settings.hour,
      settings.minute,
    );
    const isToday = offset === 0;
    if (isToday && (completedToday || at <= now)) continue;
    times.push(at);
  }
  return times;
}
