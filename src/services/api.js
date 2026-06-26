/* ============================================================
   SENTINEL — HTTP API Client
   ============================================================ */

import { getToken } from './auth.js';
import router from '../utils/router.js';

/**
 * Build headers with optional Authorization
 */
function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Handle response: parse JSON, handle errors
 */
async function handleResponse(response) {
  // Handle 401 — redirect to login
  if (response.status === 401) {
    // Clear token and redirect
    localStorage.removeItem('sentinel_token');
    router.navigate('/login');
    return { error: 'Session expired. Please log in again.' };
  }

  // Try to parse JSON
  let data;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      return { error: `Request failed with status ${response.status}` };
    }
    return {};
  }

  if (!response.ok) {
    return { error: data.error || data.message || `Request failed with status ${response.status}` };
  }

  return data;
}

/**
 * API client with get, post, put, delete methods.
 * Base URL is same-origin (Vite proxies /api).
 */
export const api = {
  async get(url) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: buildHeaders()
      });
      return handleResponse(response);
    } catch (err) {
      console.error('API GET error:', err);
      return { error: 'Network error. Please check your connection.' };
    }
  },

  async post(url, data) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(),
        body: data ? JSON.stringify(data) : undefined
      });
      return handleResponse(response);
    } catch (err) {
      console.error('API POST error:', err);
      return { error: 'Network error. Please check your connection.' };
    }
  },

  async put(url, data) {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: buildHeaders(),
        body: data ? JSON.stringify(data) : undefined
      });
      return handleResponse(response);
    } catch (err) {
      console.error('API PUT error:', err);
      return { error: 'Network error. Please check your connection.' };
    }
  },

  async delete(url) {
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: buildHeaders()
      });
      return handleResponse(response);
    } catch (err) {
      console.error('API DELETE error:', err);
      return { error: 'Network error. Please check your connection.' };
    }
  }
};

export default api;
