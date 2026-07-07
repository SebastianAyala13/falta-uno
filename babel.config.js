module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // unstable_transformImportMeta: convierte `import.meta` en algo válido para
      // el bundle web (script clásico) y para Hermes. Necesario en SDK 54 porque
      // deps como zustand/middleware traen `import.meta.env`; pasa a default en SDK 56.
      ['babel-preset-expo', { jsxImportSource: 'nativewind', unstable_transformImportMeta: true }],
      'nativewind/babel',
    ],
  };
};
