// Client-side Sentry disabilitato: il bundle pubblico non deve caricare
// @sentry/nextjs (~273 kB gzip). Il tracking errori resta server-side via
// sentry.server.config.ts + instrumentation.ts.
export {};
