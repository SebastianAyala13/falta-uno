const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadTs} = require('./load-ts.cjs');
const {generarSlots} = loadTs('lib/slots.ts');
const {matchDateTime} = loadTs('lib/format.ts');
const franja = {hora_apertura:'09:00',hora_cierre:'12:00',duracion_min:60,precio:50000};

test('partial reservation overlaps occupy both slots and adjacent slots stay free', () => {
  const slots = generarSlots([franja],[{hora_inicio:'09:30',hora_fin:'10:30'}],'2099-10-05',0);
  assert.deepEqual(slots.map(s => s.ocupado),[true,true,false]);
});
test('zero/negative/nonfinite durations fail instead of looping forever', () => {
  for (const duracion_min of [0,-1,NaN,Infinity]) {
    assert.throws(() => generarSlots([{...franja,duracion_min}],[],'2099-10-05'), /inválidos/);
  }
});
test('duplicate templates cannot produce duplicate selection keys', () => {
  assert.equal(generarSlots([franja,franja],[],'2099-10-05',0).length,3);
});
test('match times and elapsed slot detection use Colombia time in every host zone', () => {
  assert.equal(matchDateTime('2026-10-05','20:00:00').toISOString(),'2026-10-06T01:00:00.000Z');
  const now = Date.parse('2026-10-05T14:30:00Z'); // 09:30 Colombia
  assert.deepEqual(generarSlots([franja],[],'2026-10-05',now).map(s => s.ocupado),[true,false,false]);
});
