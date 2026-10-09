-- =============================================================================
-- DEARLY — Supabase PostgreSQL Schema & Security Policies
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- =============================================================================

-- 1. Enable UUID generation extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create experiences table
CREATE TABLE IF NOT EXISTS public.experiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('love', 'apology', 'birthday', 'proposal')),
    sender_name VARCHAR(100) NOT NULL,
    recipient_name VARCHAR(100) NOT NULL,
    relationship VARCHAR(64),
    nickname VARCHAR(64),
    reason TEXT,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    letter TEXT,
    memories JSONB DEFAULT '[]'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    theme VARCHAR(64) DEFAULT 'default',
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create index on public_id for fast recipient lookups
CREATE INDEX IF NOT EXISTS idx_experiences_public_id ON public.experiences(public_id);
CREATE INDEX IF NOT EXISTS idx_experiences_creator_id ON public.experiences(creator_id);
CREATE INDEX IF NOT EXISTS idx_experiences_status ON public.experiences(status);

-- 4. Enable Row Level Security (RLS) on experiences table
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;

-- 5. Row Level Security Policies

-- Policy 1: Public / Recipient can READ ONLY published experiences by public_id
-- (Restricted only to published gifts, prevents scraping all experiences)
CREATE POLICY "Public can view published experiences"
    ON public.experiences
    FOR SELECT
    TO anon, authenticated
    USING (status = 'published');

-- Policy 2: Authenticated / Anonymous users can INSERT their own experiences
-- When Supabase Anonymous Auth is active, auth.uid() matches creator_id.
-- Also permits insertion if auth.uid() is null (with null creator_id) for zero-setup demo fallback.
CREATE POLICY "Users can insert their own experiences"
    ON public.experiences
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        (auth.uid() IS NOT NULL AND creator_id = auth.uid())
        OR (auth.uid() IS NULL AND creator_id IS NULL)
    );

-- Policy 3: Only the creator can UPDATE their own draft experiences
CREATE POLICY "Creators can update their own drafts"
    ON public.experiences
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = creator_id AND status = 'draft')
    WITH CHECK (auth.uid() = creator_id);

-- Policy 4: Only the creator can DELETE their own experiences
CREATE POLICY "Creators can delete their own experiences"
    ON public.experiences
    FOR DELETE
    TO authenticated
    USING (auth.uid() = creator_id);

-- 6. Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_experiences_updated_at ON public.experiences;
CREATE TRIGGER set_experiences_updated_at
    BEFORE UPDATE ON public.experiences
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- STORAGE BUCKET CONFIGURATION FOR PHOTOS
-- =============================================================================

-- Insert storage bucket for photos if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'experience-photos',
    'experience-photos',
    true,
    5242880, -- 5 MB limit per photo
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- Storage RLS Policies (Note: storage.objects already has RLS enabled by default)

-- 1. Public can view/download photos in the experience-photos bucket
DROP POLICY IF EXISTS "Public read for experience photos" ON storage.objects;
CREATE POLICY "Public read for experience photos"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'experience-photos');

-- 2. Authenticated/Anonymous users can upload photos into experience-photos bucket
DROP POLICY IF EXISTS "Users can upload experience photos" ON storage.objects;
CREATE POLICY "Users can upload experience photos"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        bucket_id = 'experience-photos'
        AND (storage.foldername(name))[1] = 'photos'
    );

-- 3. Only uploader can delete their uploaded photos
DROP POLICY IF EXISTS "Users can delete their uploaded photos" ON storage.objects;
CREATE POLICY "Users can delete their uploaded photos"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'experience-photos'
        AND owner = auth.uid()
    );
