const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadTs} = require('./load-ts.cjs');

const {diasDesdeFranjas, franjasDesdeDias, diaInicial} = loadTs('lib/disponibilidad.ts');
const {resolverCanchaActiva} = loadTs('lib/useCanchasDelDueno.ts', {
  // El hook arrastra React, Supabase y el store; acá solo se prueba la función
  // pura de resolución, así que los límites se cortan en el require.
  react: {useCallback: () => {}, useEffect: () => {}, useMemo: () => {}, useState: () => []},
  '@/lib/auth': {useAuth: () => ({})},
  '@/lib/canchas': {misCanchas: async () => []},
  '@/lib/store': {useStore: () => null},
});

const franja = (dia, apertura, cierre, duracion, precio) => ({
  id: `f${dia}`, cancha_id: 'c1', dia_semana: dia,
  hora_apertura: apertura, hora_cierre: cierre, duracion_min: duracion,
  precio, activo: true, created_at: '2026-10-06T00:00:00Z',
});

test('a 90 minute slot survives opening and saving the editor', () => {
  const dias = diasDesdeFranjas([franja(1, '08:00:00', '23:00:00', 90, 120000)]);
  assert.equal(dias[1].duracion, 90);
  // El viaje de vuelta es el que estaba roto: escribía 60 y cobraba el precio
  // de 90 por un turno de 60.
  const [vuelta] = franjasDesdeDias(dias);
  assert.deepEqual(vuelta, {
    dia_semana: 1, hora_apertura: '08:00', hora_cierre: '23:00',
    duracion_min: 90, precio: 120000,
  });
});

test('each day keeps its own duration and closed days are not saved', () => {
  const dias = diasDesdeFranjas([
    franja(1, '08:00:00', '22:00:00', 60, 80000),
    franja(0, '09:00:00', '18:00:00', 90, 130000),
  ]);
  assert.deepEqual(franjasDesdeDias(dias).map((f) => [f.dia_semana, f.duracion_min]), [[0, 90], [1, 60]]);
  assert.equal(dias.filter((d) => d.abierto).length, 2);
});

test('a franja without duration falls back to 60 instead of zero length slots', () => {
  assert.equal(diasDesdeFranjas([franja(3, '08:00:00', '10:00:00', 0, 50000)])[3].duracion, 60);
  assert.equal(diaInicial().duracion, 60);
});

test('out of range weekdays are ignored instead of writing past the week', () => {
  const dias = diasDesdeFranjas([franja(7, '08:00:00', '10:00:00', 60, 1), franja(-1, '08:00:00', '10:00:00', 60, 1)]);
  assert.equal(dias.length, 7);
  assert.equal(franjasDesdeDias(dias).length, 0);
});

const canchas = [{id: 'a'}, {id: 'b'}, {id: 'c'}];

test('an owner with several canchas reaches every one of them', () => {
  for (const {id} of canchas) assert.equal(resolverCanchaActiva(canchas, id).id, id);
});

test('a saved choice that no longer exists falls back instead of emptying the screen', () => {
  // Antes todas las pantallas usaban canchas[0]: con tres canchas, dos eran
  // inalcanzables desde la app.
  assert.equal(resolverCanchaActiva(canchas, 'borrada').id, 'a');
  assert.equal(resolverCanchaActiva(canchas, null).id, 'a');
  assert.equal(resolverCanchaActiva([], 'a'), null);
});

const {banderaEncendida} = loadTs('constants/config.ts');

test('only explicit on values enable a flag; false and 0 no longer turn payments on', () => {
  for (const v of ['1', 'true', 'TRUE', ' on ', 'si', 'sí']) assert.equal(banderaEncendida(v), true, v);
  // Esto es lo que estaba roto: con `!!valor`, poner 'false' encendía los pagos
  // online y publicaba un checkout real creyendo que estaba apagado.
  for (const v of ['false', '0', 'no', 'off', '', '   ', undefined]) assert.equal(banderaEncendida(v), false, String(v));
});

const {huellaFormulario} = loadTs('lib/formulario-cancha.ts');
const base = {
  nombre: 'La Bombonera 1', direccion: 'Cra 10 #5-20', zona: 'Centro',
  telefono: '3001112233', descripcion: 'Sintética', formatos: ['5v5', '7v7'],
  amenidades: {duchas: true, wifi: false}, fotos: ['u1'],
  dias: diasDesdeFranjas([franja(1, '08:00:00', '22:00:00', 90, 120000)]),
};

test('the editor only warns about discarding when something really changed', () => {
  assert.equal(huellaFormulario(base), huellaFormulario({...base}));
  // Apagar una amenidad deja `false` donde no había clave: no es un cambio.
  assert.equal(huellaFormulario(base), huellaFormulario({...base, amenidades: {duchas: true}}));
  assert.equal(huellaFormulario(base), huellaFormulario({...base, formatos: ['7v7', '5v5']}));
  assert.equal(huellaFormulario(base), huellaFormulario({...base, nombre: '  La Bombonera 1  '}));
  // El horario de un día cerrado no se guarda, así que tampoco cuenta.
  const cerrado = base.dias.map((d, i) => (i === 3 ? {...d, apertura: '05:00'} : d));
  assert.equal(huellaFormulario(base), huellaFormulario({...base, dias: cerrado}));
});

test('a changed price, duration or photo counts as unsaved work', () => {
  const cambio = (dias) => huellaFormulario({...base, dias});
  assert.notEqual(huellaFormulario(base), cambio(base.dias.map((d, i) => (i === 1 ? {...d, precio: '130000'} : d))));
  assert.notEqual(huellaFormulario(base), cambio(base.dias.map((d, i) => (i === 1 ? {...d, duracion: 60} : d))));
  assert.notEqual(huellaFormulario(base), cambio(base.dias.map((d, i) => (i === 1 ? {...d, abierto: false} : d))));
  assert.notEqual(huellaFormulario(base), huellaFormulario({...base, fotos: ['u1', 'u2']}));
  assert.notEqual(huellaFormulario(base), huellaFormulario({...base, amenidades: {duchas: true, wifi: true}}));
  assert.notEqual(huellaFormulario(base), huellaFormulario({...base, zona: 'Cuba'}));
});
