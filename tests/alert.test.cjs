const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadTs} = require('./load-ts.cjs');

test('web confirmations are visible, queued and never execute destructive callbacks automatically', () => {
  const api = loadTs('lib/alert.ts',{'react-native':{Platform:{OS:'web'},Alert:{alert(){throw Error('native web alert is unavailable')}}}});
  let current, called = 0;
  const stop = api.escucharAvisos(a => {current=a});
  api.Alert.alert('Confirmar','¿Eliminar?', [{text:'Cancelar'},{text:'Eliminar',onPress:()=>called++}]);
  const first=current;
  api.Alert.alert('Otro');
  assert.equal(current.title,'Confirmar');
  assert.equal(called,0);
  current.buttons[1].onPress();
  api.cerrarAviso(first);
  assert.equal(called,1);
  assert.equal(current.title,'Otro');
  api.cerrarAviso(first); // stale/double click cannot dismiss the next prompt
  assert.equal(current.title,'Otro');
  api.cerrarAviso(current);
  assert.equal(current,null);
  stop();
});

// El diseño acordado es el modal propio en todas las plataformas, para que la
// app se vea igual en el navegador y en el teléfono. Antes esta prueba afirmaba
// lo contrario: que en celular se delegaba en el diálogo del sistema.
test('every platform gets the in-app modal, so the design stays the same', () => {
  for (const OS of ['android','ios']) {
    let nativeCalls=0, current;
    const api=loadTs('lib/alert.ts',{'react-native':{Platform:{OS},Alert:{alert(){nativeCalls++}}}});
    const stop=api.escucharAvisos(a=>{current=a});
    api.Alert.alert('Título','Mensaje');
    assert.equal(nativeCalls,0,OS+' no debe usar el diálogo del sistema');
    assert.equal(current.title,'Título');
    assert.equal(current.message,'Mensaje');
    stop();
  }
});

test('Android report menus preserve every reason instead of truncating to three native buttons',()=>{
 let nativeCalls=0,current;
 const api=loadTs('lib/alert.ts',{'react-native':{Platform:{OS:'android'},Alert:{alert(){nativeCalls++}}}});
 const stop=api.escucharAvisos(a=>{current=a});
 const buttons=['Spam','Acoso','Abuso de menores','Odio','Otro','Cancelar'].map(text=>({text}));
 api.Alert.alert('Reportar','Motivo',buttons);
 assert.equal(nativeCalls,0);assert.equal(current.buttons.length,6);assert.equal(current.buttons[4].text,'Otro');stop();
});
