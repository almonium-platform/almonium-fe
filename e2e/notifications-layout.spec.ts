import {expect, test} from '@playwright/test';

const user = {
  id: '01989f47-4c2a-7a10-9e5b-751983624a30',
  username: 'marta',
  email: 'marta@example.com',
  emailVerified: true,
  hidden: false,
  uiLang: 'en',
  avatarUrl: null,
  background: null,
  fluentLangs: ['UK'],
  setupStep: 'COMPLETED',
  tags: [],
  premium: true,
  admin: false,
  interests: [],
  notifications: {socialEmails: true, bookEmails: true},
  streamChatToken: 'token',
  subscription: {
    name: 'Premium',
    limits: {MAX_FLUENT_LANGS: 3, MAX_BOOK_IMPORTS_ON_SHELF: 10},
    type: 'MONTHLY',
    autoRenewal: true,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2027-01-01T00:00:00Z',
  },
  learners: [{id: '01989f47-4c2a-7a10-9e5b-751983624a31', language: 'EN', selfReportedLevel: 'B1', active: true}],
  uiPreferences: {
    navbar: {discover: true, review: true, play: true, read: true, write: true, notifications: true, social: true},
  },
};

const titles = [
  'The Turn of the Screw',
  'The Thirty-nine Steps',
  'The Secret Garden',
  'The Scarlet Letter',
  "Le Fantôme de l'Opéra",
  'Le Mystère de la chambre jaune',
  'The Lost World',
  'The Legend of Sleepy Hollow',
  'La Dame aux camélias',
  'Au Bonheur des Dames',
  'The Island of Doctor Moreau',
  'Der Golem',
];

const notifications = titles.map((title, index) => ({
  id: `01989f47-4c2a-7a10-9e5b-751983624a${String(index).padStart(2, '0')}`,
  type: 'BOOK_REQUEST_PUBLISHED',
  title: `${title} is now on the shelf`,
  message: 'You asked for it in October.',
  createdAt: new Date(Date.now() - 14 * 60_000).toISOString(),
  readAt: null,
  referenceId: `slug-${index}`,
  pictureUrl: null,
  senderId: null,
  senderUsername: null,
  actionPath: `/read/slug-${index}`,
  contextTitle: title,
}));

test('notifications popover renders many book rows without squishing or clipping them', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('current_language', JSON.stringify('EN'));
    localStorage.setItem('read_library_view', JSON.stringify('covers'));
  });

  await page.route(/(api\.almonium\.com|localhost:9998)\/v1\//, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/users/me')) await route.fulfill({json: user});
    else if (path.endsWith('/public/csrf/token')) await route.fulfill({body: 'token'});
    else if (path.endsWith('/notifications')) await route.fulfill({json: notifications});
    else if (path.endsWith('/books/language/EN')) await route.fulfill({json: {continueReading: [], available: [], favorites: []}});
    else if (path.endsWith('/book-imports')) await route.fulfill({json: []});
    else if (path.endsWith('/book-imports/quota')) await route.fulfill({json: {limit: 10, used: 0}});
    else if (path.endsWith('/books/orders')) await route.fulfill({json: []});
    else if (path.endsWith('/books/orders/quota')) await route.fulfill({json: {limit: 3, used: 0, periodStartsAt: '2026-01-01T00:00:00Z', periodEndsAt: '2026-02-01T00:00:00Z'}});
    else if (path.endsWith('/public/plans')) await route.fulfill({json: []});
    else await route.fulfill({json: []});
  });

  await page.goto('/read');

  const bell = page.locator('.nav-actions .icon-badge').filter({hasText: String(notifications.length)});
  await expect(bell).toBeVisible();
  await bell.click();

  const popover = page.locator('.notifications-popover');
  await expect(popover).toBeVisible();

  const items = popover.locator('.notification-item');
  await expect(items).toHaveCount(notifications.length);

  // Verify no row overlaps the next and no row's text or action link overflows its box.
  const metrics = await popover.evaluate(el => {
    const rows = Array.from(el.querySelectorAll<HTMLElement>('.notification-item'));
    const rects = rows.map(row => {
      const box = row.getBoundingClientRect();
      const message = row.querySelector<HTMLElement>('.notification-message')!.getBoundingClientRect();
      const action = row.querySelector<HTMLElement>('.notification-action')!.getBoundingClientRect();
      const meta = row.querySelector<HTMLElement>('.notification-meta')!.getBoundingClientRect();
      return {
        top: box.top,
        bottom: box.bottom,
        height: box.height,
        messageOverflowBottom: message.bottom - box.bottom,
        actionOverflowBottom: action.bottom - box.bottom,
        metaOverflowBottom: meta.bottom - box.bottom,
      };
    });
    const scrollHost = el.querySelector<HTMLElement>('.menu-section');
    return {
      popoverHeight: el.getBoundingClientRect().height,
      viewportHeight: window.innerHeight,
      scrollHeight: scrollHost?.scrollHeight ?? 0,
      clientHeight: scrollHost?.clientHeight ?? 0,
      rects,
    };
  });

  expect(metrics.popoverHeight).toBeLessThan(metrics.viewportHeight);
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  for (let i = 0; i < metrics.rects.length; i++) {
    const row = metrics.rects[i];
    expect(row.messageOverflowBottom, `row ${i} message clipped`).toBeLessThanOrEqual(1);
    expect(row.actionOverflowBottom, `row ${i} action clipped`).toBeLessThanOrEqual(1);
    expect(row.metaOverflowBottom, `row ${i} meta clipped`).toBeLessThanOrEqual(1);
    if (i + 1 < metrics.rects.length) {
      expect(row.bottom, `row ${i} overlaps row ${i + 1}`).toBeLessThanOrEqual(metrics.rects[i + 1].top + 1);
    }
  }
});
