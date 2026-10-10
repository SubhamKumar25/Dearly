-- =============================================================================
-- DEARLY — Supabase PostgreSQL Schema & Security Policies (v2.0)
-- Includes Experiences, Sender Auth, Two-Way Responses, Notifications & Storage
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
    extra_messages JSONB DEFAULT '[]'::jsonb,
    letter TEXT,
    memories JSONB DEFAULT '[]'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    theme VARCHAR(64) DEFAULT 'default',
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    first_opened_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_experiences_public_id ON public.experiences(public_id);
CREATE INDEX IF NOT EXISTS idx_experiences_creator_id ON public.experiences(creator_id);
CREATE INDEX IF NOT EXISTS idx_experiences_status ON public.experiences(status);

-- Enable RLS
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;

-- Experiences RLS Policies
DROP POLICY IF EXISTS "Public can view published experiences" ON public.experiences;
CREATE POLICY "Public can view published experiences"
    ON public.experiences
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'published'
        OR (auth.uid() IS NOT NULL AND auth.uid() = creator_id)
    );

DROP POLICY IF EXISTS "Users can insert their own experiences" ON public.experiences;
CREATE POLICY "Users can insert their own experiences"
    ON public.experiences
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IS NOT NULL AND creator_id = auth.uid()
    );

DROP POLICY IF EXISTS "Creators can update their own drafts" ON public.experiences;
CREATE POLICY "Creators can update their own drafts"
    ON public.experiences
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = creator_id)
    WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can delete their own experiences" ON public.experiences;
CREATE POLICY "Creators can delete their own experiences"
    ON public.experiences
    FOR DELETE
    TO authenticated
    USING (auth.uid() = creator_id);

-- Trigger to automatically update updated_at timestamp
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

-- 3. Create responses table (for Two-Way Love Response System)
CREATE TABLE IF NOT EXISTS public.responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
    public_id UUID NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recipient_name VARCHAR(100),
    message TEXT,
    response_type VARCHAR(50) NOT NULL DEFAULT 'love_back',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_responses_experience_id ON public.responses(experience_id);
CREATE INDEX IF NOT EXISTS idx_responses_public_id ON public.responses(public_id);
CREATE INDEX IF NOT EXISTS idx_responses_sender_id ON public.responses(sender_id);
CREATE INDEX IF NOT EXISTS idx_responses_created_at ON public.responses(created_at DESC);

ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators can view responses to their surprises" ON public.responses;
CREATE POLICY "Creators can view responses to their surprises"
    ON public.responses
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = sender_id
        OR auth.uid() IN (SELECT creator_id FROM public.experiences WHERE id = responses.experience_id)
    );

DROP POLICY IF EXISTS "Creators can delete responses to their surprises" ON public.responses;
CREATE POLICY "Creators can delete responses to their surprises"
    ON public.responses
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() = sender_id
        OR auth.uid() IN (SELECT creator_id FROM public.experiences WHERE id = responses.experience_id)
    );

-- 4. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    experience_id UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
    response_id UUID REFERENCES public.responses(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'love_back',
    title VARCHAR(200) NOT NULL,
    message TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
    ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
    ON public.notifications
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. Create saved_gifts table (Recipient Bookmarks / Saved Gifts)
CREATE TABLE IF NOT EXISTS public.saved_gifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    experience_id UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
    public_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, experience_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_gifts_user_id ON public.saved_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_gifts_experience_id ON public.saved_gifts(experience_id);
CREATE INDEX IF NOT EXISTS idx_saved_gifts_created_at ON public.saved_gifts(created_at DESC);

ALTER TABLE public.saved_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own saved gifts" ON public.saved_gifts;
CREATE POLICY "Users can view their own saved gifts"
    ON public.saved_gifts
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add their own saved gifts" ON public.saved_gifts;
CREATE POLICY "Users can add their own saved gifts"
    ON public.saved_gifts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their own saved gifts" ON public.saved_gifts;
CREATE POLICY "Users can remove their own saved gifts"
    ON public.saved_gifts
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 6. Secure Recipient Response Submission RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.submit_experience_response(
    p_public_id UUID,
    p_message TEXT DEFAULT NULL,
    p_recipient_name TEXT DEFAULT NULL,
    p_response_type TEXT DEFAULT 'love_back'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_experience RECORD;
    v_response_id UUID;
    v_recipient_display VARCHAR(100);
    v_notification_title VARCHAR(200);
    v_clean_message TEXT;
    v_type VARCHAR(50);
BEGIN
    SELECT id, creator_id, sender_name, recipient_name, type
    INTO v_experience
    FROM public.experiences
    WHERE public_id = p_public_id AND status = 'published';

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Experience not found or is not published.'
        );
    END IF;

    v_clean_message := NULLIF(TRIM(p_message), '');
    IF v_clean_message IS NOT NULL AND LENGTH(v_clean_message) > 1000 THEN
        v_clean_message := SUBSTRING(v_clean_message FROM 1 FOR 1000);
    END IF;

    v_recipient_display := COALESCE(NULLIF(TRIM(p_recipient_name), ''), v_experience.recipient_name, 'Someone');
    IF LENGTH(v_recipient_display) > 100 THEN
        v_recipient_display := SUBSTRING(v_recipient_display FROM 1 FOR 100);
    END IF;

    v_type := COALESCE(NULLIF(TRIM(p_response_type), ''), 'love_back');
    IF LENGTH(v_type) > 50 THEN
        v_type := 'love_back';
    END IF;

    INSERT INTO public.responses (
        experience_id,
        public_id,
        sender_id,
        recipient_name,
        message,
        response_type
    ) VALUES (
        v_experience.id,
        p_public_id,
        v_experience.creator_id,
        v_recipient_display,
        v_clean_message,
        v_type
    )
    RETURNING id INTO v_response_id;

    IF v_experience.creator_id IS NOT NULL THEN
        IF v_type = 'forgive' THEN
            v_notification_title := v_recipient_display || ' sent forgiveness back to you! 🕊️';
        ELSEIF v_type = 'yes' THEN
            v_notification_title := v_recipient_display || ' said YES to your proposal! 💍💖';
        ELSEIF v_type = 'wish' THEN
            v_notification_title := v_recipient_display || ' made a wish and thanked you! 🎂';
        ELSE
            v_notification_title := v_recipient_display || ' sent love back to you! 💕';
        END IF;

        INSERT INTO public.notifications (
            user_id,
            experience_id,
            response_id,
            type,
            title,
            message,
            is_read
        ) VALUES (
            v_experience.creator_id,
            v_experience.id,
            v_response_id,
            v_type,
            v_notification_title,
            v_clean_message,
            false
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'response_id', v_response_id,
        'recipient_name', v_recipient_display,
        'type', v_type
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_experience_response(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 6. Storage Bucket Configuration (Idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'experience-photos',
    'experience-photos',
    true,
    2097152, -- 2 MB limit per photo
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- Explicitly ensure public visibility on experience-photos bucket
UPDATE storage.buckets SET public = true WHERE id = 'experience-photos';

DROP POLICY IF EXISTS "Public read for experience photos" ON storage.objects;
CREATE POLICY "Public read for experience photos"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'experience-photos');

DROP POLICY IF EXISTS "Users can upload experience photos" ON storage.objects;
CREATE POLICY "Users can upload experience photos"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'experience-photos'
        AND (storage.foldername(name))[1] = 'photos'
    );

DROP POLICY IF EXISTS "Users can delete their uploaded photos" ON storage.objects;
CREATE POLICY "Users can delete their uploaded photos"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'experience-photos'
        AND owner = auth.uid()
    );

-- 7. Realtime Publications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
