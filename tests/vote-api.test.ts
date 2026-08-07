import { submitVote } from '../src/lib/supabase/vote-api';

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
}));

const mockRpc = jest.fn();

describe('submitVote', () => {
  it('calls submit_vote RPC with 3 company IDs', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    const result = await submitVote({
      fingerprint: 'fp123',
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      country: 'IT',
      company1Id: 'c1',
      company2Id: 'c2',
      company3Id: 'c3',
      botd: '{"bot":true}',
    });
    expect(mockRpc).toHaveBeenCalledWith('submit_vote', {
      fingerprint_param: 'fp123',
      ip_param: '127.0.0.1',
      user_agent_param: 'test-agent',
      country_param: 'IT',
      company1_id_param: 'c1',
      company2_id_param: 'c2',
      company3_id_param: 'c3',
      botd_param: '{"bot":true}',
    });
    expect(result).toEqual({ success: true });
  });

  it('returns error when RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const result = await submitVote({
      fingerprint: 'fp123',
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      country: 'IT',
      company1Id: 'c1',
      company2Id: 'c2',
      company3Id: 'c3',
      botd: '{"bot":true}',
    });
    expect(result).toEqual({ success: false, error: 'DB error' });
  });
});
