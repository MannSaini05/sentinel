/* ============================================================
   SENTINEL — Landing Page
   Beautiful welcome page with hero, features, and CTA
   ============================================================ */

import router from '../utils/router.js';

export default function renderLanding(container) {
  container.innerHTML = `
    <div class="landing-page">

      <!-- Background Elements -->
      <div class="landing-grid-bg"></div>

      <!-- Fixed Navigation -->
      <nav class="landing-nav">
        <a class="landing-nav-logo" href="#">
          <div class="landing-nav-logo-icon">🛡️</div>
          Sentinel
        </a>
        <div class="landing-nav-actions">
          <button class="landing-btn-secondary" id="nav-login-btn" style="padding:10px 24px;font-size:var(--font-sm);">
            Sign In
          </button>
          <button class="landing-btn-primary" id="nav-register-btn" style="padding:10px 24px;font-size:var(--font-sm);box-shadow:none;">
            Get Started
          </button>
        </div>
      </nav>

      <!-- ═══════════ HERO SECTION ═══════════ -->
      <section class="landing-hero">
        <div class="landing-orb landing-orb-1"></div>
        <div class="landing-orb landing-orb-2"></div>
        <div class="landing-orb landing-orb-3"></div>

        <div class="landing-hero-content">
          <div class="landing-badge">
            <span class="live-dot" style="background:#10b981;"></span>
            Real-Time Monitoring
          </div>

          <h1>
            Your Child's <span class="gradient-text">Digital Safety</span>,<br>
            In Your Hands
          </h1>

          <p class="landing-hero-subtitle">
            Monitor screen time, track app usage, and set healthy digital boundaries — 
            all in real-time from any device. Keep your family safe in the digital age.
          </p>

          <div class="landing-hero-actions">
            <button class="landing-btn-primary" id="hero-register-btn">
              <i data-lucide="shield" style="width:20px;height:20px;"></i>
              Start Protecting — Free
            </button>
            <button class="landing-btn-secondary" id="hero-login-btn">
              <i data-lucide="log-in" style="width:18px;height:18px;"></i>
              Sign In
            </button>
          </div>

          <!-- Stats -->
          <div class="landing-stats">
            <div class="landing-stat">
              <div class="landing-stat-value">🟢</div>
              <div class="landing-stat-label">Live Status</div>
            </div>
            <div class="landing-stat">
              <div class="landing-stat-value">60s</div>
              <div class="landing-stat-label">Update Interval</div>
            </div>
            <div class="landing-stat">
              <div class="landing-stat-value">📧</div>
              <div class="landing-stat-label">Email Alerts</div>
            </div>
            <div class="landing-stat">
              <div class="landing-stat-value">PWA</div>
              <div class="landing-stat-label">Works Offline</div>
            </div>
          </div>
        </div>

        <div class="landing-scroll-indicator">
          <span>Discover more</span>
          <i data-lucide="chevrons-down" style="width:20px;height:20px;"></i>
        </div>
      </section>

      <!-- ═══════════ FEATURES SECTION ═══════════ -->
      <section class="landing-features">
        <p class="landing-section-label">Features</p>
        <h2 class="landing-section-title">Everything You Need to Stay Informed</h2>
        <p class="landing-section-desc">
          Sentinel gives parents complete visibility into their child's digital activity — no guesswork required.
        </p>

        <div class="landing-features-grid">
          <!-- Feature 1 -->
          <div class="landing-feature-card" style="--feature-color:#06b6d4;">
            <div class="landing-feature-icon" style="background:rgba(6,182,212,0.12);">
              📊
            </div>
            <h3>Real-Time Dashboard</h3>
            <p>Watch your child's screen time as it happens. See which apps they're using, how long they've been online, and get live 🟢 / 🔴 status indicators.</p>
          </div>

          <!-- Feature 2 -->
          <div class="landing-feature-card" style="--feature-color:#8b5cf6;">
            <div class="landing-feature-icon" style="background:rgba(139,92,246,0.12);">
              🔔
            </div>
            <h3>Smart Alerts</h3>
            <p>Receive instant email notifications when your child exceeds screen time limits or goes offline unexpectedly. Stay informed without hovering.</p>
          </div>

          <!-- Feature 3 -->
          <div class="landing-feature-card" style="--feature-color:#10b981;">
            <div class="landing-feature-icon" style="background:rgba(16,185,129,0.12);">
              📈
            </div>
            <h3>Detailed Analytics</h3>
            <p>Weekly reports, daily trends, app-category breakdowns, and usage heatmaps. Understand patterns and make informed decisions about screen time.</p>
          </div>

          <!-- Feature 4 -->
          <div class="landing-feature-card" style="--feature-color:#f59e0b;">
            <div class="landing-feature-icon" style="background:rgba(245,158,11,0.12);">
              ⏱️
            </div>
            <h3>Screen Time Limits</h3>
            <p>Set daily limits for each child. Get warned at 80%, alerted at 100%, and notified for overuse — automatic, hands-free management.</p>
          </div>

          <!-- Feature 5 -->
          <div class="landing-feature-card" style="--feature-color:#ec4899;">
            <div class="landing-feature-icon" style="background:rgba(236,72,153,0.12);">
              ✅
            </div>
            <h3>Trust Score</h3>
            <p>Verified tracking vs self-reported data builds a trust score. See how transparent your child is about their digital habits.</p>
          </div>

          <!-- Feature 6 -->
          <div class="landing-feature-card" style="--feature-color:#14b8a6;">
            <div class="landing-feature-icon" style="background:rgba(20,184,166,0.12);">
              📱
            </div>
            <h3>Install as App (PWA)</h3>
            <p>Your child installs Sentinel as a home screen app. It runs in the background, sending heartbeats every 60 seconds — even when minimized.</p>
          </div>
        </div>
      </section>

      <!-- ═══════════ HOW IT WORKS ═══════════ -->
      <section class="landing-steps">
        <div class="landing-steps-inner">
          <p class="landing-section-label">How It Works</p>
          <h2 class="landing-section-title">Up and Running in 3 Steps</h2>

          <div class="landing-steps-grid">
            <div class="landing-step">
              <div class="landing-step-number">1</div>
              <h3>Parent Registers</h3>
              <p>Create a free parent account. It takes 30 seconds.</p>
            </div>
            <div class="landing-step">
              <div class="landing-step-number">2</div>
              <h3>Child Installs</h3>
              <p>Your child registers, generates a link code, and installs the PWA app.</p>
            </div>
            <div class="landing-step">
              <div class="landing-step-number">3</div>
              <h3>Start Monitoring</h3>
              <p>Enter the code to link accounts. Monitoring starts instantly — real-time.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════ CTA SECTION ═══════════ -->
      <section class="landing-cta">
        <div class="landing-cta-box">
          <h2>Ready to <span class="gradient-text">Protect</span> Your Family?</h2>
          <p>Join Sentinel today. Free, no credit card needed. Start monitoring your child's digital well-being in under a minute.</p>
          <button class="landing-btn-primary" id="cta-register-btn" style="font-size:var(--font-lg);padding:16px 40px;">
            <i data-lucide="rocket" style="width:20px;height:20px;"></i>
            Create Free Account
          </button>
        </div>
      </section>

      <!-- ═══════════ FOOTER ═══════════ -->
      <footer class="landing-footer">
        <p>🛡️ Sentinel — Digital Well-Being Monitor &nbsp;•&nbsp; Built for families &nbsp;•&nbsp; © ${new Date().getFullYear()}</p>
      </footer>

    </div>
  `;

  // Initialize Lucide icons
  if (window.lucide) window.lucide.createIcons({ nodes: [container] });

  // ── Navigation ──────────────────────────────────────────
  const goLogin = () => router.navigate('/login');
  const goRegister = () => router.navigate('/register');

  container.querySelector('#nav-login-btn')?.addEventListener('click', goLogin);
  container.querySelector('#nav-register-btn')?.addEventListener('click', goRegister);
  container.querySelector('#hero-register-btn')?.addEventListener('click', goRegister);
  container.querySelector('#hero-login-btn')?.addEventListener('click', goLogin);
  container.querySelector('#cta-register-btn')?.addEventListener('click', goRegister);

  // ── Intersection Observer for fade-in animations ────────
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'fadeInUp 0.6s ease both';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  container.querySelectorAll('.landing-feature-card, .landing-step, .landing-cta-box').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
}
