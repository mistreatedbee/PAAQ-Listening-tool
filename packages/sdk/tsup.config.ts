import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    web: 'src/web.ts',
    node: 'src/node.ts',
    'react-native': 'src/react-native.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  external: [
    '@paaq/sdk-core',
    'rrweb',
    'react',
    'react-native',
    '@react-native-async-storage/async-storage',
    'react-native-view-shot',
  ],
})
