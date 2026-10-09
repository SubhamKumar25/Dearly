/**
 * DEARLY — Sender Dashboard & Notifications Controller
 * Powers surprise management, replies viewing, and realtime notifications.
 */

class DearlyDashboardController {
  constructor() {
    this.user = null;
    this.experiences = [];
    this.notifications = [];
    this.activeTab = 'surprises';
    this.isLoading = true;
  }

  async init() {
    // 1. Wait for Auth
    await window.dearlyAuth.init();
    this.user = window.dearlyAuth.getUser();

    if (!this.user) {
      window.location.href = 'auth.html?redirect=dashboard.html';
      return;
    }

    // 2. Set user display name in greeting
    const greetingEl = document.getElementById('dashboard-user-greeting');
    if (greetingEl) {
      greetingEl.textContent = `Welcome back, ${window.dearlyAuth.getUserName()} 💕`;
    }

    // 3. Tab navigation handling (supports #notifications hash)
    this.bindTabs();
    if (window.location.hash === '#notifications') {
      this.switchTab('notifications');
    }

    // 4. Fetch data
    await this.loadDashboardData();

    // 5. Subscribe to live notifications via Realtime
    this.setupRealtime();
  }

  bindTabs() {
    const tabs = document.querySelectorAll('.dashboard-tab-link');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const tabTarget = tab.getAttribute('data-tab');
        this.switchTab(tabTarget);
      });
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.dashboard-tab-link').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });

    const surprisesPanel = document.getElementById('panel-surprises');
    const notificationsPanel = document.getElementById('panel-notifications');

    if (surprisesPanel && notificationsPanel) {
      surprisesPanel.style.display = tabName === 'surprises' ? 'block' : 'none';
      notificationsPanel.style.display = tabName === 'notifications' ? 'block' : 'none';
    }

    if (tabName === 'notifications') {
      window.location.hash = '#notifications';
    } else {
      history.replaceState(null, null, 'dashboard.html');
    }
  }

  async loadDashboardData() {
    this.setLoading(true);

    try {
      const [experiences, notifications] = await Promise.all([
        window.dearlyDB.getUserExperiences(this.user.id),
        window.dearlyDB.getUserNotifications(this.user.id)
      ]);

      this.experiences = experiences || [];
      this.notifications = notifications || [];

      this.updateStats();
      this.renderSurprises();
      this.renderNotifications();
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      this.showToast('Could not load some dashboard data. Please try refreshing.');
    } finally {
      this.setLoading(false);
    }
  }

  updateStats() {
    const elSurprisesCount = document.getElementById('stat-surprises-count');
    const elRepliesCount = document.getElementById('stat-replies-count');
    const elNotifsCount = document.getElementById('stat-notifs-count');
    const tabNotifsBadge = document.getElementById('tab-notifs-badge');

    // Total replies received across all experiences
    let totalReplies = 0;
    this.experiences.forEach(e => {
      totalReplies += (e.responses || []).length;
    });

    const unreadCount = this.notifications.filter(n => !n.is_read).length;

    if (elSurprisesCount) elSurprisesCount.textContent = this.experiences.length;
    if (elRepliesCount) elRepliesCount.textContent = totalReplies;
    if (elNotifsCount) elNotifsCount.textContent = unreadCount;

    if (tabNotifsBadge) {
      if (unreadCount > 0) {
        tabNotifsBadge.style.display = 'inline-block';
        tabNotifsBadge.textContent = unreadCount;
      } else {
        tabNotifsBadge.style.display = 'none';
      }
    }

    // Also update global auth badge
    window.dearlyAuth.unreadNotificationsCount = unreadCount;
    window.dearlyAuth.updateBadgeElements();
  }

  renderSurprises() {
    const container = document.getElementById('surprises-list-container');
    if (!container) return;

    if (this.experiences.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <span style="font-size: 3rem;">💌</span>
          <h3 style="font-size: 1.25rem; margin-top: 14px; margin-bottom: 8px;">No surprises created yet</h3>
          <p style="color: var(--text-muted); font-size: 0.92rem; margin-bottom: 22px;">
            Create your very first personalized surprise and share it with someone you care about!
          </p>
          <a href="create.html?type=love" class="btn btn-primary">Create Something ✨</a>
        </div>
      `;
      return;
    }

    const base = window.location.href.substring(0, window.location.href.lastIndexOf('/'));

    let html = '<div class="surprises-grid">';
    this.experiences.forEach(exp => {
      const shareUrl = `${base}/surprise.html?id=${exp.public_id}`;
      const repliesCount = (exp.responses || []).length;
      const formattedDate = exp.created_at ? new Date(exp.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
      const category = exp.type || 'love';

      html += `
        <div class="surprise-card" id="card-surprise-${exp.id}">
          <div class="surprise-card-header">
            <span class="surprise-category-pill pill-${category}">${category} Gift</span>
            <span class="surprise-card-date">${formattedDate}</span>
          </div>

          <div class="surprise-card-title">
            For ${this.escapeHtml(exp.recipient_name || 'Someone Special')} ❤️
          </div>
          <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 12px;">
            From ${this.escapeHtml(exp.sender_name || 'You')}
          </p>

          <div class="surprise-card-replies-badge ${repliesCount > 0 ? 'has-replies' : ''}">
            <span>${repliesCount > 0 ? '💌' : '⏳'}</span>
            <span>${repliesCount > 0 ? `${repliesCount} ${repliesCount === 1 ? 'Response' : 'Responses'} Received` : 'Awaiting Response'}</span>
          </div>

          <div class="surprise-card-actions">
            <button type="button" class="btn btn-secondary btn-sm btn-copy-share-link" data-url="${this.escapeHtml(shareUrl)}" title="Copy Share Link">
              🔗 Copy Link
            </button>
            <a href="${this.escapeHtml(shareUrl)}" target="_blank" class="btn btn-secondary btn-sm" title="Preview Surprise">
              👁️ View Story
            </a>
            ${repliesCount > 0 ? `
              <button type="button" class="btn btn-primary btn-sm btn-view-exp-replies" data-exp-id="${exp.id}" title="View received replies">
                💬 View Replies (${repliesCount})
              </button>
            ` : ''}
            <button type="button" class="btn btn-ghost btn-sm btn-delete-surprise" data-exp-id="${exp.id}" data-name="${this.escapeHtml(exp.recipient_name)}" style="color: #EF4444; margin-left: auto;" title="Delete Surprise">
              🗑️
            </button>
          </div>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;
    this.bindSurpriseCardEvents();
  }

  bindSurpriseCardEvents() {
    // 1. Copy link button
    document.querySelectorAll('.btn-copy-share-link').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-url');
        try {
          await navigator.clipboard.writeText(url);
          const original = btn.innerHTML;
          btn.innerHTML = '✅ Copied!';
          this.showToast('Share link copied to clipboard! 💌');
          setTimeout(() => (btn.innerHTML = original), 2200);
        } catch (e) {
          prompt('Copy this link:', url);
        }
      });
    });

    // 2. View replies button
    document.querySelectorAll('.btn-view-exp-replies').forEach(btn => {
      btn.addEventListener('click', () => {
        const expId = btn.getAttribute('data-exp-id');
        const exp = this.experiences.find(e => e.id === expId);
        if (exp && exp.responses) {
          this.openRepliesModal(exp);
        }
      });
    });

    // 3. Delete experience button
    document.querySelectorAll('.btn-delete-surprise').forEach(btn => {
      btn.addEventListener('click', () => {
        const expId = btn.getAttribute('data-exp-id');
        const name = btn.getAttribute('data-name') || 'this surprise';
        this.confirmDeleteExperience(expId, name);
      });
    });
  }

  renderNotifications() {
    const container = document.getElementById('notifications-list-container');
    if (!container) return;

    if (this.notifications.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <span style="font-size: 3rem;">🔔</span>
          <h3 style="font-size: 1.25rem; margin-top: 14px; margin-bottom: 8px;">No notifications yet</h3>
          <p style="color: var(--text-muted); font-size: 0.92rem;">
            When someone opens your gift and sends love back, you'll see their response right here in real time!
          </p>
        </div>
      `;
      return;
    }

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-size: 1.1rem; margin: 0;">Recent Responses & Activity</h3>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-mark-all-read">
          ✓ Mark All as Read
        </button>
      </div>
      <div class="notifications-list">
    `;

    this.notifications.forEach(notif => {
      const isUnread = !notif.is_read;
      const timeStr = this.formatRelativeTime(notif.created_at);
      let icon = '💌';
      if (notif.type === 'forgive') icon = '🕊️';
      if (notif.type === 'yes') icon = '💍';
      if (notif.type === 'wish') icon = '🎂';

      html += `
        <div class="notification-card ${isUnread ? 'unread' : ''}" id="notif-card-${notif.id}">
          <div class="notification-icon-box">${icon}</div>
          <div class="notification-body">
            <div class="notification-title">
              ${this.escapeHtml(notif.title)}
            </div>
            ${notif.message ? `
              <div class="notification-msg-preview">
                “${this.escapeHtml(notif.message)}”
              </div>
            ` : ''}
            <div class="notification-meta">
              <span>🕒 ${timeStr}</span>
              ${isUnread ? '<span style="color: #E11D48; font-weight: 700;">• Unread</span>' : ''}
            </div>
          </div>
          <div class="notification-actions">
            ${isUnread ? `
              <button type="button" class="btn btn-ghost btn-sm btn-mark-read" data-id="${notif.id}" title="Mark as read">
                Mark Read
              </button>
            ` : ''}
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;

    // Bind mark read events
    document.querySelectorAll('.btn-mark-read').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.markAsRead(id);
      });
    });

    const btnMarkAll = document.getElementById('btn-mark-all-read');
    if (btnMarkAll) {
      btnMarkAll.addEventListener('click', async () => {
        await window.dearlyDB.markAllNotificationsAsRead(this.user.id);
        this.notifications.forEach(n => (n.is_read = true));
        this.updateStats();
        this.renderNotifications();
        this.showToast('All notifications marked as read! ✨');
      });
    }
  }

  async markAsRead(notificationId) {
    await window.dearlyDB.markNotificationAsRead(notificationId);
    const target = this.notifications.find(n => n.id === notificationId);
    if (target) target.is_read = true;
    this.updateStats();
    this.renderNotifications();
  }

  setupRealtime() {
    if (!this.user || !window.dearlyDB) return;

    window.dearlyDB.subscribeToUserNotifications(this.user.id, (newNotif) => {
      this.notifications.unshift(newNotif);
      this.updateStats();
      this.renderNotifications();
      this.showToast(`🔔 ${newNotif.title}`);
      if (window.dearlyAudio) window.dearlyAudio.playCelebration();
    });
  }

  openRepliesModal(experience) {
    let modal = document.getElementById('replies-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'replies-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    const responses = experience.responses || [];
    let repliesHtml = '';

    if (responses.length === 0) {
      repliesHtml = '<p style="color: var(--text-muted); padding: 20px 0;">No responses yet.</p>';
    } else {
      repliesHtml = '<div style="display: flex; flex-direction: column; gap: 12px; max-height: 380px; overflow-y: auto; text-align: left; padding: 4px;">';
      responses.forEach(r => {
        const time = r.created_at ? new Date(r.created_at).toLocaleString() : '';
        repliesHtml += `
          <div style="background: #FFF9FA; border: 1px solid #FFE4E6; border-radius: 12px; padding: 14px 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; color: #E11D48;">${this.escapeHtml(r.recipient_name || 'Your Loved One')} ❤️</span>
              <span style="font-size: 0.78rem; color: var(--text-light);">${time}</span>
            </div>
            ${r.message ? `
              <p style="font-size: 0.92rem; color: var(--text-main); margin: 0; line-height: 1.5; font-style: italic;">
                “${this.escapeHtml(r.message)}”
              </p>
            ` : '<p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Sent love back 💕</p>'}
          </div>
        `;
      });
      repliesHtml += '</div>';
    }

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
          <h3 style="margin: 0; font-size: 1.25rem;">
            Replies for ${this.escapeHtml(experience.recipient_name)} ❤️
          </h3>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-close-replies-modal" style="font-size: 1.2rem; padding: 4px 8px;">✕</button>
        </div>

        ${repliesHtml}

        <div style="margin-top: 20px; text-align: right;">
          <button type="button" class="btn btn-primary btn-sm" id="btn-close-replies-modal-2">
            Done
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');

    const closeHandler = () => modal.classList.remove('active');
    document.getElementById('btn-close-replies-modal')?.addEventListener('click', closeHandler);
    document.getElementById('btn-close-replies-modal-2')?.addEventListener('click', closeHandler);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeHandler();
    });
  }

  confirmDeleteExperience(experienceId, recipientName) {
    if (!confirm(`Are you sure you want to delete the surprise for ${recipientName}? This cannot be undone.`)) {
      return;
    }

    this.deleteExperience(experienceId);
  }

  async deleteExperience(experienceId) {
    try {
      const res = await window.dearlyDB.deleteExperience(experienceId);
      if (res && res.success) {
        this.experiences = this.experiences.filter(e => e.id !== experienceId);
        this.updateStats();
        this.renderSurprises();
        this.showToast('Surprise deleted successfully.');
      } else {
        alert('Could not delete surprise: ' + (res?.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error deleting surprise: ' + e.message);
    }
  }

  formatRelativeTime(dateStr) {
    if (!dateStr) return 'Just now';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now - date) / 1000);

      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
      return date.toLocaleDateString();
    } catch (e) {
      return 'Recently';
    }
  }

  setLoading(val) {
    this.isLoading = val;
    const loader = document.getElementById('dashboard-loading-spinner');
    if (loader) loader.style.display = val ? 'block' : 'none';
  }

  showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashboard-main-view')) {
    window.dashboardInstance = new DearlyDashboardController();
    window.dashboardInstance.init();
  }
});
