// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylisticTs from '@stylistic/eslint-plugin-ts'

export default tseslint.config(

  {
    files: ['**/packages/sdk/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
    ],
    plugins: {
      '@stylistic/ts': stylisticTs,
    },
    rules: {
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: false,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
          allowSeparatedGroups: false
        },
      ],
      '@stylistic/ts/object-curly-spacing': ['error', 'always'],
      '@stylistic/ts/indent': ['error', 2],
    }
  },
  {
    ignores: [
      '**/dist/',
      '**/temp/',
      '**/coverage/',
      '.idea/',
      '**/packages/website/'
    ],
  },
);
