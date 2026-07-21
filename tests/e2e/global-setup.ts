import { seedTestData } from './fixtures/test-data';

export default async function globalSetup() {
  try {
    await seedTestData();
  } catch (err) {
    console.error('globalSetup: failed to seed test data —', err);
    process.exit(1);
  }
}
