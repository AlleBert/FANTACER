import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

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
const TEST_SPONSORS = [
  { name: 'E2E Sponsor A', color: { r: 231, g: 76, b: 60 }, has_stand: true, website_url: 'https://example-a.it' },
  { name: 'E2E Sponsor B', color: { r: 46, g: 204, b: 113 }, has_stand: true, website_url: null },
  { name: 'E2E Sponsor C', color: { r: 52, g: 152, b: 219 }, has_stand: false, website_url: null },
];

/**
 * Rimuove i voti di oggi generati dalle suite E2E (fingerprint `e2e-voter-*`).
 *
 * Il fingerprint di voto (`FingerprintJS.visitorId`) è stabile per browser
 * instance: due test paralleli che votano nello stesso worker condividono lo
 * stesso fingerprint e la RPC `submit_vote` rifiuta il secondo voto con
 * "Hai già votato oggi" (409). Azzerare i vote_sessions di oggi subito prima
 * di ogni voto evita la collisione mantenendo intatti i dati seedati
 * (`test-fp-*`).
 */
export async function clearRuntimeVotes() {
  const supabase = createTestAdminClient();

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfToday.getDate() + 1);
  const { error } = await supabase
    .from('vote_sessions')
    .delete()
    .gte('created_at', startOfToday.toISOString())
    .lt('created_at', startOfTomorrow.toISOString())
    .like('fingerprint', 'e2e-voter-%');

  if (error) {
    throw new Error(`Failed to clear runtime votes: ${error.message}`);
  }
}

async function seedSponsors(supabase: ReturnType<typeof createTestAdminClient>) {
  for (let i = 0; i < TEST_SPONSORS.length; i++) {
    const sp = TEST_SPONSORS[i];
    const slug = sp.name.toLowerCase().replace(/\s+/g, '-');
    const fileName = `${slug}-${sp.color.r}-${sp.color.g}-${sp.color.b}.png`;
    const objectPath = `sponsors/${fileName}`;

    const png = await sharp({
      create: { width: 400, height: 200, channels: 4, background: { ...sp.color, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const { error: uploadError } = await supabase.storage
      .from('sponsor-logos')
      .upload(objectPath, png, { upsert: true, contentType: 'image/png' });
    if (uploadError) {
      throw new Error(`Failed to upload sponsor logo ${fileName}: ${uploadError.message}`);
    }

    const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/sponsor-logos/${objectPath}`;

    const { data: existing } = await supabase.from('sponsors').select('id').eq('name', sp.name).maybeSingle();
    const payload = {
      name: sp.name,
      image_url: imageUrl,
      website_url: sp.website_url,
      is_active: true,
      has_stand: sp.has_stand,
      sort_order: i,
    };

    if (existing) {
      const { error } = await supabase.from('sponsors').update(payload).eq('id', existing.id);
      if (error) throw new Error(`Failed to update sponsor ${sp.name}: ${error.message}`);
    } else {
      const { error } = await supabase.from('sponsors').insert(payload);
      if (error) throw new Error(`Failed to insert sponsor ${sp.name}: ${error.message}`);
    }
  }
}

export async function seedTestData() {
  const supabase = createTestAdminClient();

  await seedSponsors(supabase);

  let batchError: { message: string } | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { error } = await supabase
      .from('batch_settings')
      .upsert({ id: 'default', active_batch: TEST_BATCH }, { onConflict: 'id' });
    batchError = error ?? null;
    if (!batchError) break;
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }

  if (batchError) {
    throw new Error(`Failed to seed batch_settings: ${batchError.message}`);
  }

  await clearRuntimeVotes();

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
