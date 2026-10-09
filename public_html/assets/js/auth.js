/**
 * DEARLY — Sender Authentication Service
 * Manages Supabase Auth, login sessions, user metadata, password reset,
 * and dynamic navbar authentication state across the website.
 */

class DearlyAuthService {
  constructor() {
    this.user = null;
    this.session = null;
    this.unreadNotificationsCount = 0;
    this.listeners = [];
    this.initialized = false;
    this._initPromise = null;
    this.init();
  }

  init() {
    if (!this._initPromise) {
      this._initPromise = this._performInit();
    }
    return this._initPromise;
  }

  async _performInit() {
    await window.dearlyDB?.ensureReady?.();
    const client = window.dearlyDB?.client;

    if (client) {
      try {
        const { data } = await client.auth.getSession();
        this.session = data?.session || null;
        this.user = data?.session?.user || null;

        if (this.user) {
          this.claimLocalExperiences(this.user.id);
        }

        // Listen to auth state transitions
        client.auth.onAuthStateChange(async (event, session) => {
          this.session = session;
          if (session?.user) {
            this.user = session.user;
          } else if (event === 'SIGNED_OUT') {
            this.user = null;
            localStorage.removeItem('dearly_demo_user');
          } else {
            const savedDemoUser = localStorage.getItem('dearly_demo_user');
            if (savedDemoUser) {
              try { this.user = JSON.parse(savedDemoUser); } catch (e) { this.user = null; }
            } else {
              this.user = null;
            }
          }

          if (this.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
            this.claimLocalExperiences(this.user.id);
          }

          this.notifyListeners(event, session);
          this.updateNavbars();
          if (this.user) {
            this.fetchUnreadCount();
          }
        });

        if (this.user) {
          this.fetchUnreadCount();
          this.setupRealtimeNotifications();
        } else {
          // Local demo user fallback if testing or demo mode
          const savedDemoUser = localStorage.getItem('dearly_demo_user');
          if (savedDemoUser) {
            try {
              this.user = JSON.parse(savedDemoUser);
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn('Auth session check note:', err.message);
      }
    } else {
      // Local demo mode: check localStorage for simulated login session
      const savedDemoUser = localStorage.getItem('dearly_demo_user');
      if (savedDemoUser) {
        try {
          this.user = JSON.parse(savedDemoUser);
        } catch (e) {}
      }
    }

    this.initialized = true;
    this.updateNavbars();
    return this.user;
  }

  onAuthStateChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
      if (this.initialized) {
        callback(this.user ? 'SIGNED_IN' : 'SIGNED_OUT', this.session);
      }
    }
  }

  notifyListeners(event, session) {
    this.listeners.forEach((cb) => {
      try {
        cb(event, session);
      } catch (e) {
        console.error('Auth listener error:', e);
      }
    });
  }

  getUser() {
    if (this.user) return this.user;
    const savedDemoUser = localStorage.getItem('dearly_demo_user');
    if (savedDemoUser) {
      try {
        this.user = JSON.parse(savedDemoUser);
        return this.user;
      } catch (e) {}
    }
    return null;
  }

  getUserName() {
    if (!this.user) return 'Guest';
    return (
      this.user.user_metadata?.display_name ||
      this.user.user_metadata?.full_name ||
      this.user.user_metadata?.name ||
      (this.user.email ? this.user.email.split('@')[0] : 'Sender')
    );
  }

  async signUp({ name, email, password }) {
    await window.dearlyDB?.ensureReady?.();
    const client = window.dearlyDB?.client;

    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanName) throw new Error('Please enter your name.');
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Please enter a valid email address.');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters long.');

    if (client) {
      const { data, error } = await client.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            display_name: cleanName,
            full_name: cleanName
          }
        }
      });

      if (error) {
        throw new Error(this.mapAuthError(error.message));
      }

      this.user = data.user;
      this.session = data.session;
      this.claimLocalExperiences(this.user.id);
      return data;
    } else {
      // Demo fallback
      const demoUser = {
        id: 'demo-user-' + Date.now(),
        email: cleanEmail,
        user_metadata: { display_name: cleanName, full_name: cleanName }
      };
      this.user = demoUser;
      localStorage.setItem('dearly_demo_user', JSON.stringify(demoUser));
      this.updateNavbars();
      return { user: demoUser };
    }
  }

  async signIn({ email, password }) {
    await window.dearlyDB?.ensureReady?.();
    const client = window.dearlyDB?.client;

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) throw new Error('Please enter your email and password.');

    if (client) {
      const { data, error } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });

      if (error) {
        throw new Error(this.mapAuthError(error.message));
      }

      this.user = data.user;
      this.session = data.session;
      this.claimLocalExperiences(this.user.id);
      this.updateNavbars();
      return data;
    } else {
      // Demo fallback
      const demoUser = {
        id: 'demo-user-1',
        email: cleanEmail,
        user_metadata: { display_name: cleanEmail.split('@')[0], full_name: cleanEmail.split('@')[0] }
      };
      this.user = demoUser;
      localStorage.setItem('dearly_demo_user', JSON.stringify(demoUser));
      this.updateNavbars();
      return { user: demoUser };
    }
  }

  async signInWithGoogle(redirectTarget = 'dashboard.html') {
    await this.init();
    await window.dearlyDB?.ensureReady?.();
    const client = window.dearlyDB?.client;

    if (client) {
      // Build absolute callback URL back to auth.html preserving redirectTarget
      const baseOrigin = window.location.origin;
      const callbackUrl = new URL('auth.html', baseOrigin.endsWith('/') ? baseOrigin : baseOrigin + '/');
      if (redirectTarget) {
        callbackUrl.searchParams.set('redirect', redirectTarget);
      }

      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        throw new Error(this.mapAuthError(error.message));
      }

      if (data && data.url) {
        window.location.href = data.url;
      }
      return data;
    } else {
      // Demo fallback when running without configured Supabase
      const demoUser = {
        id: 'demo-google-' + Date.now(),
        email: 'user@gmail.com',
        user_metadata: {
          display_name: 'Google User',
          full_name: 'Google User',
          name: 'Google User'
        }
      };
      this.user = demoUser;
      localStorage.setItem('dearly_demo_user', JSON.stringify(demoUser));
      this.claimLocalExperiences(demoUser.id);
      this.updateNavbars();
      return { user: demoUser };
    }
  }

  async signOut() {
    const client = window.dearlyDB?.client;
    if (client) {
      try {
        await client.auth.signOut();
      } catch (e) {}
    }
    this.user = null;
    this.session = null;
    localStorage.removeItem('dearly_demo_user');
    this.updateNavbars();

    // If on protected page, redirect to home
    if (window.location.pathname.includes('dashboard.html')) {
      window.location.href = 'index.html';
    }
  }

  async resetPassword(email) {
    await window.dearlyDB?.ensureReady?.();
    const client = window.dearlyDB?.client;

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    if (client) {
      const callbackUrl = new URL('auth.html?mode=update-password', window.location.href).toString();
      const { data, error } = await client.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: callbackUrl
      });
      if (error) {
        throw new Error(this.mapAuthError(error.message));
      }
      return data;
    } else {
      return { success: true };
    }
  }

  async updatePassword(newPassword) {
    await window.dearlyDB?.ensureReady?.();
    const client = window.dearlyDB?.client;

    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    if (client) {
      const { data, error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        throw new Error(this.mapAuthError(error.message));
      }
      return data;
    }
    return { success: true };
  }

  /**
   * Safe ownership linking: link locally created experiences from this browser to the authenticated user
   */
  async claimLocalExperiences(userId) {
    if (!userId || !window.dearlyDB?.client) return;
    try {
      const trackedIds = JSON.parse(localStorage.getItem('dearly_user_created_ids') || '[]');
      if (trackedIds.length > 0) {
        // Link any unowned experiences created by this browser to the newly logged in user
        await window.dearlyDB.client
          .from('experiences')
          .update({ creator_id: userId })
          .in('public_id', trackedIds)
          .is('creator_id', null);
      }
    } catch (e) {
      console.warn('Experience claiming note:', e);
    }
  }

  /**
   * Friendly error messages mapping
   */
  mapAuthError(rawMessage) {
    if (!rawMessage) return 'An error occurred during authentication.';
    const msg = rawMessage.toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid_grant')) {
      return 'Incorrect email or password. Please try again.';
    }
    if (msg.includes('user already registered') || msg.includes('already exists')) {
      return 'An account with this email already exists. Try logging in!';
    }
    if (msg.includes('password should be at least')) {
      return 'Password must be at least 6 characters long.';
    }
    if (msg.includes('rate limit')) {
      return 'Too many attempts. Please wait a few minutes before trying again.';
    }
    if (msg.includes('unsupported provider') || msg.includes('provider is not enabled') || msg.includes('provider google is not enabled') || msg.includes('validation failed: provider')) {
      return 'Google sign-in is not enabled in your Supabase project yet. Please enable Google provider in your Supabase Authentication settings.';
    }
    if (msg.includes('access_denied') || msg.includes('user cancelled')) {
      return 'Google sign-in was cancelled.';
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'Network connection issue. Please check your internet connection.';
    }
    return rawMessage;
  }

  /**
   * Fetch unread notifications count for the navbar badge
   */
  async fetchUnreadCount() {
    if (!this.user || !window.dearlyDB) return;
    try {
      const notifs = await window.dearlyDB.getUserNotifications(this.user.id);
      this.unreadNotificationsCount = (notifs || []).filter((n) => !n.is_read).length;
      this.updateBadgeElements();
    } catch (e) {}
  }

  setupRealtimeNotifications() {
    if (!this.user || !window.dearlyDB) return;
    window.dearlyDB.subscribeToUserNotifications(this.user.id, (newNotif) => {
      this.unreadNotificationsCount++;
      this.updateBadgeElements();
      if (window.dearlyAudio) {
        window.dearlyAudio.playHeartPop();
      }
    });
  }

  updateBadgeElements() {
    const badges = document.querySelectorAll('.nav-bell-badge');
    badges.forEach((b) => {
      if (this.unreadNotificationsCount > 0) {
        b.style.display = 'inline-flex';
        b.textContent = this.unreadNotificationsCount > 99 ? '99+' : this.unreadNotificationsCount;
      } else {
        b.style.display = 'none';
      }
    });
  }

  /**
   * Injects/updates auth state in navbars across all pages
   */
  updateNavbars() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return;

    const hasMobileToggle = document.getElementById('mobile-nav-toggle') !== null;
    const toggleHtml = hasMobileToggle ? `
      <button type="button" class="mobile-nav-toggle" id="mobile-nav-toggle" aria-label="Open navigation menu" aria-expanded="false">
        ☰
      </button>
    ` : '';

    const existingMusicPill = navActions.querySelector('#dearly-music-control, .music-player-pill');
    const musicHtml = existingMusicPill ? existingMusicPill.outerHTML : '';

    if (this.user) {
      const name = this.getUserName();
      navActions.innerHTML = `
        ${musicHtml}
        <a href="dashboard.html" class="nav-bell-btn" title="View Notifications & Responses" aria-label="Notifications">
          🔔
          <span class="nav-bell-badge" style="${this.unreadNotificationsCount > 0 ? 'display:inline-flex;' : 'display:none;'}">
            ${this.unreadNotificationsCount}
          </span>
        </a>
        <a href="dashboard.html" class="user-account-btn" title="My Surprises Dashboard">
          <span>👤 ${this.escapeHtml(name)}</span>
        </a>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-global-logout" title="Log Out">
          Log Out
        </button>
        ${toggleHtml}
      `;

      const btnLogout = document.getElementById('btn-global-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', () => this.signOut());
      }
    } else {
      navActions.innerHTML = `
        ${musicHtml}
        <a href="auth.html" class="btn btn-ghost btn-sm">Log In</a>
        <a href="#experiences" class="btn btn-primary btn-sm">Create Gift ✨</a>
        ${toggleHtml}
      `;
    }

    if (window.dearlyAudio) {
      window.dearlyAudio.bindControls();
      window.dearlyAudio.syncUI();
    }

    // Sync desktop and mobile dashboard links across pages
    const navDashboardLi = document.getElementById('nav-dashboard-li');
    if (navDashboardLi) {
      navDashboardLi.style.display = this.user ? 'list-item' : 'none';
    }

    const drawerDashboardLink = document.getElementById('drawer-dashboard-link');
    if (drawerDashboardLink) {
      drawerDashboardLink.style.display = this.user ? 'block' : 'none';
    }

    const drawerLoginLink = document.getElementById('drawer-login-link');
    if (drawerLoginLink) {
      if (this.user) {
        drawerLoginLink.textContent = `👤 ${this.getUserName()} (Log Out)`;
        drawerLoginLink.href = 'javascript:void(0)';
        drawerLoginLink.onclick = () => this.signOut();
      } else {
        drawerLoginLink.textContent = '👤 Log In / Sign Up';
        drawerLoginLink.href = 'auth.html';
        drawerLoginLink.onclick = null;
      }
    }

    // Re-bind toggle if it was re-rendered
    const newToggle = document.getElementById('mobile-nav-toggle');
    const mobileDrawer = document.getElementById('mobile-nav-drawer');
    const mobileBackdrop = document.getElementById('mobile-nav-backdrop');
    if (newToggle && mobileDrawer) {
      newToggle.onclick = (e) => {
        e.stopPropagation();
        const isOpen = mobileDrawer.classList.toggle('open');
        if (mobileBackdrop) mobileBackdrop.classList.toggle('show', isOpen);
        newToggle.setAttribute('aria-expanded', isOpen);
        newToggle.textContent = isOpen ? '✕' : '☰';
        document.body.classList.toggle('nav-open', isOpen);
      };
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Global instance
window.dearlyAuth = new DearlyAuthService();
