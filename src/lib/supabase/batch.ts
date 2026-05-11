import { createAdminClient } from './admin'

export async function getActiveBatch(): Promise<string> {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('batch_settings')
    .select('active_batch')
    .eq('id', 'default')
    .single()
  
  if (error || !data) {
    console.warn('No active batch found, using default:', error?.message)
    return 'TEST'
  }
  
  return data.active_batch
}