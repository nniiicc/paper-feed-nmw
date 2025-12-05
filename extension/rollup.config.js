// rollup.config.js
// Cross-browser extension build configuration
// Supports both Chrome (service worker) and Firefox (background scripts)
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default [
  // Background script as ESM (module)
  // Chrome uses this as service_worker, Firefox uses it as background script
  // Both browsers support ES modules in MV3 (Firefox 128+)
  {
    input: 'background.ts',
    output: {
      file: 'dist/background.bundle.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      typescript(),
      resolve(),
      commonjs()
    ]
  },
  // Content script as IIFE (non-module)
  {
    input: 'content.ts',
    output: {
      file: 'dist/content-script.js',
      format: 'iife', // Immediately-invoked function expression - no imports needed
      sourcemap: true
    },
    plugins: [
      typescript(),
      resolve(),
      commonjs(),
      terser() // Minify for production (optional)
    ]
  },
  // Options script
  {
    input: 'options.ts',
    output: {
      file: 'dist/options.bundle.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      typescript(),
      resolve(),
      commonjs()
    ]
  },
  // Popup script - converted to TypeScript
  {
    input: 'popup.ts',
    output: {
      file: 'dist/popup.bundle.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      typescript(),
      resolve(),
      commonjs()
    ]
  }
];
