const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  external: ['vscode'],
  format: 'cjs',
  sourcemap: true,
  watch: process.argv.includes('--watch'),
}).catch(() => process.exit(1));
