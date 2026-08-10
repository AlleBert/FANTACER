import { seedTestData } from './fixtures/test-data';

export default async function globalSetup() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await seedTestData();
      return;
    } catch (err) {
      lastError = err;
      console.error(`globalSetup: seed attempt ${attempt}/3 failed —`, err);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  console.error('globalSetup: failed to seed test data after 3 attempts —', lastError);
  process.exit(1);
}
