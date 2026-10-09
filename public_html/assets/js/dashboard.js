/**
 * DEARLY — Sender Dashboard & Notifications Controller
 * Powers surprise management, replies viewing, and realtime notifications.
 */

class DearlyDashboardController {
  constructor() {
    this.user = null;
    this.experiences = [];
    this.savedGifts = [];
    this.notifications = [];
    this.activeTab = 'surprises';
    this.activeFilter = 'all'; // 'all', 'published', 'draft'
    this.isLoading = true;
  }

  async init() {
    // 1. Wait for Auth
    await window.dearlyAuth.init();
    this.user = window.dearlyAuth.getUser();

    // If OAuth hash/code is present in URL, allow Supabase session exchange to settle
    if (!this.user && (
      (window.location.search && (window.location.search.includes('code=') || window.location.search.includes('access_token='))) ||
      (window.location.hash && window.location.hash.includes('access_token='))
    )) {
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 2500);
        window.dearlyAuth.onAuthStateChange((event, session) => {
          if (session?.user) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      this.user = window.dearlyAuth.getUser();
    }

    if (!this.user) {
      window.location.href = 'auth.html?redirect=dashboard.html';
      return;
    }

    // 2. Set user display name in greeting
    const greetingEl = document.getElementById('dashboard-user-greeting');
    if (greetingEl) {
      greetingEl.textContent = `Welcome back, ${window.dearlyAuth.getUserName()} 💕`;
    }

    // 3. Tab navigation handling (supports #saved_gifts and #notifications hash)
    this.bindTabs();
    this.bindFilters();

    if (window.location.hash === '#saved_gifts') {
      this.switchTab('saved_gifts');
    } else if (window.location.hash === '#notifications') {
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

  bindFilters() {
    const filterBtns = document.querySelectorAll('.gift-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.getAttribute('data-filter') || 'all';
        this.renderSurprises();
      });
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.dashboard-tab-link').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });

    const surprisesPanel = document.getElementById('panel-surprises');
    const savedGiftsPanel = document.getElementById('panel-saved_gifts');
    const notificationsPanel = document.getElementById('panel-notifications');

    if (surprisesPanel) surprisesPanel.style.display = tabName === 'surprises' ? 'block' : 'none';
    if (savedGiftsPanel) savedGiftsPanel.style.display = tabName === 'saved_gifts' ? 'block' : 'none';
    if (notificationsPanel) notificationsPanel.style.display = tabName === 'notifications' ? 'block' : 'none';

    if (tabName === 'notifications') {
      window.location.hash = '#notifications';
    } else if (tabName === 'saved_gifts') {
      window.location.hash = '#saved_gifts';
    } else {
      history.replaceState(null, null, 'dashboard.html');
    }
  }

  async loadDashboardData() {
    this.setLoading(true);

    try {
      const [experiences, savedGifts, notifications] = await Promise.all([
        window.dearlyDB.getUserExperiences(this.user.id),
        window.dearlyDB.getUserSavedGifts(this.user.id),
        window.dearlyDB.getUserNotifications(this.user.id)
      ]);

      this.experiences = experiences || [];
      this.savedGifts = savedGifts || [];
      this.notifications = notifications || [];

      this.updateStats();
      this.renderSurprises();
      this.renderSavedGifts();
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
    const tabSavedBadge = document.getElementById('tab-saved-badge');

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

    if (tabSavedBadge) {
      if (this.savedGifts.length > 0) {
        tabSavedBadge.style.display = 'inline-block';
        tabSavedBadge.textContent = this.savedGifts.length;
      } else {
        tabSavedBadge.style.display = 'none';
      }
    }

    // Also update global auth badge
    if (window.dearlyAuth) {
      window.dearlyAuth.unreadNotificationsCount = unreadCount;
      window.dearlyAuth.updateBadgeElements();
    }
  }

  renderSurprises() {
    const container = document.getElementById('surprises-list-container');
    if (!container) return;

    // Update filter counters
    const totalCount = this.experiences.length;
    const publishedCount = this.experiences.filter(e => e.status !== 'draft').length;
    const draftsCount = this.experiences.filter(e => e.status === 'draft').length;

    const elAll = document.getElementById('filter-all-count');
    const elPub = document.getElementById('filter-published-count');
    const elDraft = document.getElementById('filter-drafts-count');
    if (elAll) elAll.textContent = totalCount;
    if (elPub) elPub.textContent = publishedCount;
    if (elDraft) elDraft.textContent = draftsCount;

    if (this.experiences.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <span style="font-size: 3rem;">💌</span>
          <h3 style="font-size: 1.25rem; margin-top: 14px; margin-bottom: 8px;">No gifts created yet</h3>
          <p style="color: var(--text-muted); font-size: 0.92rem; margin-bottom: 22px;">
            Create your very first personalized surprise and share it with someone you care about!
          </p>
          <a href="create.html?type=love" class="btn btn-primary">Create Something ✨</a>
        </div>
      `;
      return;
    }

    // Apply active filter
    let filteredList = this.experiences;
    if (this.activeFilter === 'published') {
      filteredList = this.experiences.filter(e => e.status !== 'draft');
    } else if (this.activeFilter === 'draft') {
      filteredList = this.experiences.filter(e => e.status === 'draft');
    }

    if (filteredList.length === 0) {
      const filterLabel = this.activeFilter === 'draft' ? 'drafts' : 'published gifts';
      container.innerHTML = `
        <div class="empty-state-box" style="padding: 32px 16px;">
          <span style="font-size: 2.2rem;">📂</span>
          <h4 style="margin: 12px 0 6px 0; font-size: 1.1rem;">No ${filterLabel} found</h4>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 16px;">
            You don't have any items in this filter view right now.
          </p>
          <a href="create.html?type=love" class="btn btn-secondary btn-sm">+ Create New Gift</a>
        </div>
      `;
      return;
    }

    const baseOrigin = window.location.origin;
    const base = baseOrigin.endsWith('/') ? baseOrigin.slice(0, -1) : baseOrigin;

    let html = '<div class="surprises-grid">';
    filteredList.forEach(exp => {
      const isDraft = exp.status === 'draft';
      const shareUrl = `${base}/surprise.html?id=${exp.public_id}`;
      const repliesCount = (exp.responses || []).length;
      const formattedDate = exp.updated_at || exp.created_at ? new Date(exp.updated_at || exp.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
      const category = exp.type || 'love';

      const statusBadge = isDraft
        ? `<span class="surprise-status-pill" style="background: #FEF3C7; color: #92400E; font-size: 0.76rem; font-weight: 700; padding: 2px 8px; border-radius: 999px;">Draft ✏️</span>`
        : `<span class="surprise-status-pill" style="background: #ECFDF5; color: #065F46; font-size: 0.76rem; font-weight: 700; padding: 2px 8px; border-radius: 999px;">Published ✨</span>`;

      let actionsHtml = '';
      if (isDraft) {
        actionsHtml = `
          <a href="create.html?type=${encodeURIComponent(category)}&draft_id=${encodeURIComponent(exp.id)}" class="btn btn-primary btn-sm" title="Continue Editing">
            ✏️ Continue Editing
          </a>
          <button type="button" class="btn btn-secondary btn-sm btn-preview-draft" data-exp-id="${exp.id}" title="Preview Draft Experience">
            👁️ Preview
          </button>
          <button type="button" class="btn btn-ghost btn-sm btn-delete-surprise" data-exp-id="${exp.id}" data-name="${this.escapeHtml(exp.recipient_name)}" data-is-draft="true" style="color: #EF4444; margin-left: auto;" title="Delete Draft">
            🗑️
          </button>
        `;
      } else {
        actionsHtml = `
          <button type="button" class="btn btn-secondary btn-sm btn-copy-share-link" data-url="${this.escapeHtml(shareUrl)}" title="Copy Share Link">
            🔗 Copy Link
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-reshare-link" data-url="${this.escapeHtml(shareUrl)}" data-recipient="${this.escapeHtml(exp.recipient_name || 'Someone special')}" title="Re-share Gift Link">
            📤 Re-share
          </button>
          <a href="${this.escapeHtml(shareUrl)}" target="_blank" class="btn btn-secondary btn-sm" title="View Published Story">
            👁️ View Story
          </a>
          ${repliesCount > 0 ? `
            <button type="button" class="btn btn-primary btn-sm btn-view-exp-replies" data-exp-id="${exp.id}" title="View received replies">
              💬 Replies (${repliesCount})
            </button>
          ` : ''}
          <button type="button" class="btn btn-ghost btn-sm btn-delete-surprise" data-exp-id="${exp.id}" data-name="${this.escapeHtml(exp.recipient_name)}" data-is-draft="false" style="color: #EF4444; margin-left: auto;" title="Delete Gift">
            🗑️
          </button>
        `;
      }

      html += `
        <div class="surprise-card" id="card-surprise-${exp.id}">
          <div class="surprise-card-header">
            <span class="surprise-category-pill pill-${category}">${category} Gift</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${statusBadge}
              <span class="surprise-card-date">${formattedDate}</span>
            </div>
          </div>

          <div class="surprise-card-title">
            For ${this.escapeHtml(exp.recipient_name || 'Someone Special')} ❤️
          </div>
          <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 12px;">
            From ${this.escapeHtml(exp.sender_name || 'You')}
          </p>

          ${!isDraft ? `
            <div class="surprise-card-replies-badge ${repliesCount > 0 ? 'has-replies' : ''}">
              <span>${repliesCount > 0 ? '💌' : '⏳'}</span>
              <span>${repliesCount > 0 ? `${repliesCount} ${repliesCount === 1 ? 'Response' : 'Responses'} Received` : 'Awaiting Response'}</span>
            </div>
          ` : `
            <div class="surprise-card-replies-badge" style="background: #FFFBEB; color: #92400E; border: 1px dashed #FCD34D;">
              <span>💾</span>
              <span>Unpublished Draft • Ready to resume</span>
            </div>
          `}

          <div class="surprise-card-actions">
            ${actionsHtml}
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

    // 1b. Re-share link button (native share sheet with clipboard fallback)
    document.querySelectorAll('.btn-reshare-link').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-url');
        const recipient = btn.getAttribute('data-recipient') || 'someone special';
        if (navigator.share) {
          try {
            await navigator.share({
              title: `A DEARLY surprise for ${recipient} 💌`,
              text: `I made an interactive surprise for you on DEARLY!`,
              url: url
            });
            this.showToast('Shared successfully! 💌');
            return;
          } catch (e) {
            // User cancelled or share unsupported
          }
        }
        // Fallback
        try {
          await navigator.clipboard.writeText(url);
          this.showToast('Original gift link copied to clipboard! 💌');
        } catch (e) {
          prompt('Copy this link to re-share:', url);
        }
      });
    });

    // 1c. Preview Draft button
    document.querySelectorAll('.btn-preview-draft').forEach(btn => {
      btn.addEventListener('click', async () => {
        const expId = btn.getAttribute('data-exp-id');
        const exp = this.experiences.find(e => e.id === expId);
        if (exp) {
          const previewData = {
            id: exp.id,
            draft_id: exp.id,
            type: exp.type,
            sender_name: exp.sender_name,
            recipient_name: exp.recipient_name,
            relationship: exp.relationship,
            nickname: exp.nickname,
            reason: exp.reason,
            messages: exp.messages,
            extra_messages: exp.extra_messages,
            letter: exp.letter,
            photos: exp.photos
          };
          sessionStorage.setItem('dearly_preview_data', JSON.stringify(previewData));
          if (window.DearlyStorage) {
            await window.DearlyStorage.set('dearly_preview_data', previewData);
          }
          window.location.href = `preview.html?type=${encodeURIComponent(exp.type || 'love')}`;
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

    // 3. Delete experience or draft button
    document.querySelectorAll('.btn-delete-surprise').forEach(btn => {
      btn.addEventListener('click', () => {
        const expId = btn.getAttribute('data-exp-id');
        const name = btn.getAttribute('data-name') || 'this surprise';
        const isDraft = btn.getAttribute('data-is-draft') === 'true';
        this.confirmDeleteExperience(expId, name, isDraft);
      });
    });
  }

  renderSavedGifts() {
    const container = document.getElementById('saved-gifts-list-container');
    if (!container) return;

    if (this.savedGifts.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <span style="font-size: 3rem;">🔖</span>
          <h3 style="font-size: 1.25rem; margin-top: 14px; margin-bottom: 8px;">No saved gifts yet</h3>
          <p style="color: var(--text-muted); font-size: 0.92rem; margin-bottom: 22px;">
            When someone sends you a DEARLY surprise, tap "Save Gift" on the gift page to keep it in your personal collection!
          </p>
        </div>
      `;
      return;
    }

    const baseOrigin = window.location.origin;
    const base = baseOrigin.endsWith('/') ? baseOrigin.slice(0, -1) : baseOrigin;

    let html = '<div class="surprises-grid">';
    this.savedGifts.forEach(gift => {
      const shareUrl = `${base}/surprise.html?id=${gift.public_id}`;
      const category = gift.type || 'love';
      const formattedDate = gift.created_at ? new Date(gift.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently saved';

      html += `
        <div class="surprise-card" id="card-saved-gift-${gift.id}">
          <div class="surprise-card-header">
            <span class="surprise-category-pill pill-${category}">${category} Gift</span>
            <span class="surprise-card-date">${formattedDate}</span>
          </div>

          <div class="surprise-card-title">
            From ${this.escapeHtml(gift.sender_name || 'Someone Special')} 💕
          </div>
          <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 12px;">
            For ${this.escapeHtml(gift.recipient_name || 'You')}
          </p>

          <div class="surprise-card-actions" style="margin-top: 16px;">
            <a href="${this.escapeHtml(shareUrl)}" target="_blank" class="btn btn-primary btn-sm" title="Open and replay gift">
              💌 Open Gift ↗
            </a>
            <button type="button" class="btn btn-secondary btn-sm btn-copy-share-link" data-url="${this.escapeHtml(shareUrl)}" title="Copy Link">
              🔗 Copy Link
            </button>
            <button type="button" class="btn btn-ghost btn-sm btn-remove-saved-gift" data-gift-id="${gift.id}" data-public-id="${gift.public_id}" style="color: #EF4444; margin-left: auto;" title="Remove from Saved Gifts">
              🗑️ Remove
            </button>
          </div>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;
    this.bindSavedGiftsEvents();
  }

  bindSavedGiftsEvents() {
    // 1. Copy link button
    document.querySelectorAll('#saved-gifts-list-container .btn-copy-share-link').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-url');
        try {
          await navigator.clipboard.writeText(url);
          const original = btn.innerHTML;
          btn.innerHTML = '✅ Copied!';
          this.showToast('Gift link copied to clipboard! 💌');
          setTimeout(() => (btn.innerHTML = original), 2200);
        } catch (e) {
          prompt('Copy this link:', url);
        }
      });
    });

    // 2. Remove saved gift button
    document.querySelectorAll('.btn-remove-saved-gift').forEach(btn => {
      btn.addEventListener('click', async () => {
        const giftId = btn.getAttribute('data-gift-id');
        const publicId = btn.getAttribute('data-public-id');
        const confirmed = confirm('Remove this gift from your saved collection? (The sender\'s original gift will remain intact)');
        if (!confirmed) return;

        btn.disabled = true;
        btn.textContent = 'Removing... ⏳';

        try {
          const res = await window.dearlyDB.removeSavedGift(giftId || publicId);
          if (res && res.success) {
            this.savedGifts = this.savedGifts.filter(g => g.id !== giftId && g.public_id !== publicId);
            this.updateStats();
            this.renderSavedGifts();
            this.showToast('Gift removed from your collection.');
          } else {
            alert('Could not remove saved gift: ' + (res?.error || 'Unknown error'));
            btn.disabled = false;
            btn.textContent = '🗑️ Remove';
          }
        } catch (err) {
          console.error('Error removing saved gift:', err);
          alert('Error removing saved gift: ' + err.message);
          btn.disabled = false;
          btn.textContent = '🗑️ Remove';
        }
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

  confirmDeleteExperience(experienceId, recipientName, isDraft = false) {
    let msg = '';
    if (isDraft) {
      msg = `Are you sure you want to delete this unfinished draft${recipientName ? ' for ' + recipientName : ''}? This cannot be undone.`;
    } else {
      msg = `Are you sure you want to permanently delete this published gift${recipientName ? ' for ' + recipientName : ''}? The shared recipient link will no longer work.`;
    }

    if (!confirm(msg)) {
      return;
    }

    this.deleteExperience(experienceId, isDraft);
  }

  async deleteExperience(experienceId, isDraft = false) {
    try {
      const res = await window.dearlyDB.deleteExperience(experienceId);
      if (res && res.success) {
        this.experiences = this.experiences.filter(e => e.id !== experienceId);
        this.updateStats();
        this.renderSurprises();
        this.showToast(isDraft ? 'Draft deleted successfully.' : 'Published gift deleted successfully.');
      } else {
        alert('Could not delete: ' + (res?.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error deleting: ' + e.message);
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
