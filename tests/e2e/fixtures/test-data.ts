import { createClient } from '@supabase/supabase-js';

function createTestAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase credentials for test data seeding. ' +
        'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const TEST_BATCH = 'TEST';
const TEST_COMPANIES = [{ name: 'Test Co' }, { name: 'GreenEnergy' }, { name: 'Third Co' }];

export async function seedTestData() {
  const supabase = createTestAdminClient();

  const { error: batchError } = await supabase
    .from('batch_settings')
    .upsert({ id: 'default', active_batch: TEST_BATCH }, { onConflict: 'id' });

  if (batchError) {
    throw new Error(`Failed to seed batch_settings: ${batchError.message}`);
  }

  const { error: deleteError } = await supabase
    .from('companies')
    .delete()
    .eq('batch', TEST_BATCH)
    .in('name', TEST_COMPANIES.map(c => c.name));

  if (deleteError) {
    throw new Error(`Failed to clear existing test companies: ${deleteError.message}`);
  }

  const { error: insertError, data: insertedCompanies } = await supabase.from('companies')
    .insert(TEST_COMPANIES.map(c => ({ name: c.name, batch: TEST_BATCH })))
    .select();

  if (insertError) {
    throw new Error(`Failed to seed test companies: ${insertError.message}`);
  }

  if (insertedCompanies && insertedCompanies.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const { error: statsError } = await supabase.from('daily_stats').insert([
      { company_id: insertedCompanies[0].id, date: yesterday, vote_count: 88, unique_voters: 14 },
      { company_id: insertedCompanies[1].id, date: yesterday, vote_count: 45, unique_voters: 10 },
      { company_id: insertedCompanies[2].id, date: yesterday, vote_count: 32, unique_voters: 8 },
      { company_id: insertedCompanies[0].id, date: today, vote_count: 105, unique_voters: 16 },
      { company_id: insertedCompanies[1].id, date: today, vote_count: 62, unique_voters: 12 },
      { company_id: insertedCompanies[2].id, date: today, vote_count: 41, unique_voters: 9 },
    ]);
    if (statsError) throw new Error(`Failed to seed daily_stats: ${statsError.message}`);

    const { error: voteError } = await supabase.from('vote_sessions').insert([
      { fingerprint: 'test-fp-1', company1_id: insertedCompanies[0].id, company2_id: insertedCompanies[1].id, company3_id: insertedCompanies[2].id, created_at: new Date().toISOString() },
      { fingerprint: 'test-fp-2', company1_id: insertedCompanies[1].id, company2_id: insertedCompanies[0].id, company3_id: insertedCompanies[2].id, created_at: new Date().toISOString() },
      { fingerprint: 'test-fp-3', company1_id: insertedCompanies[2].id, company2_id: insertedCompanies[0].id, company3_id: insertedCompanies[1].id, created_at: new Date(Date.now() - 600000).toISOString() },
    ]);
    if (voteError) throw new Error(`Failed to seed vote_sessions: ${voteError.message}`);

    const { error: deviceError } = await supabase.from('device_sessions').upsert([
      { fingerprint: 'test-fp-1', last_used: new Date().toISOString() },
      { fingerprint: 'test-fp-2', last_used: new Date().toISOString() },
      { fingerprint: 'test-fp-4', last_used: new Date().toISOString() },
    ], { onConflict: 'fingerprint' });
    if (deviceError) throw new Error(`Failed to seed device_sessions: ${deviceError.message}`);
  }
}

export async function cleanupTestData() {
  const supabase = createTestAdminClient();

  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('batch', TEST_BATCH)
    .in('name', TEST_COMPANIES.map(c => c.name));

  if (companies && companies.length > 0) {
    const ids = companies.map(c => c.id);
    await supabase.from('daily_stats').delete().in('company_id', ids);
    await supabase.from('vote_sessions').delete().in('company1_id', ids);
    await supabase.from('device_sessions').delete().in('fingerprint', ['test-fp-1', 'test-fp-2', 'test-fp-3', 'test-fp-4']);
  }

  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('batch', TEST_BATCH)
    .in('name', TEST_COMPANIES.map(c => c.name));

  if (error) {
    throw new Error(`Failed to cleanup test companies: ${error.message}`);
  }
}
