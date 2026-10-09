/**
 * DEARLY — Supabase Client & Database Services (v2.0)
 * Handles authentication, database queries, storage photo uploads,
 * two-way response submissions, realtime notifications, and local demo fallback.
 */

class DearlyDatabaseService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.currentUser = null;
    this.demoStorageKey = 'dearly_local_experiences';
    this.demoResponsesKey = 'dearly_local_responses';
    this.demoNotificationsKey = 'dearly_local_notifications';
    this.initPromise = this.init();
  }

  async init() {
    if (window.isSupabaseConfigured && window.isSupabaseConfigured()) {
      try {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
          this.client = window.supabase.createClient(
            window.DEARLY_CONFIG.SUPABASE_URL,
            window.DEARLY_CONFIG.SUPABASE_ANON_KEY,
            {
              auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
              }
            }
          );

          // Check current authenticated session
          try {
            const { data: sessionData, error: sessionErr } = await this.client.auth.getSession();
            if (sessionData && sessionData.session) {
              this.currentUser = sessionData.session.user;
            } else {
              this.currentUser = null;
            }

            // Listen for auth state changes to keep currentUser in sync
            this.client.auth.onAuthStateChange((event, session) => {
              this.currentUser = session?.user || null;
            });
          } catch (authErr) {
            console.warn('Session check note:', authErr.message);
          }

          this.isReady = true;
          console.log('✅ Supabase initialized successfully (v2.0).');
          return;
        }
      } catch (err) {
        console.error('Failed to initialize Supabase client:', err);
      }
    }

    console.info('ℹ️ Running DEARLY in Local Demo Mode (Browser Storage).');
    this.isReady = false;
  }

  async ensureReady() {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Helper: Convert Base64 Data URL to a native Blob object with proper MIME type
   */
  dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    try {
      const parts = dataUrl.split(',');
      if (parts.length < 2) return null;
      const match = parts[0].match(/:(.*?);/);
      const mime = match ? match[1] : 'image/jpeg';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      console.error('Error converting dataUrl to Blob:', e);
      return null;
    }
  }

  /**
   * Upload an array of photo items to Supabase Storage bucket.
   * Handles File objects, Blob objects, and Base64 Data URLs.
   * Returns array of permanent, stable public URLs.
   */
  async uploadPhotos(photoItems, experienceId) {
    if (!photoItems || photoItems.length === 0) return [];
    await this.ensureReady();

    const bucketName = window.DEARLY_CONFIG?.STORAGE_BUCKET || 'experience-photos';
    const uploadedUrls = [];

    for (let i = 0; i < photoItems.length; i++) {
      const item = photoItems[i];
      if (!item) continue;

      // 1. If it's already an existing HTTP/HTTPS public URL, preserve it
      if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) {
        uploadedUrls.push(item);
        continue;
      }
      if (typeof item === 'object' && item.url && (item.url.startsWith('http://') || item.url.startsWith('https://'))) {
        uploadedUrls.push(item.url);
        continue;
      }

      // 2. Extract or convert into a valid Blob/File
      let uploadBlob = null;
      let fileExt = 'jpg';
      let contentType = 'image/jpeg';

      if (typeof item === 'string' && item.startsWith('data:image/')) {
        uploadBlob = this.dataUrlToBlob(item);
        const match = item.substring(0, 30).match(/data:image\/([a-zA-Z0-9+]+);/);
        if (match && match[1]) fileExt = match[1] === 'jpeg' ? 'jpg' : match[1];
        contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
      } else if (item instanceof Blob || (typeof File !== 'undefined' && item instanceof File)) {
        uploadBlob = item;
        contentType = item.type || 'image/jpeg';
        if (item.name) {
          const parts = item.name.split('.');
          if (parts.length > 1) fileExt = parts.pop().toLowerCase();
        }
      } else if (typeof item === 'object') {
        if (item.file instanceof Blob || (typeof File !== 'undefined' && item.file instanceof File)) {
          uploadBlob = item.file;
          contentType = item.file.type || 'image/jpeg';
          if (item.file.name) {
            const parts = item.file.name.split('.');
            if (parts.length > 1) fileExt = parts.pop().toLowerCase();
          }
        } else if (item.dataUrl && typeof item.dataUrl === 'string' && item.dataUrl.startsWith('data:image/')) {
          uploadBlob = this.dataUrlToBlob(item.dataUrl);
          const match = item.dataUrl.substring(0, 30).match(/data:image\/([a-zA-Z0-9+]+);/);
          if (match && match[1]) fileExt = match[1] === 'jpeg' ? 'jpg' : match[1];
          contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
        }
      }

      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt.toLowerCase()) ? fileExt.toLowerCase() : 'jpg';

      // 3. Upload to Supabase Storage if client is ready and we have a valid Blob
      if (this.isReady && this.client && uploadBlob) {
        try {
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 8);
          const fileName = `photos/${experienceId}_${timestamp}_${i}_${randomId}.${safeExt}`;

          console.log(`Uploading photo ${i + 1}/${photoItems.length} (${(uploadBlob.size / 1024).toFixed(1)} KB) to ${bucketName}...`);

          const { data, error } = await this.client.storage
            .from(bucketName)
            .upload(fileName, uploadBlob, {
              cacheControl: '31536000', // 1 year cache
              upsert: true,
              contentType: contentType
            });

          if (error) {
            console.error(`Storage upload failed for photo #${i + 1}:`, error.message);
            // Fallback: If image upload was blocked, fall back to dataUrl if available
            const fallbackUrl = (typeof item === 'object' ? item.dataUrl : (typeof item === 'string' ? item : ''));
            if (fallbackUrl && fallbackUrl.length < 500000) {
              uploadedUrls.push(fallbackUrl);
            }
          } else {
            const { data: publicUrlData } = this.client.storage
              .from(bucketName)
              .getPublicUrl(fileName);

            if (publicUrlData && publicUrlData.publicUrl) {
              console.log(`✅ Photo #${i + 1} uploaded successfully: ${publicUrlData.publicUrl}`);
              uploadedUrls.push(publicUrlData.publicUrl);
            }
          }
        } catch (uploadErr) {
          console.error(`Unexpected error uploading photo #${i + 1}:`, uploadErr);
        }
      } else {
        // Local Demo fallback: preserve dataUrl
        const localDataUrl = (typeof item === 'object' ? item.dataUrl : (typeof item === 'string' ? item : ''));
        if (localDataUrl) {
          uploadedUrls.push(localDataUrl);
        }
      }
    }

    return uploadedUrls.filter(Boolean);
  }

  /**
   * Save experience into database
   */
   async saveExperience(experienceData) {
    await this.ensureReady();
    const isExisting = Boolean(experienceData.id && this.isValidUuid(experienceData.id));
    const experienceId = isExisting ? experienceData.id : (crypto.randomUUID ? crypto.randomUUID() : this.generateFallbackUuid());
    const publicId = experienceData.public_id || (crypto.randomUUID ? crypto.randomUUID() : this.generateFallbackUuid());

    // 1. Process and upload photos to Supabase Storage
    let finalPhotoUrls = [];
    if (experienceData.photos && experienceData.photos.length > 0) {
      finalPhotoUrls = await this.uploadPhotos(experienceData.photos, publicId);
    }

    // 2. Identify authenticated creator (strictly enforce authentication)
    let creatorId = null;
    if (this.isReady && this.client) {
      try {
        const { data: sessionData } = await this.client.auth.getSession();
        if (sessionData?.session?.user?.id) {
          creatorId = sessionData.session.user.id;
        }
      } catch (e) {}

      if (!creatorId) {
        try {
          const { data: userData } = await this.client.auth.getUser();
          if (userData?.user?.id) {
            creatorId = userData.user.id;
          }
        } catch (e) {
          console.warn('Could not read user for creator_id:', e);
        }
      }

      if (!creatorId) {
        const fallbackUser = window.dearlyAuth?.getUser?.();
        if (fallbackUser?.id) {
          creatorId = fallbackUser.id;
        }
      }

      if (!creatorId) {
        return {
          success: false,
          error: 'Authentication required. Please log in or sign up to create and publish gifts.'
        };
      }
    } else {
      // Local demo mode (offline / without Supabase credentials)
      const demoUser = window.dearlyAuth?.getUser?.();
      if (!demoUser) {
        return {
          success: false,
          error: 'Authentication required. Please log in to create and publish gifts.'
        };
      }
      creatorId = demoUser.id;
    }

    // 3. Prepare payload matching experiences schema
    const targetStatus = experienceData.status || 'published';
    const payload = {
      id: experienceId,
      public_id: publicId,
      creator_id: creatorId,
      type: experienceData.type,
      sender_name: experienceData.sender_name || 'Someone who cares',
      recipient_name: experienceData.recipient_name || 'You',
      relationship: experienceData.relationship || '',
      nickname: experienceData.nickname || '',
      reason: experienceData.reason || '',
      messages: experienceData.messages || [],
      extra_messages: experienceData.extra_messages || [],
      letter: experienceData.letter || '',
      memories: experienceData.memories || [],
      photos: finalPhotoUrls,
      theme: experienceData.theme || experienceData.type || 'default',
      status: targetStatus
    };

    // 4. Save to Supabase (Update existing draft or Insert new)
    if (this.isReady && this.client) {
      try {
        let resultData = null;
        if (isExisting) {
          const { data, error } = await this.client
            .from('experiences')
            .update(payload)
            .eq('id', experienceId)
            .eq('creator_id', creatorId)
            .select('id, public_id, status')
            .single();

          if (error) {
            console.error('Supabase update error:', error);
            throw new Error(error.message || 'Failed to update experience in database');
          }
          resultData = data;
        } else {
          const { data, error } = await this.client
            .from('experiences')
            .insert([payload])
            .select('id, public_id, status')
            .single();

          if (error) {
            console.error('Supabase insert error:', error);
            throw new Error(error.message || 'Failed to save experience to database');
          }
          resultData = data;
        }

        // Keep local cache of created experiences for the current user
        this.trackLocallyCreatedId(resultData.public_id, resultData.id);

        return {
          success: true,
          public_id: resultData.public_id,
          id: resultData.id,
          status: resultData.status || targetStatus,
          isDemo: false
        };
      } catch (dbErr) {
        console.warn('Saving to Supabase failed, saving to local backup:', dbErr.message);
        this.saveToLocalDemo(publicId, payload);
        this.trackLocallyCreatedId(publicId, experienceId);
        return {
          success: true,
          public_id: publicId,
          id: experienceId,
          status: targetStatus,
          isDemo: true,
          warning: 'Saved locally as backup: ' + dbErr.message
        };
      }
    }

    // 5. Local Demo Mode fallback
    this.saveToLocalDemo(publicId, payload);
    this.trackLocallyCreatedId(publicId, experienceId);
    return {
      success: true,
      public_id: publicId,
      id: experienceId,
      status: targetStatus,
      isDemo: true
    };
  }

  /**
   * Helper: Check if a string is a valid UUID
   */
  isValidUuid(str) {
    if (!str || typeof str !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str.trim());
  }

  /**
   * Fetch experience by public_id
   */
  async getExperienceByPublicId(publicId) {
    if (!publicId) return null;
    await this.ensureReady();

    // Built-in Demo fallback for immediate preview and testing
    if (publicId === 'demo' || publicId === 'demo-gift') {
      return {
        id: 'demo-experience-id',
        public_id: 'demo',
        creator_id: null,
        type: 'love',
        sender_name: 'Someone who cares ✨',
        recipient_name: 'You 💕',
        relationship: 'Partner',
        nickname: 'My Favorite Person',
        reason: 'Just a little reminder of how special you are.',
        messages: [
          'Every moment with you brings warmth, laughter, and so much peace.',
          'You make ordinary days feel extraordinarily bright.',
          'Thank you for simply being you — genuine, wonderful, and cherished.'
        ],
        letter: 'Life moves fast, but having you in it makes all the difference. This little moment was created just to bring a warm smile to your face today. 💕',
        photos: [],
        theme: 'love',
        status: 'published',
        created_at: new Date().toISOString()
      };
    }

    // 1. If Supabase is active and ID is a valid UUID, query DB
    if (this.isReady && this.client && this.isValidUuid(publicId)) {
      try {
        const { data, error } = await this.client
          .from('experiences')
          .select('id, public_id, creator_id, type, sender_name, recipient_name, relationship, nickname, reason, messages, extra_messages, letter, memories, photos, theme, status, created_at')
          .eq('public_id', publicId)
          .eq('status', 'published')
          .maybeSingle();

        if (error) {
          console.warn('Supabase query error:', error.message);
        } else if (data) {
          // Normalize photos array
          data.photos = this.normalizePhotosList(data.photos);
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch failed, checking local demo store:', err);
      }
    }

    // 2. Check local demo storage
    const localData = this.getFromLocalDemo(publicId);
    if (localData) {
      localData.photos = this.normalizePhotosList(localData.photos);
      return localData;
    }

    return null;
  }

  /**
   * Fetch experience by internal UUID (e.g. for continuing draft editing)
   */
  async getExperienceById(experienceId) {
    if (!experienceId) return null;
    await this.ensureReady();

    if (this.isReady && this.client) {
      try {
        const { data, error } = await this.client
          .from('experiences')
          .select('id, public_id, creator_id, type, sender_name, recipient_name, relationship, nickname, reason, messages, extra_messages, letter, memories, photos, theme, status, created_at, updated_at')
          .eq('id', experienceId)
          .single();

        if (!error && data) {
          data.photos = this.normalizePhotosList(data.photos);
          return data;
        }
      } catch (err) {
        console.warn('Supabase getExperienceById failed, checking local store:', err);
      }
    }

    // Local fallback: search by id in demoStorage
    const store = JSON.parse(localStorage.getItem(this.demoStorageKey) || '{}');
    for (const key of Object.keys(store)) {
      if (store[key].id === experienceId || store[key].public_id === experienceId) {
        const localData = { ...store[key] };
        localData.photos = this.normalizePhotosList(localData.photos);
        return localData;
      }
    }
    return null;
  }

  /**
   * Ensure photos array contains clean, valid image URLs
   */
  normalizePhotosList(rawPhotos) {
    if (!rawPhotos) return [];
    let list = rawPhotos;
    if (typeof rawPhotos === 'string') {
      try {
        list = JSON.parse(rawPhotos);
      } catch (e) {
        list = [rawPhotos];
      }
    }
    if (!Array.isArray(list)) list = [list];

    const bucketName = window.DEARLY_CONFIG?.STORAGE_BUCKET || 'experience-photos';

    return list.map((item) => {
      if (!item) return null;
      if (typeof item === 'string') {
        if (item.startsWith('http://') || item.startsWith('https://') || item.startsWith('data:image/')) {
          return item;
        }
        // If it's a relative storage path (e.g. photos/xyz.jpg)
        if (this.client) {
          const { data } = this.client.storage.from(bucketName).getPublicUrl(item);
          return data?.publicUrl || item;
        }
        return item;
      }
      if (typeof item === 'object') {
        const url = item.url || item.dataUrl || item.src || item.publicUrl;
        if (url) return url;
        if (item.path && this.client) {
          const { data } = this.client.storage.from(bucketName).getPublicUrl(item.path);
          return data?.publicUrl || '';
        }
      }
      return null;
    }).filter(Boolean);
  }

  /**
   * Submit a Two-Way Response from the recipient
   */
  async submitResponse({ publicId, message, recipientName, responseType = 'love_back' }) {
    if (!publicId) {
      return { success: false, error: 'Missing surprise link identifier.' };
    }
    await this.ensureReady();

    const cleanMessage = (message || '').trim().substring(0, 1000);
    const cleanName = (recipientName || '').trim().substring(0, 100);
    const cleanType = responseType || 'love_back';

    // 1. If Supabase is ready and ID is a valid UUID, call the secure RPC function
    if (this.isReady && this.client && this.isValidUuid(publicId)) {
      try {
        const { data, error } = await this.client.rpc('submit_experience_response', {
          p_public_id: publicId,
          p_message: cleanMessage || null,
          p_recipient_name: cleanName || null,
          p_response_type: cleanType
        });

        if (!error && data && data.success) {
          return { success: true, data };
        }

        // If RPC returned a managed error (e.g. not found)
        if (data && data.success === false) {
          return { success: false, error: data.error };
        }

        if (error) {
          console.warn('RPC submit_experience_response error, trying direct fallback:', error.message);
        }
      } catch (rpcErr) {
        console.warn('RPC call failed:', rpcErr);
      }

      // 1b. Fallback direct insert if RPC function was not yet executed in Supabase SQL editor
      try {
        const experience = await this.getExperienceByPublicId(publicId);
        if (!experience) {
          return { success: false, error: 'Gift not found or has been removed.' };
        }

        const { data: respData, error: respErr } = await this.client
          .from('responses')
          .insert([{
            experience_id: experience.id,
            public_id: publicId,
            sender_id: experience.creator_id,
            recipient_name: cleanName || experience.recipient_name,
            message: cleanMessage,
            response_type: cleanType
          }])
          .select('id')
          .single();

        if (respErr) {
          throw respErr;
        }

        // If experience has a creator, insert notification
        if (experience.creator_id) {
          try {
            await this.client.from('notifications').insert([{
              user_id: experience.creator_id,
              experience_id: experience.id,
              response_id: respData.id,
              type: cleanType,
              title: `${cleanName || experience.recipient_name} sent love back to you! 💕`,
              message: cleanMessage,
              is_read: false
            }]);
          } catch (notifErr) {
            console.warn('Notification insert fallback note:', notifErr.message);
          }
        }

        return { success: true, data: { response_id: respData.id, type: cleanType } };
      } catch (directErr) {
        console.warn('Direct Supabase response insert error, saving to local demo store:', directErr.message);
      }
    }

    // 2. Local Demo Mode fallback
    try {
      const respId = 'demo-resp-' + Date.now();
      const demoResponse = {
        id: respId,
        public_id: publicId,
        recipient_name: cleanName || 'Your Loved One',
        message: cleanMessage,
        response_type: cleanType,
        created_at: new Date().toISOString()
      };

      const existingResponses = JSON.parse(localStorage.getItem(this.demoResponsesKey) || '[]');
      existingResponses.unshift(demoResponse);
      localStorage.setItem(this.demoResponsesKey, JSON.stringify(existingResponses));

      // Also create demo notification
      const demoNotification = {
        id: 'demo-notif-' + Date.now(),
        public_id: publicId,
        type: cleanType,
        title: `${cleanName || 'Someone'} sent love back to you! 💕`,
        message: cleanMessage,
        is_read: false,
        created_at: new Date().toISOString()
      };
      const existingNotifs = JSON.parse(localStorage.getItem(this.demoNotificationsKey) || '[]');
      existingNotifs.unshift(demoNotification);
      localStorage.setItem(this.demoNotificationsKey, JSON.stringify(existingNotifs));

      return { success: true, data: demoResponse, isDemo: true };
    } catch (localErr) {
      return { success: false, error: 'Could not record response.' };
    }
  }

  /**
   * Get all experiences for a specific creator user
   */
  async getUserExperiences(userId) {
    await this.ensureReady();
    if (!userId) return [];

    // Security: verify requested userId matches current authenticated user
    let currentAuthId = null;
    if (this.isReady && this.client) {
      try {
        const { data: sessionData } = await this.client.auth.getSession();
        currentAuthId = sessionData?.session?.user?.id;
      } catch (e) {}

      if (!currentAuthId) {
        try {
          const { data: userData } = await this.client.auth.getUser();
          currentAuthId = userData?.user?.id;
        } catch (e) {}
      }
    }

    if (!currentAuthId) {
      const fallbackUser = window.dearlyAuth?.getUser?.();
      currentAuthId = fallbackUser?.id;
    }

    if (!currentAuthId || currentAuthId !== userId) {
      console.warn('Unauthorized attempt to read other user experiences.');
      return [];
    }

    if (this.isReady && this.client) {
      try {
        // Query experiences by creator_id
        const { data: experiences, error } = await this.client
          .from('experiences')
          .select('id, public_id, creator_id, type, sender_name, recipient_name, relationship, nickname, reason, messages, extra_messages, letter, memories, photos, theme, status, created_at, updated_at')
          .eq('creator_id', userId)
          .order('created_at', { ascending: false });

        if (!error && experiences) {
          // Fetch responses count for each experience
          const expIds = experiences.map(e => e.id);
          let responsesMap = {};

          if (expIds.length > 0) {
            try {
              const { data: responses } = await this.client
                .from('responses')
                .select('id, experience_id, message, recipient_name, response_type, created_at')
                .in('experience_id', expIds);

              if (responses) {
                responses.forEach(r => {
                  if (!responsesMap[r.experience_id]) responsesMap[r.experience_id] = [];
                  responsesMap[r.experience_id].push(r);
                });
              }
            } catch (rErr) {
              console.warn('Error fetching response counts:', rErr);
            }
          }

          return experiences.map(exp => ({
            ...exp,
            photos: this.normalizePhotosList(exp.photos),
            responses: responsesMap[exp.id] || []
          }));
        }
      } catch (err) {
        console.warn('Error loading user experiences from Supabase:', err);
      }
    }

    // Local fallback: load local experiences
    const localStore = JSON.parse(localStorage.getItem(this.demoStorageKey) || '{}');
    const localList = Object.values(localStore);
    const demoResponses = JSON.parse(localStorage.getItem(this.demoResponsesKey) || '[]');

    return localList.map(exp => ({
      ...exp,
      photos: this.normalizePhotosList(exp.photos),
      responses: demoResponses.filter(r => r.public_id === exp.public_id)
    }));
  }

  /**
   * Get all gifts saved/bookmarked by this recipient
   */
  async getUserSavedGifts(userId) {
    await this.ensureReady();
    if (!userId) return [];

    let savedList = [];

    if (this.isReady && this.client) {
      try {
        const { data, error } = await this.client
          .from('saved_gifts')
          .select(`
            id, public_id, experience_id, created_at,
            experiences (id, public_id, type, sender_name, recipient_name, relationship, theme, photos, status, created_at)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          savedList = data.map(item => ({
            id: item.id,
            public_id: item.public_id,
            experience_id: item.experience_id,
            saved_at: item.created_at,
            experience: item.experiences ? {
              ...item.experiences,
              photos: this.normalizePhotosList(item.experiences.photos)
            } : null
          }));
        }
      } catch (err) {
        console.warn('Error fetching saved_gifts from Supabase:', err);
      }
    }

    // Merge with local account bookmarks or device bookmarks
    const acctKey = `dearly_saved_gifts_${userId}`;
    const localSaved = JSON.parse(localStorage.getItem(acctKey) || '[]');
    localSaved.forEach(localItem => {
      if (!savedList.some(s => s.public_id === localItem.public_id || (s.experience_id && s.experience_id === localItem.experience_id))) {
        savedList.push(localItem);
      }
    });

    return savedList;
  }

  /**
   * Recipient saves a gift to their account or local bookmarks
   */
  async saveRecipientGift(publicId, experienceId) {
    await this.ensureReady();
    if (!publicId && !experienceId) {
      return { success: false, error: 'Missing gift identifier.' };
    }

    const user = window.dearlyAuth?.getUser?.();

    // 1. If authenticated, save to Supabase saved_gifts table
    if (this.isReady && this.client && user) {
      try {
        let targetExpId = experienceId;
        if (!targetExpId) {
          const exp = await this.getExperienceByPublicId(publicId);
          if (exp) targetExpId = exp.id;
        }

        if (targetExpId) {
          const { error } = await this.client
            .from('saved_gifts')
            .upsert([
              {
                user_id: user.id,
                experience_id: targetExpId,
                public_id: publicId
              }
            ], { onConflict: 'user_id,experience_id' });

          if (error) throw error;
        }

        // Cache in user account localStorage
        const acctKey = `dearly_saved_gifts_${user.id}`;
        const existing = JSON.parse(localStorage.getItem(acctKey) || '[]');
        if (!existing.some(g => g.public_id === publicId || (targetExpId && g.experience_id === targetExpId))) {
          existing.unshift({
            public_id: publicId,
            experience_id: targetExpId,
            saved_at: new Date().toISOString()
          });
          localStorage.setItem(acctKey, JSON.stringify(existing));
        }

        return { success: true, isLocal: false };
      } catch (err) {
        console.warn('Saving to Supabase saved_gifts failed, saving locally:', err);
      }
    }

    // 2. Local Bookmark fallback (for device storage or unauthenticated users)
    const localStoreKey = 'dearly_bookmarked_gifts';
    const bookmarks = JSON.parse(localStorage.getItem(localStoreKey) || '[]');
    if (!bookmarks.some(b => b.public_id === publicId || (experienceId && b.experience_id === experienceId))) {
      bookmarks.unshift({
        public_id: publicId,
        experience_id: experienceId,
        saved_at: new Date().toISOString()
      });
      localStorage.setItem(localStoreKey, JSON.stringify(bookmarks));
    }

    return { success: true, isLocal: true };
  }

  /**
   * Remove a gift from the recipient's saved list
   * (Does NOT delete the sender's original experience)
   */
  async removeSavedGift(giftIdOrPublicId) {
    await this.ensureReady();
    const user = window.dearlyAuth?.getUser?.();

    if (this.isReady && this.client && user) {
      try {
        await this.client
          .from('saved_gifts')
          .delete()
          .eq('user_id', user.id)
          .or(`id.eq.${giftIdOrPublicId},experience_id.eq.${giftIdOrPublicId},public_id.eq.${giftIdOrPublicId}`);

        const acctKey = `dearly_saved_gifts_${user.id}`;
        const existing = JSON.parse(localStorage.getItem(acctKey) || '[]');
        const updated = existing.filter(g => g.id !== giftIdOrPublicId && g.public_id !== giftIdOrPublicId && g.experience_id !== giftIdOrPublicId);
        localStorage.setItem(acctKey, JSON.stringify(updated));
      } catch (err) {
        console.warn('Error removing from Supabase saved_gifts:', err);
      }
    }

    // Also remove from local bookmarks
    const localStoreKey = 'dearly_bookmarked_gifts';
    const bookmarks = JSON.parse(localStorage.getItem(localStoreKey) || '[]');
    const updatedBookmarks = bookmarks.filter(b => b.id !== giftIdOrPublicId && b.public_id !== giftIdOrPublicId && b.experience_id !== giftIdOrPublicId);
    localStorage.setItem(localStoreKey, JSON.stringify(updatedBookmarks));

    return { success: true };
  }

  /**
   * Check if a gift is currently saved by recipient
   */
  async isGiftSaved(publicId, experienceId) {
    const user = window.dearlyAuth?.getUser?.();
    if (!publicId && !experienceId) return false;

    // Check device local bookmarks first
    const localStoreKey = 'dearly_bookmarked_gifts';
    const bookmarks = JSON.parse(localStorage.getItem(localStoreKey) || '[]');
    if (bookmarks.some(b => (publicId && b.public_id === publicId) || (experienceId && b.experience_id === experienceId))) {
      return true;
    }

    if (user) {
      const acctKey = `dearly_saved_gifts_${user.id}`;
      const acctSaved = JSON.parse(localStorage.getItem(acctKey) || '[]');
      if (acctSaved.some(b => (publicId && b.public_id === publicId) || (experienceId && b.experience_id === experienceId))) {
        return true;
      }

      if (this.isReady && this.client) {
        try {
          const { data } = await this.client
            .from('saved_gifts')
            .select('id')
            .eq('user_id', user.id)
            .or(`public_id.eq.${publicId},experience_id.eq.${experienceId}`)
            .limit(1);

          return Boolean(data && data.length > 0);
        } catch (e) {
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Get notifications for an authenticated sender
   */
  async getUserNotifications(userId) {
    await this.ensureReady();
    if (!userId) return [];

    // Security: verify requested userId matches current authenticated user
    let currentAuthId = null;
    if (this.isReady && this.client) {
      try {
        const { data: sessionData } = await this.client.auth.getSession();
        currentAuthId = sessionData?.session?.user?.id;
      } catch (e) {}

      if (!currentAuthId) {
        try {
          const { data: userData } = await this.client.auth.getUser();
          currentAuthId = userData?.user?.id;
        } catch (e) {}
      }
    }

    if (!currentAuthId) {
      const fallbackUser = window.dearlyAuth?.getUser?.();
      currentAuthId = fallbackUser?.id;
    }

    if (!currentAuthId || currentAuthId !== userId) {
      console.warn('Unauthorized attempt to read other user notifications.');
      return [];
    }

    if (this.isReady && this.client) {
      try {
        const { data, error } = await this.client
          .from('notifications')
          .select(`
            id, user_id, experience_id, response_id, type, title, message, is_read, created_at,
            experiences (public_id, type, recipient_name, sender_name)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('Error fetching notifications from Supabase:', err);
      }
    }

    // Local Demo fallback
    return JSON.parse(localStorage.getItem(this.demoNotificationsKey) || '[]');
  }

  /**
   * Mark a notification as read
   */
  async markNotificationAsRead(notificationId) {
    await this.ensureReady();
    if (this.isReady && this.client) {
      try {
        await this.client
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId);
        return true;
      } catch (e) {
        console.warn('Error marking notification as read:', e);
      }
    }

    // Local fallback
    try {
      const notifs = JSON.parse(localStorage.getItem(this.demoNotificationsKey) || '[]');
      const target = notifs.find(n => n.id === notificationId);
      if (target) target.is_read = true;
      localStorage.setItem(this.demoNotificationsKey, JSON.stringify(notifs));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsAsRead(userId) {
    await this.ensureReady();
    if (this.isReady && this.client && userId) {
      try {
        await this.client
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userId);
        return true;
      } catch (e) {
        console.warn('Error marking all notifications as read:', e);
      }
    }

    // Local fallback
    try {
      const notifs = JSON.parse(localStorage.getItem(this.demoNotificationsKey) || '[]');
      notifs.forEach(n => (n.is_read = true));
      localStorage.setItem(this.demoNotificationsKey, JSON.stringify(notifs));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Delete an experience created by the authenticated user
   */
  async deleteExperience(experienceId) {
    await this.ensureReady();
    if (this.isReady && this.client) {
      try {
        const { error } = await this.client
          .from('experiences')
          .delete()
          .eq('id', experienceId);

        if (error) throw error;
        return { success: true };
      } catch (err) {
        console.error('Error deleting experience:', err);
        return { success: false, error: err.message };
      }
    }

    // Local fallback
    try {
      const store = JSON.parse(localStorage.getItem(this.demoStorageKey) || '{}');
      for (const key of Object.keys(store)) {
        if (store[key].id === experienceId || store[key].public_id === experienceId) {
          delete store[key];
        }
      }
      localStorage.setItem(this.demoStorageKey, JSON.stringify(store));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Setup Realtime subscription for incoming notifications
   */
  subscribeToUserNotifications(userId, callback) {
    if (!this.isReady || !this.client || !userId) return null;

    try {
      const channel = this.client
        .channel(`user-notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('🔔 Live notification received:', payload.new);
            if (typeof callback === 'function') {
              callback(payload.new);
            }
          }
        )
        .subscribe();

      return channel;
    } catch (err) {
      console.warn('Realtime subscription note:', err);
      return null;
    }
  }

  // --- Helpers for local tracking and fallback ---

  trackLocallyCreatedId(publicId, id) {
    try {
      const tracked = JSON.parse(localStorage.getItem('dearly_user_created_ids') || '[]');
      if (!tracked.includes(publicId)) tracked.push(publicId);
      localStorage.setItem('dearly_user_created_ids', JSON.stringify(tracked));
    } catch (e) {}
  }

  saveToLocalDemo(publicId, payload) {
    try {
      const store = JSON.parse(localStorage.getItem(this.demoStorageKey) || '{}');
      store[publicId] = payload;
      localStorage.setItem(this.demoStorageKey, JSON.stringify(store));
    } catch (e) {
      console.warn('Local storage error:', e);
    }
  }

  getFromLocalDemo(publicId) {
    try {
      const store = JSON.parse(localStorage.getItem(this.demoStorageKey) || '{}');
      return store[publicId] || null;
    } catch (e) {
      return null;
    }
  }

  generateFallbackUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// Global instance
window.dearlyDB = new DearlyDatabaseService();
