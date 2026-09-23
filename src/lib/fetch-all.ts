const PAGE_SIZE = 1000

interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
}

/**
 * Pagina una query PostgREST con `.range()` fino a esaurimento.
 * Necessario perché PostgREST tronca a `db-max-rows` (1000) per richiesta.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = PAGE_SIZE,
): Promise<{ data: T[]; error: string | null }> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await build(from, from + pageSize - 1)
    if (error) return { data: out, error: error.message }
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }
  return { data: out, error: null }
}
