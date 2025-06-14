module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:prettier/recommended',
    'plugin:security/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'jsx-a11y',
    'prettier',
    'security',
    'import',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // TypeScript
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // React
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Import
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],

    // Security
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-possible-timing-attacks': 'warn',

    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prettier/prettier': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'max-len': ['error', { code: 100, ignoreUrls: true }],

    // ==========================================
    // ⚖️ AI GOVERNANCE RULES
    // ==========================================
    'complexity': ['error', { max: 10 }], // Governance: Code complexity limit
    'max-depth': ['error', 4], // Governance: Maximum nesting depth
    'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }], // Governance: File length limit
    'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }], // Governance: Function length limit
    'max-params': ['error', 5], // Governance: Parameter limit
    'no-magic-numbers': ['warn', { ignore: [0, 1, -1], ignoreArrayIndexes: true }], // Governance: No magic numbers
    'no-eval': 'error', // Security: No eval usage
    'no-implied-eval': 'error', // Security: No implied eval
    'no-new-func': 'error', // Security: No Function constructor
    'no-script-url': 'error', // Security: No script URLs
    'no-alert': 'error', // Governance: No alert usage in production
    'no-debugger': 'error', // Governance: No debugger statements
    'no-unused-expressions': 'error', // Governance: No unused expressions
    'consistent-return': 'error', // Governance: Consistent return statements
    'default-case': 'error', // Governance: Default case in switch statements
    'dot-notation': 'error', // Governance: Use dot notation when possible
    'guard-for-in': 'error', // Governance: Guard for-in loops
    'no-caller': 'error', // Governance: No arguments.caller or arguments.callee
    'no-empty-function': 'error', // Governance: No empty functions
    'no-floating-decimal': 'error', // Governance: No floating decimals
    'no-implicit-coercion': 'error', // Governance: No implicit type coercion
    'no-multi-spaces': 'error', // Governance: No multiple spaces
    'no-new': 'error', // Governance: No new for side effects
    'no-new-wrappers': 'error', // Governance: No new wrappers
    'no-throw-literal': 'error', // Governance: No throwing literals
    'no-unmodified-loop-condition': 'error', // Governance: No unmodified loop conditions
    'no-useless-call': 'error', // Governance: No useless call
    'no-useless-concat': 'error', // Governance: No useless concatenation
    'no-useless-return': 'error', // Governance: No useless return
    'radix': 'error', // Governance: Require radix parameter
    'require-await': 'error', // Governance: Require await in async functions
    'yoda': 'error', // Governance: No yoda conditions
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
}; 