/* ============================================================
   SENTINEL — Login Page
   ============================================================ */

import { login } from '../services/auth.js';
import router from '../utils/router.js';
import { showToast } from '../utils/helpers.js';

/**
 * Render the login page with animated glassmorphic card,
 * email/password form, validation, and auth integration.
 */
export function renderLoginPage(container) {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-container">
        <div class="auth-card glass-card animate-slide-up">

          <!-- Brand -->
          <div class="auth-brand">
            <div class="auth-brand-icon">
              <i data-lucide="shield"></i>
            </div>
            <h1 class="auth-brand-name">Sentinel</h1>
            <p class="auth-brand-tagline">Digital Well-Being Monitor</p>
          </div>

          <!-- Tabs -->
          <div class="auth-tabs">
            <button class="auth-tab active" id="tab-login">Login</button>
            <button class="auth-tab" id="tab-register">Register</button>
          </div>

          <!-- Error Message -->
          <div class="auth-message auth-message-error" id="login-error" style="display:none;">
            <i data-lucide="alert-circle"></i>
            <span id="login-error-text"></span>
          </div>

          <!-- Login Form -->
          <form class="auth-form" id="login-form" autocomplete="on">
            <div class="form-group">
              <label class="form-label" for="login-email">
                <i data-lucide="mail"></i>
                Email
              </label>
              <input
                class="input"
                type="email"
                id="login-email"
                name="email"
                placeholder="you@example.com"
                autocomplete="email"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="login-password">
                <i data-lucide="lock"></i>
                Password
              </label>
              <input
                class="input"
                type="password"
                id="login-password"
                name="password"
                placeholder="Enter your password"
                autocomplete="current-password"
                required
              />
            </div>

            <button type="submit" class="btn btn-primary auth-submit" id="login-btn">
              Sign In
            </button>
          </form>

          <!-- Footer -->
          <div class="auth-footer">
            Don't have an account?
            <button type="button" id="goto-register">Sign up</button>
          </div>

          <!-- Demo Credentials -->
          <div style="text-align:center; margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--glass-border);">
            <p style="font-size: var(--font-xs); color: var(--text-muted); margin-bottom: var(--space-1);">
              Demo credentials
            </p>
            <p style="font-size: var(--font-xs); color: var(--text-tertiary); font-family: 'Courier New', monospace;">
              parent@sentinel.app &nbsp;/&nbsp; password123
            </p>
          </div>

        </div>
      </div>
    </div>
  `;

  // Render Lucide icons
  if (window.lucide) {
    window.lucide.createIcons({ nodes: [container] });
  }

  // ---- Elements ----
  const form       = container.querySelector('#login-form');
  const emailInput = container.querySelector('#login-email');
  const passInput  = container.querySelector('#login-password');
  const submitBtn  = container.querySelector('#login-btn');
  const errorDiv   = container.querySelector('#login-error');
  const errorText  = container.querySelector('#login-error-text');

  // ---- Tab navigation ----
  container.querySelector('#tab-register')?.addEventListener('click', () => {
    router.navigate('/register');
  });

  container.querySelector('#goto-register')?.addEventListener('click', () => {
    router.navigate('/register');
  });

  // ---- Helpers ----
  function showError(msg) {
    errorText.textContent = msg;
    errorDiv.style.display = 'flex';
    // Re-render the error icon
    if (window.lucide) window.lucide.createIcons({ nodes: [errorDiv] });
  }

  function hideError() {
    errorDiv.style.display = 'none';
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading
      ? '<span class="btn-spinner"></span> Signing in\u2026'
      : 'Sign In';
  }

  // ---- Form submission ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email    = emailInput.value.trim();
    const password = passInput.value;

    // Client-side validation
    if (!email || !password) {
      showError('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      const result = await login(email, password);

      if (result.error) {
        showError(result.error);
        setLoading(false);
        return;
      }

      // Success — show welcome toast and navigate
      const userName = result.user?.name || 'there';
      showToast(`👋 Welcome back, ${userName}!`, 'success', 4000);
      router.navigate('/dashboard');
    } catch (err) {
      showError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  });

  // Clear error on input change
  emailInput.addEventListener('input', hideError);
  passInput.addEventListener('input', hideError);
}
