import js from '@eslint/js'
import globals from 'globals'
import hooks from 'eslint-plugin-react-hooks'
export default [ { ignores: ['node_modules/**', 'dist/**', '.expo/**'] },
  { files: ['**/*.{js,mjs}'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser, ...globals.node }, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': hooks }, rules: { ...js.configs.recommended.rules, 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }], 'react-hooks/rules-of-hooks': 'error' } },
  // Preserve the byte-identical upstream shared validator.
  { files: ['src/shared/validateResponse.js'], rules: { 'no-useless-assignment': 'off' } },
]
