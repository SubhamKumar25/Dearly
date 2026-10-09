/**
 * DEARLY — Global Configuration
 * 
 * Instructions:
 * 1. Create a free project at https://supabase.com
 * 2. Copy your Project URL and Anon/Public Key from Project Settings -> API
 * 3. Paste them below into SUPABASE_URL and SUPABASE_ANON_KEY
 * 
 * Note: If left with placeholders, DEARLY will automatically run in
 * "Local Demo Mode" using browser storage so you can test all features immediately!
 */

const DEARLY_CONFIG = {
  // Configured Supabase project URL:
  SUPABASE_URL: 'https://fxkuietohwiajllzjakc.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a3VpZXRvaHdpYWpsbHpqYWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MTE4MDYsImV4cCI6MjEwNzA4NzgwNn0.8FkvY8M3D5-aac4xr-wYIwMmgBHKhLeMQl_Z-YQu56M',
  
  // Storage bucket name as defined in supabase-schema.sql
  STORAGE_BUCKET: 'experience-photos',

  // Maximum photo upload size in bytes (5 MB)
  MAX_PHOTO_SIZE_BYTES: 5 * 1024 * 1024,

  // Maximum number of photos allowed per experience
  MAX_PHOTOS_COUNT: 5,

  // Allowed image MIME types
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],

  // App domain for sharing (falls back to window.location.origin)
  APP_URL: window.location.origin
};

// Check if valid Supabase configuration is present
function isSupabaseConfigured() {
  return (
    DEARLY_CONFIG.SUPABASE_URL &&
    DEARLY_CONFIG.SUPABASE_ANON_KEY &&
    !DEARLY_CONFIG.SUPABASE_URL.includes('xyzcompany') &&
    !DEARLY_CONFIG.SUPABASE_ANON_KEY.includes('PASTE_YOUR_ANON_KEY') &&
    !DEARLY_CONFIG.SUPABASE_ANON_KEY.includes('dummy_anon_key')
  );
}

window.DEARLY_CONFIG = DEARLY_CONFIG;
window.isSupabaseConfigured = isSupabaseConfigured;
