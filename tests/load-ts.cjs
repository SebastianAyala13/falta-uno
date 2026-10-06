const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

// Execute application TS with real dependencies and explicit boundary doubles.
// This keeps tests independent of Metro and native modules, without copying logic.
exports.loadTs = function loadTs(file, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const localRequire = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(filename), id);
      const target = [base, base + '.ts', base + '.tsx'].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
      if (target) return exports.loadTs(path.relative(root, target), mocks, cache);
    }
    return require(id);
  };
  new Function('require', 'module', 'exports', '__filename', '__dirname', code)(
    localRequire, module, module.exports, filename, path.dirname(filename),
  );
  return module.exports;
};
