import { registerSW } from 'virtual:pwa-register';
import toast from 'react-hot-toast';

// How often an open tab asks the server for a new version (also on focus and
// when the network returns)
const CHECK_EVERY_MS = 30 * 60 * 1000;
// A visible tab switches to the new version after this long without input
const IDLE_BEFORE_RELOAD_MS = 30 * 1000;
const UPDATED_FLAG = 'hive:updated';

let lastInput = Date.now();

// Text typed into a field that a reload would throw away. Shared notes are not
// at risk: Yjs keeps every keystroke in IndexedDB.
const hasDraft = () => {
  const el = document.activeElement;
  return (
    (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') &&
    !['checkbox', 'radio', 'button', 'submit'].includes(el.type) &&
    el.value.trim() !== ''
  );
};

/**
 * Keep the installed app on the latest deploy without asking.
 *
 * The service worker (registerType 'autoUpdate') installs and activates a new
 * version as soon as it finds one. The page then has to reload to run it;
 * instead of reloading mid-sentence, it waits for a moment that interrupts
 * nobody: the tab in the background, or a visible tab left idle.
 */
export function startPwaUpdates() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach((type) =>
    window.addEventListener(type, () => { lastInput = Date.now(); }, { passive: true })
  );

  let reloading = false;
  let waitingToReload = false;
  const reload = () => {
    if (reloading) return;
    reloading = true;
    try {
      sessionStorage.setItem(UPDATED_FLAG, '1');
    } catch {
      // no notice after the reload; the update still happens
    }
    window.location.reload();
  };

  registerSW({
    immediate: true,

    // A new version is active; reload into it when that interrupts no one
    onNeedReload() {
      if (document.visibilityState === 'hidden') return reload();
      // A second update before the reload changes nothing: one wait is enough
      if (waitingToReload) return;
      waitingToReload = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') reload();
      });
      setInterval(() => {
        if (Date.now() - lastInput > IDLE_BEFORE_RELOAD_MS && !hasDraft()) reload();
      }, 5000);
    },

    // Browsers only look for a new service worker on navigation, which a
    // single-page app rarely does, so ask explicitly
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (!navigator.onLine || document.visibilityState !== 'visible' || registration.installing) return;
        registration.update().catch(() => {});
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', check);
      window.addEventListener('online', check);
    },
  });

  // Say so once, after the reload that brought the new version in
  try {
    if (sessionStorage.getItem(UPDATED_FLAG)) {
      sessionStorage.removeItem(UPDATED_FLAG);
      toast.success('StudySync was updated to the latest version', { id: 'pwa-updated' });
    }
  } catch {
    // storage unavailable: skip the notice
  }
}
