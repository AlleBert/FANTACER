import { createClient } from './client'

export interface VoteSubmission {
  userId: string
  worldId: string
  optionId: string
}

let supabase: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (!supabase) {
    supabase = createClient()
  }
  return supabase
}

export async function submitVote(submission: VoteSubmission) {
  const client = getSupabase()
  const { data, error } = await client.rpc('submit_vote', {
    p_user_id: submission.userId,
    p_world_id: submission.worldId,
    p_option_id: submission.optionId,
  })

  if (error) {
    throw error
  }

  return data
}
