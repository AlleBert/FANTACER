import { submitVote } from '../src/lib/supabase/vote-api'
import { createClient } from '../src/lib/supabase/client'

jest.mock('../src/lib/supabase/client')

describe('submitVote', () => {
  const mockRpc = jest.fn()
  const mockCreateClient = createClient as jest.Mock

  beforeEach(() => {
    mockRpc.mockReset()
    mockCreateClient.mockReturnValue({ rpc: mockRpc })
  })

  it('calls submit_vote RPC with correct parameters', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null })

    const submission = {
      userId: 'user-1',
      worldId: 'world-1',
      optionId: 'option-1',
    }

    await submitVote(submission)

    expect(mockCreateClient).toHaveBeenCalled()
    expect(mockRpc).toHaveBeenCalledWith('submit_vote', {
      p_user_id: submission.userId,
      p_world_id: submission.worldId,
      p_option_id: submission.optionId,
    })
  })

  it('throws error when RPC returns error', async () => {
    const error = new Error('RPC failed')
    mockRpc.mockResolvedValue({ data: null, error })

    const submission = {
      userId: 'user-1',
      worldId: 'world-1',
      optionId: 'option-1',
    }

    await expect(submitVote(submission)).rejects.toThrow('RPC failed')
  })
})
