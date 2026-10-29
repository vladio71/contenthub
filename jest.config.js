/** Unit tests: no database needed. */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/libs/**/*.spec.ts', '<rootDir>/apps/**/*.spec.ts', '<rootDir>/tools/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json', diagnostics: { ignoreCodes: [151002] } }] },
  moduleNameMapper: {
    '^@contenthub/common$': '<rootDir>/libs/common/src/index.ts',
    '^@contenthub/mock-oauth$': '<rootDir>/tools/mock-oauth/src/app.ts',
  },
};
