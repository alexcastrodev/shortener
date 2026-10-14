import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['build/**', '.react-router/**', '**/node_modules/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
