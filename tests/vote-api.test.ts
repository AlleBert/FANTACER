import { submitVote } from '../src/lib/supabase/vote-api';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');
const mockRpc = jest.fn();
(createClient as jest.Mock).mockReturnValue({ rpc: mockRpc });

describe('submitVote', () => {
  it('calls submit_vote RPC with all required fields', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    const result = await submitVote({
      companyId: '123',
      fingerprint: 'fp123',
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      country: 'IT',
      comment: 'Great company',
      adjective: 'eccezionale',
      sliders: { innovation: 80, sales: 70, wow: 90 },
    });
    expect(mockRpc).toHaveBeenCalledWith('submit_vote', {
      company_id_param: '123',
      fingerprint_param: 'fp123',
      ip_param: '127.0.0.1',
      user_agent_param: 'test-agent',
      country_param: 'IT',
      comment_param: 'Great company',
      adjective_param: 'eccezionale',
      slider_innovation_param: 80,
      slider_sales_param: 70,
      slider_wow_param: 90,
    });
    expect(result).toEqual({ success: true });
  });
});
