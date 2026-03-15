// Health Agent Service Worker
// Handles push notifications for supplements

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Handle scheduled supplement notifications
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SCHEDULE_SUPPLEMENTS') {
    const { supplements, todayDow } = event.data;
    scheduleSupplements(supplements, todayDow);
  }
  if (event.data?.type === 'CANCEL_ALL') {
    // Clear all scheduled notifications
    Object.keys(self._timers || {}).forEach(id => clearTimeout(self._timers[id]));
    self._timers = {};
  }
});

self._timers = {};

function scheduleSupplements(supplements, todayDow) {
  // Clear existing timers
  Object.keys(self._timers).forEach(id => clearTimeout(self._timers[id]));
  self._timers = {};

  const now = new Date();
  const todaySupl = supplements.filter(s => s.days?.includes(todayDow));

  // Group by time
  const byTime = {};
  todaySupl.forEach(s => {
    const t = s.time?.substring(0, 5);
    if (!t) return;
    if (!byTime[t]) byTime[t] = [];
    byTime[t].push(s);
  });

  Object.entries(byTime).forEach(([time, supls]) => {
    const [h, m] = time.split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);

    const ms = target - now;
    if (ms <= 0) return; // Already passed today

    const id = `supl_${time}`;
    self._timers[id] = setTimeout(() => {
      const names = supls.map(s => s.name).join(', ');
      self.registration.showNotification('💊 Suplimente', {
        body: `${time} — ${names}`,
        icon: '/icon.png',
        badge: '/icon.png',
        tag: `supl_${time}`,
        renotify: true,
        requireInteraction: false,
        data: { time, supls },
        actions: [
          { action: 'done', title: '✓ Luat' },
          { action: 'snooze', title: '⏰ 10 min' }
        ]
      });
    }, ms);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'snooze') {
    const { time, supls } = event.notification.data || {};
    setTimeout(() => {
      const names = supls?.map(s => s.name).join(', ') || '';
      self.registration.showNotification('💊 Suplimente (reamintire)', {
        body: `${time} — ${names}`,
        icon: '/icon.png',
        tag: `supl_snooze_${time}`,
      });
    }, 10 * 60 * 1000);
  }
  if (event.action === 'done' || !event.action) {
    // Open app
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        if (clients.length > 0) { clients[0].focus(); return; }
        self.clients.openWindow('/');
      })
    );
  }
});
