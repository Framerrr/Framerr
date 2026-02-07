import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
    // Ignore patterns
    {
        ignores: ['dist/**', 'node_modules/**', 'server/**', '*.config.js', 'develop-server/**'],
    },

    // Base JavaScript/TypeScript config
    js.configs.recommended,
    ...tseslint.configs.recommended,

    // Main configuration for source files
    {
        files: ['src/**/*.{js,jsx,ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2024,
            globals: {
                ...globals.browser,
                ...globals.es2020,
            },
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            // React Hooks rules
            ...reactHooks.configs.recommended.rules,

            // React Refresh rules
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],

            // Disable rules that TypeScript handles better
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'warn',
            '@typescript-eslint/no-explicit-any': 'off', // Too noisy for now

            // ===========================================================
            // 🔒 RGL SWAP BOUNDARY ENFORCEMENT
            // ===========================================================
            // react-grid-layout imports are ONLY allowed in src/shared/grid/adapter/
            // This enables future library swaps without touching consumer code.
            //
            // If you see this error and believe you need RGL elsewhere:
            // 1. STOP - Do not add an exception
            // 2. Check if adapter/ already exports what you need
            // 3. If not, extend adapter/index.ts to expose it
            // 4. If truly necessary, discuss with team before proceeding
            // ===========================================================
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['react-grid-layout', 'react-grid-layout/*'],
                            message:
                                'RGL imports are only allowed in src/shared/grid/adapter/. ' +
                                'Use exports from @/shared/grid or @/shared/grid/adapter instead.',
                        },
                    ],
                },
            ],
        },
    },

    // Override: Allow RGL imports in the adapter directory
    {
        files: ['src/shared/grid/adapter/**/*.{js,jsx,ts,tsx}'],
        rules: {
            'no-restricted-imports': 'off',
        },
    },

    // Override: Allow RGL imports in legacy files (temporary during migration)
    // TODO: Remove these overrides as each file is migrated in Phases 4-6
    {
        files: [
            'src/shared/grid/index.ts',
            'src/shared/grid/rglAdapter.ts',
            'src/shared/grid/FramerrGrid.tsx',
            'src/shared/grid/FramerrTemplateGrid.tsx',
        ],
        rules: {
            'no-restricted-imports': 'off',
        },
    },
);
