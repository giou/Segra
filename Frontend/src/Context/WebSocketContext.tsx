import { createContext, useContext, ReactNode, useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { sendMessageToBackend } from '../Utils/MessageUtils';
import { useAuth } from '../Hooks/useAuth.tsx';

interface WebSocketContextType {
  sendMessage: (message: string) => void;
  isConnected: boolean;
  connectionState: ReadyState;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketMessage {
  method: string;
  content: any;
}

// The initial sync is a single fire-and-forget NewConnection. If that exchange is lost
// (native bridge not ready yet on a cold start, backend busy, socket flap while gaming)
// nothing re-asks and the UI stays stale until a manual refresh. So the connect-time
// full sync is retried until the authoritative State push actually arrives.
const SYNC_RETRY_DELAYS_MS = [2000, 5000];
// Returning to the app re-asks for the (cheap) State push so a recording that started
// while the window was backgrounded shows up without a manual refresh.
const FOCUS_RESYNC_DEBOUNCE_MS = 5000;

export function WebSocketProvider({ children }: { children: ReactNode }) {
  // Get the auth session to properly handle authentication
  const { session } = useAuth();
  // Ref to track if this is a reconnection (not initial connection)
  const hasConnectedBefore = useRef(false);
  // Set when a State push arrives; cleared on every (re)connect until the next push.
  const stateReceivedRef = useRef(false);
  const readyStateRef = useRef<ReadyState>(ReadyState.CLOSED);
  const lastResyncRequestRef = useRef(0);
  const retryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Log when the WebSocket provider mounts or session changes
  useEffect(() => {
    console.log('WebSocketProvider: Session state changed:', !!session);
  }, [session]);

  const clearSyncRetries = () => {
    retryTimersRef.current.forEach(clearTimeout);
    retryTimersRef.current = [];
  };

  const requestFullSync = useCallback(() => {
    sendMessageToBackend('NewConnection');
  }, []);

  // Schedule re-asks of the full sync until the backend's State push arrives.
  const scheduleSyncRetries = useCallback(() => {
    clearSyncRetries();
    for (const delay of SYNC_RETRY_DELAYS_MS) {
      retryTimersRef.current.push(
        setTimeout(() => {
          if (!stateReceivedRef.current && readyStateRef.current === ReadyState.OPEN) {
            console.log('WebSocket: no State received yet, re-requesting sync');
            requestFullSync();
          }
        }, delay),
      );
    }
  }, [requestFullSync]);

  useEffect(() => clearSyncRetries, []);

  // Track State arrivals so the retry loop above knows when the sync landed.
  useEffect(() => {
    const handleStateMessage = (event: CustomEvent<WebSocketMessage>) => {
      if (event.detail?.method === 'State') {
        stateReceivedRef.current = true;
      }
    };

    window.addEventListener('websocket-message', handleStateMessage as EventListener);
    return () => {
      window.removeEventListener('websocket-message', handleStateMessage as EventListener);
    };
  }, []);

  // Re-ask for state when returning to the app (cheap RequestState, not a full
  // NewConnection), debounced so focus flapping doesn't spam the backend.
  useEffect(() => {
    const resync = () => {
      if (readyStateRef.current !== ReadyState.OPEN) return;
      const now = Date.now();
      if (now - lastResyncRequestRef.current < FOCUS_RESYNC_DEBOUNCE_MS) return;
      lastResyncRequestRef.current = now;
      sendMessageToBackend('RequestState');
    };

    const handleFocus = () => resync();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') resync();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Configure WebSocket with reconnection and heartbeat
  const { readyState } = useWebSocket('ws://localhost:44030/', {
    onOpen: () => {
      // Check if this is a reconnection
      if (hasConnectedBefore.current) {
        console.log('WebSocket reconnected after disconnect - resyncing state');
      } else {
        console.log('WebSocket connected for the first time');
        hasConnectedBefore.current = true;
      }

      stateReceivedRef.current = false;
      requestFullSync();
      scheduleSyncRetries();

      // If we already have a session when connecting, ensure we're logged in
      if (session) {
        console.log('WebSocket connected with active session, ensuring login state');
        sendMessageToBackend('Login', {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        });
      }
    },
    onClose: (event) => {
      console.warn('WebSocket closed:', event.code, event.reason);
    },
    onError: (event) => {
      console.error('WebSocket error:', event);
    },
    onMessage: (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        if (data.method !== 'RecordingPreviewFrame') {
          console.log('WebSocket message received:', data);
        }

        // Dispatch the message to all listeners
        window.dispatchEvent(
          new CustomEvent('websocket-message', {
            detail: data,
          }),
        );
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    },
    shouldReconnect: () => {
      console.log('WebSocket closed, will attempt to reconnect');
      return true;
    },
    reconnectAttempts: Infinity,
    reconnectInterval: 3000,
    // The heartbeat closes the socket if no message arrives within `timeout`, and otherwise
    // sends `message` every `interval`. Both run off a single setInterval. While the Segra
    // window is backgrounded during gameplay, Chromium/WebView2 throttles timers to fire at
    // most about once every 60 seconds. `interval` must stay below that floor so each throttled
    // tick still emits a ping (which the backend answers, resetting the timeout), and `timeout`
    // must stay well above it so one slow tick can't trip the close.
    heartbeat: {
      message: 'ping',
      timeout: 120000,
      interval: 30000,
    },
  });

  const contextValue = {
    sendMessage: useCallback((message: string) => {
      sendMessageToBackend(message);
    }, []),
    isConnected: readyState === ReadyState.OPEN,
    connectionState: readyState,
  };

  // Mirror the connection state for the timer/focus handlers above.
  useEffect(() => {
    readyStateRef.current = readyState;
    if (readyState !== ReadyState.OPEN) {
      clearSyncRetries();
    }
  }, [readyState]);

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}
