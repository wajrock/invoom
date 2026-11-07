import js from '@eslint/js';
import angular from 'angular-eslint';
import prettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {ignores: ['**/dist/**', '**/.angular/**', '**/node_modules/**', 'apps/api/drizzle/**']},
    {
        files: ['**/*.{ts,mjs,js}'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        rules: {
            eqeqeq: ['error', 'always'],
            'no-console': ['warn', {allow: ['warn', 'error']}],
            'prefer-const': 'error',
            '@typescript-eslint/consistent-type-imports': ['error', {fixStyle: 'inline-type-imports'}],
            '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
        },
    },
    {
        files: ['apps/api/**/*.ts'],
        languageOptions: {globals: globals.node},
    },
    {
        files: ['apps/api/scripts/**/*.ts'],
        rules: {'no-console': 'off'},
    },
    {
        files: ['apps/web/**/*.ts'],
        languageOptions: {globals: globals.browser},
        extends: [...angular.configs.tsRecommended],
        processor: angular.processInlineTemplates,
        rules: {
            '@angular-eslint/component-selector': [
                'error',
                {type: 'element', prefix: ['app', 'hlm'], style: 'kebab-case'},
            ],
            '@angular-eslint/directive-selector': [
                'error',
                {type: 'attribute', prefix: ['app', 'hlm'], style: 'camelCase'},
            ],
        },
    },
    {
        files: ['apps/web/**/*.html'],
        extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    },
    prettier,
);
