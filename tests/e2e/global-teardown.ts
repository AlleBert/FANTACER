import { cleanupTestData } from './fixtures/test-data';

export default async function globalTeardown() {
  try {
    await cleanupTestData();
  } catch (err) {
    console.error('globalTeardown: cleanup failed —', err);
  }
}
