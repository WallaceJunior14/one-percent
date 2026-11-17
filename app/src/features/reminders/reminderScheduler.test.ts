import { createProgressRepository } from '@/features/streak/progress';
import { createMemoryStore, fixedClock } from '@/test/fakes';
import { createReminderService, type NotificationScheduler } from './reminderScheduler';

type Scheduled = { at: Date; title: string; body: string };

function fakeScheduler({ granted = true } = {}) {
  const scheduled: Scheduled[] = [];
  const scheduler: NotificationScheduler & { scheduled: Scheduled[]; permissionAsked: number } = {
    scheduled,
    permissionAsked: 0,
    async requestPermission() {
      scheduler.permissionAsked += 1;
      return granted;
    },
    async cancelAll() {
      scheduled.length = 0;
    },
    async schedule(at, message) {
      scheduled.push({ at, ...message });
    },
  };
  return scheduler;
}

function setup({ now = new Date(2026, 10, 16, 6, 0), granted = true } = {}) {
  const clock = fixedClock(now);
  const scheduler = fakeScheduler({ granted });
  const progress = createProgressRepository(createMemoryStore(), clock);
  const service = createReminderService({ store: createMemoryStore(), scheduler, progress, clock });
  return { service, scheduler, progress };
}

const days = (scheduled: Scheduled[]) => scheduled.map(({ at }) => at.getDate());

test('off_by_default', async () => {
  const { service, scheduler } = setup();

  expect(await service.settings()).toEqual({ enabled: false, hour: 8, minute: 0 });
  await service.refresh();

  expect(scheduler.scheduled).toHaveLength(0);
  expect(scheduler.permissionAsked).toBe(0);
});

test('schedules_at_chosen_time', async () => {
  const { service, scheduler } = setup();

  const result = await service.update({ enabled: true, hour: 7, minute: 30 });

  expect(result).toEqual({
    settings: { enabled: true, hour: 7, minute: 30 },
    permissionDenied: false,
  });
  expect(days(scheduler.scheduled)).toEqual([16, 17, 18, 19, 20, 21, 22]);
  for (const { at } of scheduler.scheduled) {
    expect([at.getHours(), at.getMinutes()]).toEqual([7, 30]);
  }
});

test('message_says_the_day_is_ready', async () => {
  const { service, scheduler } = setup();

  await service.update({ enabled: true, hour: 7, minute: 30 });

  expect(scheduler.scheduled[0]).toMatchObject({
    title: '1% ao Dia',
    body: 'Seu dia está pronto: 15 cards, ~10 min',
  });
});

test('skips_today_when_completed', async () => {
  const { service, scheduler, progress } = setup();
  await service.update({ enabled: true, hour: 7, minute: 30 });

  await progress.completeDay([]);
  await service.refresh();

  expect(days(scheduler.scheduled)).toEqual([17, 18, 19, 20, 21, 22, 23]);
});

test('skips_today_when_the_time_has_passed', async () => {
  const { service, scheduler } = setup({ now: new Date(2026, 10, 16, 9, 0) });

  await service.update({ enabled: true, hour: 7, minute: 30 });

  expect(days(scheduler.scheduled)[0]).toBe(17);
});

test('refreshing_replaces_previous_notifications', async () => {
  const { service, scheduler } = setup();
  await service.update({ enabled: true, hour: 7, minute: 30 });

  await service.refresh();
  await service.refresh();

  expect(scheduler.scheduled).toHaveLength(7);
});

test('turning_off_cancels_everything', async () => {
  const { service, scheduler } = setup();
  await service.update({ enabled: true, hour: 7, minute: 30 });

  await service.update({ enabled: false, hour: 7, minute: 30 });

  expect(scheduler.scheduled).toHaveLength(0);
  expect((await service.settings()).enabled).toBe(false);
});

test('stays_off_when_permission_is_denied', async () => {
  const { service, scheduler } = setup({ granted: false });

  const result = await service.update({ enabled: true, hour: 7, minute: 30 });

  expect(result).toEqual({
    settings: { enabled: false, hour: 7, minute: 30 },
    permissionDenied: true,
  });
  expect(await service.settings()).toEqual({ enabled: false, hour: 7, minute: 30 });
  expect(scheduler.scheduled).toHaveLength(0);
});

test('ignores_corrupted_settings', async () => {
  const clock = fixedClock(new Date(2026, 10, 16, 6, 0));
  const store = createMemoryStore({ 'reminder.v1': '{"enabled":true,"hour":99}' });
  const service = createReminderService({
    store,
    scheduler: fakeScheduler(),
    progress: createProgressRepository(createMemoryStore(), clock),
    clock,
  });

  expect(await service.settings()).toEqual({ enabled: false, hour: 8, minute: 0 });
});
