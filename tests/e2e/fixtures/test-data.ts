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

  const { error: insertError } = await supabase.from('companies').insert(
    TEST_COMPANIES.map(c => ({ name: c.name, batch: TEST_BATCH })),
  );

  if (insertError) {
    throw new Error(`Failed to seed test companies: ${insertError.message}`);
  }
}

export async function cleanupTestData() {
  const supabase = createTestAdminClient();

  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('batch', TEST_BATCH)
    .in('name', TEST_COMPANIES.map(c => c.name));

  if (error) {
    throw new Error(`Failed to cleanup test companies: ${error.message}`);
  }
}
