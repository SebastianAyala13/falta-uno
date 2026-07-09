// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Deno edge functions (imports jsr:) no son parte del bundle RN/Node.
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'supabase/functions/**'],
  },
  {
    rules: {
      // Reglas nuevas del React Compiler (eslint-config-expo 57). Son *hints* de
      // optimización, no bugs: el compilador simplemente no memoiza esos casos y
      // el código funciona igual. Las apagamos porque chocan con patrones
      // estándar y con la API de Reanimated (`sharedValue.value = …`).
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/purity': 'off',
    },
  },
]);
