// Minimal ambient typings for `pg` (the package ships no types and `@types/pg`
// is not a dependency). Only the surface used by integration tests is declared.
declare module 'pg' {
  export interface QueryResult<R = Record<string, unknown>> {
    rows: R[]
    rowCount: number | null
  }

  export interface ClientConfig {
    connectionString?: string
    ssl?: boolean | { rejectUnauthorized?: boolean }
  }

  export class Client {
    constructor(config?: ClientConfig | string)
    connect(): Promise<void>
    query<R = Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<R>>
    end(): Promise<void>
  }

  const pg: { Client: typeof Client }
  export default pg
}
