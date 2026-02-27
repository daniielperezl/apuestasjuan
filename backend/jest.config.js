module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    'middleware/**/*.js'
  ],
  coverageThreshold: {
    global: { branches: 60, functions: 70, lines: 70, statements: 70 }
  },
  testTimeout: 30000,
  roots: ['../tests']
};
