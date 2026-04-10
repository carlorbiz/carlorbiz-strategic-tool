import { supabase } from './supabase';

export interface FollowUpContact {
  id: string;
  name: string;
  contact_method: 'email' | 'phone' | 'teams';
  contact_details: string;
  availability_notes: string | null;
  status: 'pending' | 'contacted' | 'completed' | 'declined';
  admin_notes: string | null;
  created_at: string;
}

export type FollowUpSubmission = Pick<
  FollowUpContact,
  'name' | 'contact_method' | 'contact_details' | 'availability_notes'
>;

/** Submit a follow-up contact form (public, no auth required) */
export async function submitFollowUp(
  data: FollowUpSubmission
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Not connected' };

  const { error } = await supabase
    .from('follow_up_contacts')
    .insert({
      name: data.name.trim(),
      contact_method: data.contact_method,
      contact_details: data.contact_details.trim(),
      availability_notes: data.availability_notes?.trim() || null,
    });

  if (error) {
    console.error('Follow-up submission error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Load all follow-up contacts (admin only) */
export async function loadFollowUpContacts(
  statusFilter?: string
): Promise<FollowUpContact[]> {
  if (!supabase) return [];

  let query = supabase
    .from('follow_up_contacts')
    .select('*')
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    // Silence missing table error (PGRST205) — table may not exist in this project
    if (error.code !== 'PGRST205') console.error('Error loading follow-up contacts:', error);
    return [];
  }
  return (data ?? []) as FollowUpContact[];
}

/** Update follow-up contact status (admin only) */
export async function updateFollowUpStatus(
  id: string,
  status: FollowUpContact['status'],
  adminNotes?: string
): Promise<boolean> {
  if (!supabase) return false;

  const update: Record<string, unknown> = { status };
  if (adminNotes !== undefined) {
    update.admin_notes = adminNotes;
  }

  const { error } = await supabase
    .from('follow_up_contacts')
    .update(update)
    .eq('id', id);

  if (error) {
    console.error('Error updating follow-up status:', error);
    return false;
  }
  return true;
}
