/** End-to-end tests: need a real MongoDB replica set in MONGO_URI. */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  testTimeout: 30000,
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json', diagnostics: { ignoreCodes: [151002] } }] },
  moduleNameMapper: {
    '^@contenthub/common$': '<rootDir>/libs/common/src/index.ts',
    '^@contenthub/mock-oauth$': '<rootDir>/tools/mock-oauth/src/app.ts',
  },
};
