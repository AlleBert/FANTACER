import { fetchAllRows } from '@/lib/fetch-all'

it('pagina finché non esaurisce (1500 righe)', async () => {
  const all = Array.from({ length: 1500 }, (_, i) => ({ id: i }))
  const build = jest.fn(async (from: number, to: number) => ({
    data: all.slice(from, to + 1),
    error: null,
  }))
  const { data, error } = await fetchAllRows(build)
  expect(error).toBeNull()
  expect(data).toHaveLength(1500)
  expect(build).toHaveBeenCalledTimes(2)
})

it('propaga l errore', async () => {
  const build = jest.fn(async () => ({ data: null, error: { message: 'boom' } }))
  const { error } = await fetchAllRows(build)
  expect(error).toBe('boom')
})
