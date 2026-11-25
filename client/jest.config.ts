import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  }
}

// Packages that ship only ES modules and must be compiled for Jest
const ESM_PACKAGES = ['supercluster', 'kdbush']

// createJestConfig is async so next/jest can load the Next.js config; its node_modules
// ignore pattern is replaced to let the ES-module-only packages through (pnpm layout aware)
export default async function jestConfig(): Promise<Config> {
  const resolved = await createJestConfig(config)()
  return {
    ...resolved,
    transformIgnorePatterns: [
      `/node_modules/(?!(\\.pnpm|${ESM_PACKAGES.join('|')})[/@])`,
      '^.+\\.module\\.(css|sass|scss)$',
    ],
  }
}
