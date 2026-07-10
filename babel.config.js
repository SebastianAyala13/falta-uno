module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // El transform de `import.meta` (que deps como zustand/middleware necesitan en
      // el bundle web) es DEFAULT desde SDK 56 (`babel-preset-expo` -> transformImportMeta),
      // así que no hace falta configurarlo acá. El Dockerfile igual verifica el bundle.
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
