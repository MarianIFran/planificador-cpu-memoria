import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Mide todo el codigo de produccion, incluso archivos que ningun test importe.
      include: ['src/**/*.ts'],
      reporter: ['text', 'html', 'lcov'],
      // La consigna pide cobertura de lineas estrictamente mayor a 90%.
      thresholds: { lines: 91 },
    },
  },
});