/* ============================================================
   SENTINEL — Auth State Management
   ============================================================ */

import { api } from './api.js';
import router from '../utils/router.js';

// In-memory token
let _token = localStorage.getItem('sentinel_token') || null;
let _user = null;
let _listeners = [];

/**
 * Get the current token
 */
export function getToken() {
  return _token;
}

/**
 * Check if user is authenticated (token exists)
 */
export function isAuthenticated() {
  return !!_token;
}

/**
 * Store the token
 */
function setToken(token) {
  _token = token;
  if (token) {
    localStorage.setItem('sentinel_token', token);
  } else {
    localStorage.removeItem('sentinel_token');
  }
  _notifyListeners();
}

/**
 * Login with email and password
 */
export async function login(email, password) {
  const result = await api.post('/api/auth/login', { email, password });

  if (result.error) {
    return { error: result.error };
  }

  setToken(result.token);
  _user = result.user || null;
  return { user: _user, token: result.token };
}

/**
 * Register a new account
 */
export async function register(data) {
  const result = await api.post('/api/auth/register', data);

  if (result.error) {
    return { error: result.error };
  }

  setToken(result.token);
  _user = result.user || null;
  return { user: _user, token: result.token, linkCode: result.linkCode };
}

/**
 * Logout — clear token, navigate to login
 */
export function logout() {
  _token = null;
  _user = null;
  localStorage.removeItem('sentinel_token');
  _notifyListeners();
  router.navigate('/login');
}

/**
 * Get current user info from API
 */
export async function getUser() {
  if (!_token) return null;

  if (_user) return _user;

  const result = await api.get('/api/auth/me');
  if (result.error) {
    // Token might be invalid
    if (result.error.includes('expired') || result.error.includes('401')) {
      logout();
    }
    return null;
  }

  _user = result.user || result;
  return _user;
}

/**
 * Get cached user (no API call)
 */
export function getCachedUser() {
  return _user;
}

/**
 * Set user (for when we get user data from other calls)
 */
export function setCachedUser(user) {
  _user = user;
}

/**
 * Register a listener for auth state changes
 */
export function onAuthChange(callback) {
  _listeners.push(callback);
  return () => {
    _listeners = _listeners.filter(cb => cb !== callback);
  };
}

/**
 * Notify all listeners
 */
function _notifyListeners() {
  const authenticated = isAuthenticated();
  _listeners.forEach(cb => {
    try {
      cb(authenticated, _user);
    } catch (e) {
      console.error('Auth listener error:', e);
    }
  });
}
