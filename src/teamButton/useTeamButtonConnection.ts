import { useCallback, useEffect, useRef, useState } from 'react';
import { TEAM_BUTTON_WS_PORT } from './protocol';
import type { ClientMessage, Role, ServerMessage } from './protocol';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

type SendFn = (message: ClientMessage) => void;

export type TeamButtonConnection = {
  status: ConnectionStatus;
  send: SendFn;
  lastMessage: ServerMessage | null;
};

function wsUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const override = params.get('ws');
  if (override) return override;
  const port = params.get('wsPort') ?? String(TEAM_BUTTON_WS_PORT);
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.hostname}:${port}`;
}

/**
 * Low-level Team Buttons connection. Owns the WebSocket lifecycle (connect,
 * auto-reconnect with capped backoff, cleanup) and routes messages. The socket
 * is created exactly once per mount; role hooks drive their own protocol via
 * `onOpen`/`onMessage`.
 */
export function useTeamButtonConnection(options: {
  role: Role;
  onOpen: (send: SendFn) => void;
  onMessage: (message: ServerMessage, send: SendFn) => void;
}): TeamButtonConnection {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const onOpenRef = useRef(options.onOpen);
  const onMessageRef = useRef(options.onMessage);

  // Keep the latest handlers available to the long-lived socket without
  // re-creating the socket (or writing refs during render).
  useEffect(() => {
    onOpenRef.current = options.onOpen;
    onMessageRef.current = options.onMessage;
  }, [options.onOpen, options.onMessage]);

  useEffect(() => {
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const send = (message: ClientMessage) => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    const connect = () => {
      if (disposed) return;
      setStatus((previous) => (previous === 'open' ? 'reconnecting' : 'connecting'));
      const socket = new WebSocket(wsUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) {
          socket.close();
          return;
        }
        attempts = 0;
        setStatus('open');
        // The teacher host sends an optional `host` query value as an
        // accidental host-role takeover guard (NOT authentication). Team
        // clients never send it.
        const hello: ClientMessage =
          options.role === 'host'
            ? {
                type: 'hello',
                role: options.role,
                hostKey:
                  new URLSearchParams(window.location.search).get('host') ??
                  undefined,
              }
            : { type: 'hello', role: options.role };
        socket.send(JSON.stringify(hello));
        onOpenRef.current(send);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as ServerMessage;
          setLastMessage(message);
          onMessageRef.current(message, send);
        } catch {
          // ignore malformed server frames
        }
      };

      socket.onclose = () => {
        if (disposed) return;
        setStatus('reconnecting');
        attempts += 1;
        retry = setTimeout(connect, Math.min(500 * 2 ** attempts, 5000));
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      const socket = socketRef.current;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback<SendFn>((message) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  return { status, send, lastMessage };
}
