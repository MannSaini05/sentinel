/* ============================================================
   SENTINEL — Register Page
   ============================================================ */

import { register } from '../services/auth.js';
import router from '../utils/router.js';
import { showToast } from '../utils/helpers.js';
import { showAlertBanner } from '../components/alertBanner.js';

/**
 * Render the registration page with role selector, form validation,
 * and animated glassmorphic card.
 */
export function renderRegisterPage(container) {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-container" style="max-width: 480px;">
        <div class="auth-card glass-card animate-slide-up">

          <!-- Brand -->
          <div class="auth-brand">
            <div class="auth-brand-icon">
              <i data-lucide="shield"></i>
            </div>
            <h1 class="auth-brand-name">Create Account</h1>
            <p class="auth-brand-tagline">Join Sentinel and protect your family</p>
          </div>

          <!-- Tabs -->
          <div class="auth-tabs">
            <button class="auth-tab" id="tab-login">Login</button>
            <button class="auth-tab active" id="tab-register">Register</button>
          </div>

          <!-- Error Message -->
          <div class="auth-message auth-message-error" id="register-error" style="display:none;">
            <i data-lucide="alert-circle"></i>
            <span id="register-error-text"></span>
          </div>

          <!-- Success Message (for link code) -->
          <div class="auth-message auth-message-success" id="register-success" style="display:none;">
            <i data-lucide="check-circle"></i>
            <span id="register-success-text"></span>
          </div>

          <!-- Register Form -->
          <form class="auth-form" id="register-form" autocomplete="off">

            <!-- Name -->
            <div class="form-group">
              <label class="form-label" for="reg-name">
                <i data-lucide="user"></i>
                Full Name
              </label>
              <input
                class="input"
                type="text"
                id="reg-name"
                name="name"
                placeholder="Your full name"
                autocomplete="name"
                required
              />
            </div>

            <!-- Email -->
            <div class="form-group">
              <label class="form-label" for="reg-email">
                <i data-lucide="mail"></i>
                Email
              </label>
              <input
                class="input"
                type="email"
                id="reg-email"
                name="email"
                placeholder="you@example.com"
                autocomplete="email"
                required
              />
            </div>

            <!-- Password -->
            <div class="form-group">
              <label class="form-label" for="reg-password">
                <i data-lucide="lock"></i>
                Password
              </label>
              <input
                class="input"
                type="password"
                id="reg-password"
                name="password"
                placeholder="Create a password"
                autocomplete="new-password"
                required
                minlength="6"
              />
            </div>

            <!-- Confirm Password -->
            <div class="form-group">
              <label class="form-label" for="reg-confirm">
                <i data-lucide="lock"></i>
                Confirm Password
              </label>
              <input
                class="input"
                type="password"
                id="reg-confirm"
                name="confirmPassword"
                placeholder="Re-enter your password"
                autocomplete="new-password"
                required
              />
            </div>

            <!-- Role Selector -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="users"></i>
                I am a\u2026
              </label>
              <div class="role-selector">
                <label class="role-option">
                  <input type="radio" name="role" value="parent" checked />
                  <div class="role-card">
                    <div class="role-icon">
                      <i data-lucide="shield"></i>
                    </div>
                    <span class="role-label">I'm a Parent</span>
                  </div>
                </label>
                <label class="role-option">
                  <input type="radio" name="role" value="child" />
                  <div class="role-card">
                    <div class="role-icon">
                      <i data-lucide="user"></i>
                    </div>
                    <span class="role-label">I'm a Child</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Phone (parent-only) -->
            <div class="form-group" id="phone-group">
              <label class="form-label" for="reg-phone">
                <i data-lucide="phone"></i>
                Phone <span style="color: var(--text-muted); font-weight: var(--weight-regular); text-transform: none; letter-spacing: 0;">(optional)</span>
              </label>
              <input
                class="input"
                type="tel"
                id="reg-phone"
                name="phone"
                placeholder="+1 (555) 123-4567"
                autocomplete="tel"
              />
            </div>

            <button type="submit" class="btn btn-primary auth-submit" id="register-btn">
              Create Account
            </button>
          </form>

          <!-- Footer -->
          <div class="auth-footer">
            Already have an account?
            <button type="button" id="goto-login">Sign in</button>
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
  const form         = container.querySelector('#register-form');
  const nameInput    = container.querySelector('#reg-name');
  const emailInput   = container.querySelector('#reg-email');
  const passInput    = container.querySelector('#reg-password');
  const confirmInput = container.querySelector('#reg-confirm');
  const phoneInput   = container.querySelector('#reg-phone');
  const phoneGroup   = container.querySelector('#phone-group');
  const submitBtn    = container.querySelector('#register-btn');
  const errorDiv     = container.querySelector('#register-error');
  const errorText    = container.querySelector('#register-error-text');
  const roleRadios   = container.querySelectorAll('input[name="role"]');

  // ---- Tab navigation ----
  container.querySelector('#tab-login')?.addEventListener('click', () => {
    router.navigate('/login');
  });

  container.querySelector('#goto-login')?.addEventListener('click', () => {
    router.navigate('/login');
  });

  // ---- Role toggle (show/hide phone) ----
  function updatePhoneVisibility() {
    const selected = container.querySelector('input[name="role"]:checked')?.value;
    phoneGroup.style.display = selected === 'parent' ? 'flex' : 'none';
  }

  roleRadios.forEach(radio => {
    radio.addEventListener('change', updatePhoneVisibility);
  });
  updatePhoneVisibility();

  // ---- Helpers ----
  function showError(msg) {
    errorText.textContent = msg;
    errorDiv.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons({ nodes: [errorDiv] });
  }

  function hideError() {
    errorDiv.style.display = 'none';
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading
      ? '<span class="btn-spinner"></span> Creating account\u2026'
      : 'Create Account';
  }

  // ---- Form submission ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const name     = nameInput.value.trim();
    const email    = emailInput.value.trim();
    const password = passInput.value;
    const confirm  = confirmInput.value;
    const role     = container.querySelector('input[name="role"]:checked')?.value || 'parent';
    const phone    = phoneInput.value.trim();

    // Client-side validation
    if (!name || !email || !password || !confirm) {
      showError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirm) {
      showError('Passwords do not match.');
      confirmInput.classList.add('input-error');
      return;
    }

    confirmInput.classList.remove('input-error');
    setLoading(true);

    try {
      const payload = { name, email, password, role };
      if (role === 'parent' && phone) {
        payload.phone = phone;
      }

      const result = await register(payload);

      if (result.error) {
        showError(result.error);
        setLoading(false);
        return;
      }

      // Show welcome toast
      showToast(`🎉 Welcome to Sentinel, ${name}!`, 'success', 5000);

      // Show a contextual alert banner after navigating
      setTimeout(() => {
        if (role === 'parent') {
          showAlertBanner({
            type: 'info',
            message: `Welcome aboard, ${name}! Go to Settings → Link Code to connect your child's account.`,
            childName: '🛡️ Getting Started',
            createdAt: new Date().toISOString(),
          });
        } else {
          showAlertBanner({
            type: 'info',
            message: `Hey ${name}! Generate a link code and share it with your parent to connect.`,
            childName: '🔗 Connect with Parent',
            createdAt: new Date().toISOString(),
          });
        }
      }, 500);

      // Navigate to dashboard
      router.navigate('/dashboard');
    } catch (err) {
      showError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  });

  // Clear error on input change
  [nameInput, emailInput, passInput, confirmInput, phoneInput].forEach(input => {
    input.addEventListener('input', hideError);
  });

  confirmInput.addEventListener('input', () => {
    confirmInput.classList.remove('input-error');
  });
}
