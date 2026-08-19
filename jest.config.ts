import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '\\.worktrees/'],
  // react-cookie-manager è ESM-only (dist/*.js con import): va trasformato per
  // testare il crash reale di getCookie() su document.cookie bloccato.
  transformIgnorePatterns: ['node_modules/(?!(react-cookie-manager)/)'],
};

export default config;
