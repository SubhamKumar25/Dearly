# DEARLY — Hostinger & Supabase Deployment Guide 🚀

This beginner-friendly guide walks you through deploying **DEARLY** to Hostinger Shared Hosting and connecting a free Supabase cloud database with secure Row Level Security (RLS).

---

## Part 1: Supabase Setup (Database & Storage)

### Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and click **Start your project** (or sign in).
2. Click **New Project**.
3. Choose an organization, enter a project name (e.g. `dearly`), choose a strong Database Password, and select the region closest to your users.
4. Click **Create new project** and wait 1–2 minutes for the database to provision.

### Step 2: Run the Database Schema
1. In the Supabase Dashboard, look at the left sidebar and click on **SQL Editor** (icon looking like `>_` or SQL).
2. Click **New query** (or the **+** button).
3. Open the file `supabase-schema.sql` from the DEARLY project files on your computer and copy all its contents.
4. Paste the SQL code into the Supabase SQL Editor.
5. Click the green **Run** button at the bottom right.
6. You should see a success message: `Success. No rows returned`.
   *(This creates the `experiences` table, indexes, trigger, and Row Level Security policies!)*

### Step 3: Verify the Storage Bucket
1. Click **Storage** in the left sidebar.
2. You will see a bucket named `experience-photos`.
3. Verify that its badge says **Public** (required so recipients can view uploaded memory photos in their browser).
   *(If it was not created by the SQL script for any reason, click **New bucket**, name it `experience-photos`, check the **Public bucket** toggle, set file size limit to `5MB`, and click Save.)*

### Step 4: Enable Anonymous Sign-ins in Supabase
1. In the left sidebar, click **Authentication** -> **Providers**.
2. Click on **Anonymous** in the list of Auth Providers.
3. Toggle **Enable Anonymous Sign-ins** to **ON** and click **Save**.
   *(This gives every creator a unique anonymous identifier without forcing them to register with email/passwords!)*

### Step 5: Copy Your Project API Credentials
1. Click the **Settings** (gear icon) in the bottom-left sidebar.
2. Select **API**.
3. Locate the **Project URL** (looks like `https://abcdefghijklm.supabase.co`).
4. Locate the **Project API keys** section and copy the key labeled **`anon` `public`**.
   > ⚠️ **CRITICAL SECURITY RULE:**
   > - **`anon` / `public` Key**: This is SAFE to put in your website's JavaScript.
   > - **`service_role` Key**: NEVER put this key in any frontend code or upload it to your website. It bypasses all security rules and must remain secret.

### Step 6: Configure DEARLY Configuration File
1. On your computer, open `assets/js/config.js` in any text editor.
2. Replace the placeholder values with your real URL and anon key:
   ```javascript
   const DEARLY_CONFIG = {
     SUPABASE_URL: 'https://your-project-id.supabase.co',
     SUPABASE_ANON_KEY: 'your-anon-key-here',
     STORAGE_BUCKET: 'experience-photos',
     MAX_PHOTO_SIZE_BYTES: 5 * 1024 * 1024,
     MAX_PHOTOS_COUNT: 5,
     ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
     APP_URL: window.location.origin
   };
   ```
3. Save the file.

---

## Part 2: Hostinger Deployment (public_html)

No Node.js, build commands, or npm packages are needed. The entire project is pure, standard HTML, CSS, and JavaScript.

### Step 1: Log in to Hostinger hPanel
1. Go to [https://hpanel.hostinger.com](https://hpanel.hostinger.com) and log in.
2. Click on **Websites** and click **Manage** next to your domain.

### Step 2: Open File Manager
1. In the hPanel dashboard, find **Files** -> **File Manager** (or click **Access files of [your domain]**).
2. Double-click to open the `public_html` directory.
3. If there is a default Hostinger `default.php` file, you can delete it or rename it.

### Step 3: Upload the DEARLY Files
Upload all files and folders so that the structure inside `public_html` looks like this:

```
public_html/
├── index.html
├── create.html
├── preview.html
├── surprise.html
├── 404.html
├── .htaccess
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   └── animations.css
│   ├── js/
│   │   ├── config.js
│   │   ├── supabase.js
│   │   ├── wizard.js
│   │   ├── preview.js
│   │   ├── recipient.js
│   │   ├── audio.js
│   │   └── main.js
│   └── images/
│       └── logo.svg
```

*(Tip: You can zip these files on your computer, upload the `.zip` to `public_html`, and use Hostinger's "Extract" button to unpack them directly!)*

### Step 4: Ensure HTTPS / SSL is Active
1. In Hostinger hPanel, go to **Security** -> **SSL**.
2. Make sure the Lifetime Free SSL status for your domain is **Active**.
3. The included `.htaccess` file automatically redirects any `http://` traffic to secure `https://`.

---

## Part 3: Testing & Verification Checklist

Follow this checklist to verify your live deployment:

- [ ] **Homepage**: Visit `https://yourdomain.com` in your mobile and desktop browsers. Verify navbar logo, hero buttons, category cards, How It Works, and FAQ accordion.
- [ ] **Mobile Menu**: Shrink window or test on smartphone; verify hamburger menu drawer opens and closes smoothly.
- [ ] **Wizard Step Navigation**:
  - Click **Love**: verify 4 steps, role pills (Girlfriend, Boyfriend, etc.), character counters, and Back/Next buttons.
  - Click **Apology**: verify reasons, custom reason toggle when selecting "Something else", English/Hinglish suggestion chips (tap to insert).
  - Click **Birthday**: verify cake & memory inputs.
  - Click **Proposal**: verify proposal question and emotional letter.
- [ ] **Photo Upload**:
  - Add 1–3 photos (JPG or PNG). Verify thumbnail preview and delete (✕) button works.
  - Verify skip works if no photos are selected.
- [ ] **Validation**: Try clicking "Continue" without required fields; verify gentle shake and toast notification.
- [ ] **Preview Experience**: Click "Preview Your Experience ✨"; verify you can step through the recipient story (Opening Envelope -> Messages -> Photos -> Letter -> Final Reveal).
- [ ] **Publishing**: Click "Create & Share"; verify loading spinner finishes and displays the share link.
- [ ] **Copy & WhatsApp**: Click "Copy Link" (verifying "Copied! 💌" visual change) and click "Share on WhatsApp" to verify pre-formatted message.
- [ ] **Cross-Device Recipient Test**: Copy the generated link and open it on a different phone or incognito browser. Verify the recipient sees the private interactive story with ambient sound toggle and no creator forms.
- [ ] **404 Handling**: Visit `https://yourdomain.com/random-page` and verify the cute DEARLY 404 page appears.
