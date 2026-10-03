import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

const OFFLINE_TOAST = 'connectivity-offline';

/**
 * Tells the user once when the connection drops and when it returns, so being
 * offline reads as "keep working" rather than as something broken.
 */
export default function ConnectivityNotice() {
  const online = useOnlineStatus();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      toast("You're offline. Keep working: notes are saved on this device and sync when you reconnect.", {
        id: OFFLINE_TOAST,
        icon: '📴',
        duration: Infinity,
      });
      return;
    }
    toast.dismiss(OFFLINE_TOAST);
    if (wasOffline.current) {
      wasOffline.current = false;
      toast.success('Back online. Syncing your changes…', { id: 'connectivity-online' });
    }
  }, [online]);

  return null;
}
