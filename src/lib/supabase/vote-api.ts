import { createClient } from '@supabase/supabase-js';

let supabase: ReturnType<typeof createClient> | null = null;

const getSupabase = () => {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabase;
};

export interface VoteSubmission {
  companyId: string;
  fingerprint: string;
  ip: string;
  userAgent: string;
  country?: string;
  comment: string;
  adjective: 'eccezionale' | 'migliore' | 'nella media' | 'peggiore';
  sliders: {
    innovation: number;
    sales: number;
    wow: number;
  };
}

export async function submitVote(vote: VoteSubmission): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  const { data, error } = await client.rpc('submit_vote', {
    company_id_param: vote.companyId,
    fingerprint_param: vote.fingerprint,
    ip_param: vote.ip,
    user_agent_param: vote.userAgent,
    country_param: vote.country || 'IT',
    comment_param: vote.comment,
    adjective_param: vote.adjective,
    slider_innovation_param: vote.sliders.innovation,
    slider_sales_param: vote.sliders.sales,
    slider_wow_param: vote.sliders.wow,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return data as { success: boolean; error?: string };
}
