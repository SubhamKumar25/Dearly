# DEARLY — Turn your feelings into a moment. 💌

**DEARLY** is a free, beautiful, mobile-first web platform where users craft personalized, animated interactive digital gifts for people they care about.

Creators choose a moment (**Love**, **Apology**, **Birthday**, or **Proposal**), enter names, notes, and photos, preview the recipient experience, and generate a private, secure shareable link. The recipient opens that link and is treated to a heartwarming, animated story created just for them.

---

## 🌟 Key Features

- **Four Emotional Categories**:
  - **Love 💕**: Celebrate partners, friends, or family with sweet notes, nicknames, and photos.
  - **Apology 🕊️**: Sincere reconciliation with honest reasons, heartfelt messages, and reassurance.
  - **Birthday 🎂**: Festive celebration with wishes, favorite memories, and an interactive birthday cake candle to blow out!
  - **Proposal 💍**: Grand romantic buildup to the big question with a playful "YES!" interaction.
- **Interactive Recipient Stories**: Full-screen story cards, animated wax-sealed envelope opening, sequence cards, polaroid photo memories, handwritten letters, and category-tailored finales.
- **Ambient Audio**: Calming pentatonic melody synthesizer powered by the Web Audio API with zero external dependencies, respecting autoplay policies with user toggle.
- **Zero Build Tools**: Plain HTML5, Vanilla CSS3 (custom properties, responsive layout), and Vanilla JavaScript (ES6+).
- **Supabase Cloud Backend**: Secure PostgreSQL database, Row Level Security (RLS) policies, and Supabase Storage for memory photos.
- **Instant Local Demo Mode**: Works immediately out of the box in the browser even before setting up Supabase keys!
- **Share Options**: One-click Copy Link, pre-filled WhatsApp sharing, and Web Share API.
- **Hostinger Shared Hosting Ready**: Direct upload to Hostinger `public_html/` with `.htaccess` for clean URLs and HTTPS.

---

## 📂 Project Structure

```
dearly/
├── index.html              # Homepage (Hero, Categories, How it works, FAQ)
├── create.html             # Reusable Creator Wizard engine
├── preview.html            # Live Recipient Story simulator & Share modal
├── surprise.html           # Full-screen Recipient Interactive Story
├── 404.html                # Friendly custom 404 error page
├── .htaccess               # Apache config (Clean URLs, Gzip, Security, HTTPS)
├── supabase-schema.sql     # Complete PostgreSQL schema, RLS policies, Storage
├── DEPLOYMENT.md           # Step-by-step Hostinger & Supabase deployment guide
├── README.md               # Project documentation & testing guide
└── assets/
    ├── css/
    │   ├── style.css       # Design tokens, typography, pastel layout, forms
    │   └── animations.css  # Ambient particles, envelopes, polaroids, candles
    ├── js/
    │   ├── config.js       # Supabase credentials & upload settings
    │   ├── supabase.js     # Supabase client wrapper & local storage fallback
    │   ├── wizard.js       # Reusable wizard engine & category configurations
    │   ├── preview.js      # Preview coordinator & publishing service
    │   ├── recipient.js    # Multi-screen animated story presentation
    │   ├── audio.js        # Web Audio API ambient sound & chimes
    │   └── main.js         # Navigation, drawer, FAQs, and ambient effects
    └── images/
        └── logo.svg        # Original DEARLY envelope & heart wordmark
```

---

## 🚀 Quick Start (Local Testing)

1. You can test the platform locally right now without any server or build step!
2. Simply double click `index.html` or run a local static server:
   ```bash
   npx serve .
   # or Python
   python -m http.server 8000
   ```
3. Open `http://localhost:8000` or file path in any browser.
4. Try creating an experience in each category. DEARLY will run in **Local Demo Mode** using browser storage until you link your Supabase credentials.

---

## ☁️ Connecting Supabase (Production)

### 1. Create a Free Supabase Project
1. Visit [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**, choose a project name (e.g. `dearly-app`) and set a strong database password.

### 2. Run Database Schema
1. In the Supabase Dashboard, open **SQL Editor** from the left navigation.
2. Click **New Query**, paste the entire contents of [`supabase-schema.sql`](file:///d:/Dearly/supabase-schema.sql), and click **Run**.
3. This creates:
   - `experiences` table with UUID keys and constraints.
   - Row Level Security (RLS) policies ensuring public read-only access to published experiences by `public_id`, and creator ownership for writes.
   - `experience-photos` storage bucket for uploaded images with public read policies.

### 3. Configure Credentials in DEARLY
1. Go to Supabase Dashboard -> **Project Settings** -> **API**.
2. Copy your **Project URL** and **anon / public key**.
3. Open [`assets/js/config.js`](file:///d:/Dearly/assets/js/config.js) and replace the placeholder values:
   ```javascript
   const DEARLY_CONFIG = {
     SUPABASE_URL: 'https://your-project-id.supabase.co',
     SUPABASE_ANON_KEY: 'your-anon-public-key-here',
     STORAGE_BUCKET: 'experience-photos',
     // ...
   };
   ```

---

## 🌐 Deploying to Hostinger Shared Hosting

See [`DEPLOYMENT.md`](file:///d:/Dearly/DEPLOYMENT.md) for the detailed step-by-step visual deployment guide.

In brief:
1. Open Hostinger **hPanel** -> **File Manager** (or connect via FTP).
2. Navigate to `public_html/`.
3. Upload all files from this directory (`index.html`, `create.html`, `preview.html`, `surprise.html`, `404.html`, `.htaccess`, and the `assets/` folder).
4. Ensure your free SSL certificate is active in Hostinger under **Security -> SSL**.
5. Your platform is live at `https://yourdomain.com`!

---

## 🔒 Security & Privacy (Row Level Security)

- **No Secrets in Frontend**: Only the public `anon` key is used in the browser. The sensitive `service_role` key is **never** included or required in the client code.
- **Row Level Security**: The database allows public reads **only** for rows where `status = 'published'`, preventing scraping of drafts or unauthorized user data.
- **Unguessable IDs**: Experiences are shared via UUID `public_id`, preventing sequential enumeration of gifts.
- **Storage Protection**: Uploads are restricted to allowed image MIME types and file size limits (5MB) per photo.
- **Anonymous Identity**: Creators maintain ownership of their created items through Supabase Anonymous Authentication without requiring personal email or passwords.

---

## 📱 Mobile Responsiveness

DEARLY has been crafted and tested for mobile screen widths:
- `360px` (Compact Android)
- `375px` (iPhone SE)
- `390px` (iPhone 12/13/14)
- `412px` (Google Pixel / Samsung Galaxy)
- `430px` (iPhone Pro Max)
- Tablets & Desktops
