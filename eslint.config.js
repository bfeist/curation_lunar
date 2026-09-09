import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
export default tseslint.config(
  { ignores: ['node_modules/**', '.local/**', 'python/**', 'data/**'] },
  ...tseslint.configs.recommended,
  { files: ['src/**/*.{ts,tsx}'], plugins: { 'react-hooks': hooks }, rules: hooks.configs.recommended.rules },
  prettier,
);
