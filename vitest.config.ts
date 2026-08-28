import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Terminal + JUnit. `tested push` (and the Action) read ./junit.xml
    // for flakes / suite time. Leave the file in the working directory or
    // pass `junit: junit.xml` on tested-hq/cli/action.
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './junit.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['json', 'text'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
    },
  },
});
