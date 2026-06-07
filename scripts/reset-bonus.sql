-- Reset des bonus au début de la compétition
-- À exécuter dans le Supabase Dashboard > SQL Editor

UPDATE public.cdm_user_bonuses
SET remaining_uses = total_uses;
