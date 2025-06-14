/**
 * AeroFusionXR AI Governance - ESLint Configuration
 * World-class code quality standards for AI governance systems
 */

module.exports = {
    env: {
        node: true,
        es2022: true,
        jest: true
    },
    extends: [
        'eslint:recommended',
        'plugin:security/recommended',
        'plugin:node/recommended',
        'plugin:promise/recommended'
    ],
    plugins: [
        'security',
        'node',
        'promise',
        'jsdoc',
        'complexity'
    ],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
    },
    rules: {
        // Code Quality Rules
        'complexity': ['error', { max: 10 }],
        'max-depth': ['error', 4],
        'max-lines': ['error', 500],
        'max-lines-per-function': ['error', 50],
        'max-params': ['error', 5],
        'max-statements': ['error', 20],
        'no-duplicate-imports': 'error',
        'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'no-console': 'warn',
        'no-debugger': 'error',
        'no-alert': 'error',
        
        // Security Rules
        'security/detect-object-injection': 'error',
        'security/detect-non-literal-regexp': 'error',
        'security/detect-unsafe-regex': 'error',
        'security/detect-buffer-noassert': 'error',
        'security/detect-child-process': 'error',
        'security/detect-disable-mustache-escape': 'error',
        'security/detect-eval-with-expression': 'error',
        'security/detect-no-csrf-before-method-override': 'error',
        'security/detect-non-literal-fs-filename': 'error',
        'security/detect-non-literal-require': 'error',
        'security/detect-possible-timing-attacks': 'error',
        'security/detect-pseudoRandomBytes': 'error',
        
        // Promise Rules
        'promise/always-return': 'error',
        'promise/catch-or-return': 'error',
        'promise/no-nesting': 'error',
        'promise/no-promise-in-callback': 'error',
        'promise/no-callback-in-promise': 'error',
        'promise/avoid-new': 'warn',
        
        // Documentation Rules
        'jsdoc/check-alignment': 'error',
        'jsdoc/check-indentation': 'error',
        'jsdoc/check-param-names': 'error',
        'jsdoc/check-syntax': 'error',
        'jsdoc/check-tag-names': 'error',
        'jsdoc/check-types': 'error',
        'jsdoc/require-description': 'error',
        'jsdoc/require-param': 'error',
        'jsdoc/require-param-description': 'error',
        'jsdoc/require-param-type': 'error',
        'jsdoc/require-returns': 'error',
        'jsdoc/require-returns-description': 'error',
        'jsdoc/require-returns-type': 'error',
        
        // Node.js Rules
        'node/no-unpublished-require': 'off',
        'node/no-missing-require': 'error',
        'node/no-extraneous-require': 'error',
        'node/prefer-global/buffer': 'error',
        'node/prefer-global/console': 'error',
        'node/prefer-global/process': 'error',
        'node/prefer-global/url-search-params': 'error',
        'node/prefer-global/url': 'error',
        
        // Style Rules
        'indent': ['error', 4],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'never'],
        'brace-style': ['error', '1tbs'],
        'camelcase': 'error',
        'consistent-return': 'error',
        'curly': 'error',
        'default-case': 'error',
        'dot-notation': 'error',
        'eqeqeq': 'error',
        'guard-for-in': 'error',
        'no-caller': 'error',
        'no-else-return': 'error',
        'no-eq-null': 'error',
        'no-eval': 'error',
        'no-extend-native': 'error',
        'no-extra-bind': 'error',
        'no-fallthrough': 'error',
        'no-floating-decimal': 'error',
        'no-implied-eval': 'error',
        'no-lone-blocks': 'error',
        'no-loop-func': 'error',
        'no-multi-str': 'error',
        'no-native-reassign': 'error',
        'no-new': 'error',
        'no-new-func': 'error',
        'no-new-wrappers': 'error',
        'no-octal': 'error',
        'no-octal-escape': 'error',
        'no-param-reassign': 'error',
        'no-proto': 'error',
        'no-redeclare': 'error',
        'no-return-assign': 'error',
        'no-script-url': 'error',
        'no-self-compare': 'error',
        'no-sequences': 'error',
        'no-throw-literal': 'error',
        'no-with': 'error',
        'radix': 'error',
        'vars-on-top': 'error',
        'wrap-iife': ['error', 'any'],
        'yoda': 'error'
    },
    overrides: [
        {
            files: ['**/*.test.js', '**/*.spec.js'],
            env: {
                jest: true
            },
            rules: {
                'max-lines-per-function': 'off',
                'max-statements': 'off'
            }
        },
        {
            files: ['governance/pillars/**/*.js'],
            rules: {
                'jsdoc/require-description': 'error',
                'complexity': ['error', { max: 15 }], // Allow higher complexity for governance engines
                'max-lines': ['error', 800] // Allow larger files for comprehensive governance
            }
        }
    ],
    ignorePatterns: [
        'node_modules/',
        'dist/',
        'build/',
        'coverage/',
        '*.min.js'
    ]
}; 