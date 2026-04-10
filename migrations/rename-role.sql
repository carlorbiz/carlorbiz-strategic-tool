-- Migration: Rename acrrm_admin role to client_admin
-- Run this against client Supabase instances when deploying from this template
UPDATE user_profiles SET role = 'client_admin' WHERE role = 'acrrm_admin';
