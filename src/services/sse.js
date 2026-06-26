/* ============================================================
   SENTINEL — SSE (Server-Sent Events) Client
   ============================================================ */

let _eventSource = null;
let _handlers = {};
let _reconnectAttempts = 0;
let _reconnectTimer = null;
let _connected = false;

const MAX_RECONNECT_DELAY = 30000; // 30s max
const BASE_RECONNECT_DELAY = 1000; // 1s base

/**
 * Connect to the SSE stream.
 * Since native EventSource doesn't support custom headers,
 * we pass the token as a query parameter.
 */
export function connectSSE(token) {
  if (_eventSource) {
    disconnectSSE();
  }

  if (!token) {
    console.warn('SSE: No token provided, skipping connection');
    return;
  }

  try {
    const url = `/api/stream?token=${encodeURIComponent(token)}`;
    _eventSource = new EventSource(url);

    _eventSource.onopen = () => {
      console.log('SSE: Connected');
      _connected = true;
      _reconnectAttempts = 0;
    };

    _eventSource.onerror = (err) => {
      console.warn('SSE: Connection error', err);
      _connected = false;

      if (_eventSource) {
        _eventSource.close();
        _eventSource = null;
      }

      _scheduleReconnect(token);
    };

    // Listen for specific event types
    const eventTypes = ['usage_update', 'alert', 'session_start', 'session_end'];

    eventTypes.forEach(eventType => {
      _eventSource.addEventListener(eventType, (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          data = event.data;
        }

        // Call registered handlers
        if (_handlers[eventType]) {
          _handlers[eventType].forEach(callback => {
            try {
              callback(data);
            } catch (e) {
              console.error(`SSE handler error for ${eventType}:`, e);
            }
          });
        }
      });
    });

    // Also listen on the generic message event
    _eventSource.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        data = event.data;
      }

      if (_handlers['message']) {
        _handlers['message'].forEach(cb => {
          try { cb(data); } catch (e) { console.error('SSE message handler error:', e); }
        });
      }
    };

  } catch (err) {
    console.error('SSE: Failed to connect', err);
    _scheduleReconnect(token);
  }
}

/**
 * Register an event handler
 * @param {string} eventName - 'usage_update' | 'alert' | 'session_start' | 'session_end' | 'message'
 * @param {Function} callback - Handler function receiving the parsed data
 * @returns {Function} Unsubscribe function
 */
export function onSSEEvent(eventName, callback) {
  if (!_handlers[eventName]) {
    _handlers[eventName] = [];
  }
  _handlers[eventName].push(callback);

  // Return unsubscribe function
  return () => {
    _handlers[eventName] = _handlers[eventName].filter(cb => cb !== callback);
  };
}

/**
 * Disconnect from SSE
 */
export function disconnectSSE() {
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }

  if (_eventSource) {
    _eventSource.close();
    _eventSource = null;
  }

  _connected = false;
  _reconnectAttempts = 0;
  console.log('SSE: Disconnected');
}

/**
 * Check if SSE is connected
 */
export function isSSEConnected() {
  return _connected;
}

/**
 * Clear all handlers
 */
export function clearSSEHandlers() {
  _handlers = {};
}

/**
 * Schedule a reconnection with exponential backoff
 */
function _scheduleReconnect(token) {
  if (_reconnectTimer) return;

  _reconnectAttempts++;
  const delay = Math.min(
    BASE_RECONNECT_DELAY * Math.pow(2, _reconnectAttempts - 1),
    MAX_RECONNECT_DELAY
  );

  console.log(`SSE: Reconnecting in ${delay}ms (attempt ${_reconnectAttempts})`);

  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    connectSSE(token);
  }, delay);
}
