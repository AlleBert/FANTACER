import { createAdminClient } from '@/lib/supabase/admin'

interface SubmitVoteParams {
  fingerprint: string
  ip: string
  userAgent: string
  country: string
  company1Id: string
  company2Id: string
  company3Id: string
}

export async function submitVote(params: SubmitVoteParams): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('submit_vote', {
    fingerprint_param: params.fingerprint,
    ip_param: params.ip,
    user_agent_param: params.userAgent,
    country_param: params.country,
    company1_id_param: params.company1Id,
    company2_id_param: params.company2Id,
    company3_id_param: params.company3Id,
  } as any)

  if (error) {
    console.error('submit_vote RPC error:', error)
    return { success: false, error: error.message }
  }

  const result = data as { success: boolean; error?: string }
  return result
}
