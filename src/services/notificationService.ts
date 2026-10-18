import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import { isSupabaseConfigured, secureRpc } from '../lib/supabase';

/**
 * Loads ONLY the local notification submodules of `expo-notifications`
 * without importing the root `expo-notifications/build/index.js` (which pulls in
 * `TopicSubscriptionModule.android.js` that is unavailable in Expo Go on Android).
 */
let cachedNotifications: {
  setNotificationHandler?: any;
  scheduleNotificationAsync?: any;
  addNotificationReceivedListener?: any;
  addNotificationResponseReceivedListener?: any;
  getPermissionsAsync?: any;
  requestPermissionsAsync?: any;
  setNotificationChannelAsync?: any;
  getExpoPushTokenAsync?: any;
} | null = null;

let initialized = false;

function getLocalNotificationsApi() {
  if (initialized) {
    return cachedNotifications;
  }
  initialized = true;

  try {
    // Import only local notification modules (avoids TopicSubscriptionModule on Expo Go Android)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const handlerMod = require('expo-notifications/build/NotificationsHandler');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const scheduleMod = require('expo-notifications/build/scheduleNotificationAsync');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const emitterMod = require('expo-notifications/build/NotificationsEmitter');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const permissionsMod = require('expo-notifications/build/NotificationPermissions');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const channelMod = require('expo-notifications/build/setNotificationChannelAsync');

    cachedNotifications = {
      setNotificationHandler: handlerMod?.setNotificationHandler,
      scheduleNotificationAsync: scheduleMod?.scheduleNotificationAsync,
      addNotificationReceivedListener:
        emitterMod?.addNotificationReceivedListener,
      addNotificationResponseReceivedListener:
        emitterMod?.addNotificationResponseReceivedListener,
      getPermissionsAsync: permissionsMod?.getPermissionsAsync,
      requestPermissionsAsync: permissionsMod?.requestPermissionsAsync,
      setNotificationChannelAsync: channelMod?.setNotificationChannelAsync,
    };

    if (typeof cachedNotifications.setNotificationHandler === 'function') {
      cachedNotifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch {
    cachedNotifications = null;
  }

  return cachedNotifications;
}

export interface PushNotificationPayload {
  toTokens?: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  triggerLocalBanner?: boolean;
}

/**
 * Safely subscribes to foreground notification events using local notification submodules.
 */
export function subscribeToNativeNotifications(handlers: {
  onReceived?: (content: {
    title?: string | null;
    body?: string | null;
    data?: Record<string, any>;
  }) => void;
  onResponseRole?: (targetRole: string) => void;
}): () => void {
  const api = getLocalNotificationsApi();
  if (!api) {
    return () => {};
  }

  let receivedSub: any = null;
  let responseSub: any = null;

  try {
    if (
      handlers.onReceived &&
      typeof api.addNotificationReceivedListener === 'function'
    ) {
      receivedSub = api.addNotificationReceivedListener((event: any) => {
        const content = event?.request?.content || {};
        handlers.onReceived?.({
          title: content.title,
          body: content.body,
          data: content.data,
        });
      });
    }

    if (
      handlers.onResponseRole &&
      typeof api.addNotificationResponseReceivedListener === 'function'
    ) {
      responseSub = api.addNotificationResponseReceivedListener(
        (response: any) => {
          const data = response?.notification?.request?.content?.data;
          if (data?.targetRole) {
            handlers.onResponseRole?.(String(data.targetRole));
          }
        }
      );
    }
  } catch {
    // Ignore if unsupported
  }

  return () => {
    try {
      receivedSub?.remove?.();
      responseSub?.remove?.();
    } catch {
      // Ignore cleanup errors
    }
  };
}

/**
 * 1. Requests permission, configures Android High-Importance channel,
 *    retrieves Expo Push Token (or generates an Expo Go compatible token),
 *    and persists it in `public.users.push_token`.
 */
export async function registerAndSavePushTokenAsync(
  userId?: string
): Promise<string> {
  let token = '';
  const api = getLocalNotificationsApi();
  const inExpoGo = isRunningInExpoGo();

  if (api) {
    try {
      if (Platform.OS === 'android' && api.setNotificationChannelAsync) {
        await api.setNotificationChannelAsync('ittihad-trust-alerts', {
          name: 'إشعارات اتحاد الملاك الفورية',
          importance: 5, // AndroidImportance.MAX
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10B981',
          sound: 'default',
        });
      }

      if (api.getPermissionsAsync && api.requestPermissionsAsync) {
        const { status: existingStatus } = await api.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await api.requestPermissionsAsync();
          finalStatus = status;
        }

        // Only call getExpoPushTokenAsync in standalone/dev builds (not Expo Go on Android)
        if (finalStatus === 'granted' && Device.isDevice && !inExpoGo) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const tokenMod = require('expo-notifications/build/getExpoPushTokenAsync');
            if (tokenMod?.getExpoPushTokenAsync) {
              const tokenResponse = await tokenMod.getExpoPushTokenAsync();
              token = tokenResponse.data;
            }
          } catch {
            // Fallback token
          }
        }
      }
    } catch {
      // Fallback token
    }
  }

  if (!token) {
    const suffix = (userId || 'usr-admin-1').slice(-6).toUpperCase();
    token = `ExponentPushToken[ittihad-device-${suffix}]`;
  }

  // Persist push_token in public.users table when connected to Supabase
  if (token && isSupabaseConfigured) {
    try {
      await secureRpc.saveUserPushToken(token);
    } catch {
      // Ignore if user is not authenticated yet
    }
  }

  return token;
}

/**
 * 2. Sends Push Notification via Expo Push Service (for remote devices)
 *    AND schedules an immediate local native OS notification banner on the phone.
 */
export async function dispatchPushNotification(
  payload: PushNotificationPayload
): Promise<void> {
  const {
    toTokens = [],
    title,
    body,
    data = {},
    triggerLocalBanner = true,
  } = payload;

  const api = getLocalNotificationsApi();

  // A. Trigger native OS notification banner on current device (works in Expo Go!)
  if (triggerLocalBanner && api?.scheduleNotificationAsync) {
    try {
      await api.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: null,
      });
    } catch {
      // Fallback if local notification permission was denied
    }
  }

  // B. Send to remote Expo Push API for valid real ExponentPushTokens
  const validRemoteTokens = toTokens.filter(
    (t) =>
      Boolean(t) &&
      t.startsWith('ExponentPushToken[') &&
      !t.includes('ittihad-device-') &&
      !t.includes('ittihad-sim-') &&
      !t.includes('ittihad-expogo-')
  );

  if (validRemoteTokens.length > 0) {
    try {
      const messages = validRemoteTokens.map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        channelId: 'ittihad-trust-alerts',
      }));

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
    } catch {
      // Ignore network errors during remote push dispatch
    }
  }
}
