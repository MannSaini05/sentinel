import { getDb } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { Router } from 'express';

/**
 * Map of active SSE client connections.
 * Key: userId (string), Value: Set of response objects
 * Using a Set allows multiple tabs/connections per user.
 */
const clients = new Map();

/**
 * Adds an SSE client connection for a given user.
 * @param {string} userId
 * @param {import('express').Response} res
 */
export function addClient(userId, res) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);
  console.log(`[SSE] Client connected: ${userId} (total connections: ${clients.get(userId).size})`);
}

/**
 * Removes an SSE client connection for a given user.
 * @param {string} userId
 * @param {import('express').Response} res
 */
export function removeClient(userId, res) {
  if (clients.has(userId)) {
    clients.get(userId).delete(res);
    if (clients.get(userId).size === 0) {
      clients.delete(userId);
    }
    console.log(`[SSE] Client disconnected: ${userId}`);
  }
}

/**
 * Sends an SSE event to a specific user (all their connections).
 * @param {string} userId
 * @param {string} event - Event name
 * @param {*} data - Data to serialize as JSON
 */
export function sendToUser(userId, event, data) {
  if (!clients.has(userId)) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const res of clients.get(userId)) {
    try {
      res.write(payload);
    } catch (err) {
      console.error(`[SSE] Error writing to client ${userId}:`, err.message);
      removeClient(userId, res);
    }
  }
}

/**
 * Broadcasts an SSE event to all parents linked to a specific child.
 * @param {string} childId
 * @param {string} event - Event name
 * @param {*} data - Data to serialize as JSON
 */
export function broadcastToParentsOf(childId, event, data) {
  const db = getDb();
  const links = db.prepare(
    'SELECT parent_id FROM parent_child_links WHERE child_id = ?'
  ).all(childId);

  for (const link of links) {
    sendToUser(link.parent_id, event, data);
  }
}

/**
 * Returns the count of active SSE connections.
 */
export function getClientCount() {
  let count = 0;
  for (const connections of clients.values()) {
    count += connections.size;
  }
  return count;
}

/**
 * Sends an SSE event to a specific parent (by parent user ID).
 * @param {string} parentId
 * @param {string} event - Event name
 * @param {*} data - Data to serialize as JSON
 */
export function broadcastToParent(parentId, event, data) {
  sendToUser(parentId, event, data);
}

/**
 * Express route handler for SSE stream endpoint.
 * GET /api/stream
 */
const router = Router();

router.get('/', authenticate, (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering if applicable
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'SSE connection established', userId: req.user.id })}\n\n`);

  // Add client to the connections map
  addClient(req.user.id, res);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`:heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(req.user.id, res);
  });
});

export { router as streamRouter };
export default router;
