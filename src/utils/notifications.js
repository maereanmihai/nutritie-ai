// ─── Notification & ServiceWorker utilities ──────────────────────────────────

let swRegistration = null;

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    return swRegistration;
  } catch (e) {
    console.warn('SW registration failed:', e);
    return null;
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

export function scheduleSupplementNotifications(supplements) {
  if (!navigator.serviceWorker?.controller) return;
  if (Notification.permission !== 'granted') return;
  const todayDow = new Date().getDay() || 7;
  navigator.serviceWorker.controller.postMessage({
    type: 'SCHEDULE_SUPPLEMENTS',
    supplements,
    todayDow,
  });
}

export function cancelAllNotifications() {
  if (!navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_ALL' });
}

export function showInstantNotification(title, body) {
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/icon.png' });
}

export function getNotificationStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}
