import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import unusedImports from 'eslint-plugin-unused-imports'
import tseslint from 'typescript-eslint'

const configs = [
  // 忽略构建输出目录
  { ignores: ['dist/**'] },
  
  // 基础 ESLint 推荐配置
  js.configs.recommended,
  
  // TypeScript ESLint 配置
  ...tseslint.configs.recommended,
  
  // React Hooks 规则
  reactHooks.configs.flat.recommended,
  
  // React Refresh 规则（Vite 专用）
  reactRefresh.configs.vite,
  
  // 主配置
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'unused-imports': unusedImports
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // 关闭不影响构建的规则，减少开发负担
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'off',
      'unused-imports/no-unused-vars': 'off',
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  },
]

export default configs
