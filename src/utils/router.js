/* ============================================================
   SENTINEL — Client-Side SPA Router
   ============================================================ */

class Router {
  constructor() {
    this.routes = [];
    this.currentPath = '';
    this.beforeEach = null;
    this._appContainer = null;
  }

  /**
   * Register a route with a path and handler function.
   * Supports path parameters like /child/:id
   */
  addRoute(path, handler) {
    // Convert path params to regex
    const paramNames = [];
    const regexStr = path.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexStr}$`);

    this.routes.push({ path, regex, paramNames, handler });
  }

  /**
   * Navigate to a given path — pushes state and renders.
   */
  navigate(path, replace = false) {
    if (path === this.currentPath && !replace) return;

    if (replace) {
      window.history.replaceState({ path }, '', path);
    } else {
      window.history.pushState({ path }, '', path);
    }

    this._resolve(path);
  }

  /**
   * Set a guard function called before each route.
   * Guard receives (path) and should return the path to actually navigate to,
   * or null to cancel navigation.
   */
  setBeforeEach(fn) {
    this.beforeEach = fn;
  }

  /**
   * Start the router: listen to popstate events and resolve the initial route.
   */
  start() {
    this._appContainer = document.getElementById('app');

    window.addEventListener('popstate', (e) => {
      const path = e.state?.path || window.location.pathname;
      this._resolve(path);
    });

    // Handle initial load
    const initialPath = window.location.pathname || '/';
    this._resolve(initialPath);
  }

  /**
   * Get the current path.
   */
  getCurrentPath() {
    return this.currentPath;
  }

  /**
   * Internal: resolve a path to a route and render it.
   */
  _resolve(path) {
    // Run guard
    if (this.beforeEach) {
      const redirectPath = this.beforeEach(path);
      if (redirectPath === null) return;
      if (redirectPath && redirectPath !== path) {
        this.navigate(redirectPath, true);
        return;
      }
    }

    this.currentPath = path;

    // Match route
    for (const route of this.routes) {
      const match = path.match(route.regex);
      if (match) {
        // Extract params
        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });

        // Clear container and call handler
        if (this._appContainer) {
          this._appContainer.innerHTML = '';
          route.handler(this._appContainer, params);
        }
        return;
      }
    }

    // No match — render 404
    if (this._appContainer) {
      this._appContainer.innerHTML = `
        <div class="auth-page">
          <div class="auth-container">
            <div class="glass-card p-8 text-center">
              <h1 class="text-4xl font-bold mb-4" style="color: var(--text-primary)">404</h1>
              <p class="text-tertiary mb-6">Page not found</p>
              <button class="btn btn-primary" onclick="window.router.navigate('/dashboard')">
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }
}

// Export singleton
const router = new Router();

// Make accessible globally for onclick handlers
window.router = router;

export default router;
