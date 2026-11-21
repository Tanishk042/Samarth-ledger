module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    'node_modules.broken',
    'contracts',
    'public/sw.js',
    'public/samples',
    'scripts/make-icons.py',
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react', 'react-refresh'],
  settings: { react: { version: 'detect' } },
  rules: {
    'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    // Vite HMR nicety only; it must not gate a production build.
    'react-refresh/only-export-components': 'off',
  },
  overrides: [
    {
      files: ['api/**/*.js', 'shared/**/*.js', 'scripts/**/*.mjs'],
      env: { node: true, browser: false },
    },
  ],
}
