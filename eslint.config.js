import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'

export default tseslint.config(
  { ignores: ['dist', '.next', 'next-env.d.ts', 'supabase/functions'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      '@next/next': nextPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Photos come straight from Supabase Storage at their own size; next/image would change layout and add cost.
      '@next/next/no-img-element': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // UI standard: every on/off control is a toggle (ui/Toggle), never a checkbox.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='type'][value.value='checkbox']",
          message: 'Usa <Toggle> de src/ui/Toggle: en la app todos los on/off son toggles, no checkboxes.',
        },
      ],
    },
  },
  {
    files: ['src/ui/Toggle.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // Next.js route files export metadata/config next to the component; nav.tsx exports helpers by design.
    files: ['app/**/*.{ts,tsx}', 'src/lib/nav.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
)
