import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import GameCard from '@/components/GameCard';
import Screen from '@/components/Screen';
import SearchBar from '@/components/SearchBar';
import { GameCardSkeleton } from '@/components/Skeleton';
import { FORMATOS, NIVELES, ZONAS } from '@/constants/config';
import { matchDateTime } from '@/lib/format';
import GlowButton from '@/components/GlowButton';
import { useAuth } from '@/lib/auth';
import { buscarPartidos } from '@/lib/partidos';
import { supabaseConfigurado } from '@/lib/supabase';
import { unirPorId } from '@/lib/data-utils';
import type { PartidoConOrganizador } from '@/types/database';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';

export default function Buscar() {
  const { profile } = useAuth();
  const partidos = useStore((s) => s.partidos);
  const hidratado = useStore((s) => s.hidratado);
  const hidratar = useStore((s) => s.hidratar);
  const c = useTheme();
  // Mostramos skeletons hasta que la primera hidratación desde Supabase termine
  const errorCarga = useStore(s => s.errorCarga);
  const cargando = !hidratado && !errorCarga;
  const [query, setQuery] = useState('');
  const [zona, setZona] = useState<string | null>(null);
  const [nivel, setNivel] = useState<string | null>(null);
  const [formato, setFormato] = useState<string | null>(null);
  const [remotos,setRemotos] = useState<PartidoConOrganizador[]>([]);
  const [hayMas,setHayMas] = useState(false);
  const [cargandoBusqueda,setCargandoBusqueda] = useState(supabaseConfigurado);
  const [cargandoMas,setCargandoMas] = useState(false);
  const [errorMas,setErrorMas] = useState<string | null>(null);
  const [revision,setRevision] = useState(0);
  const cursor = useRef<PartidoConOrganizador | undefined>(undefined);
  const version = useRef(0);
  useEffect(() => {
    const actual = ++version.current;
    if (!supabaseConfigurado) return;
    setCargandoBusqueda(true);
    setRemotos([]); setHayMas(false); setErrorMas(null); cursor.current=undefined;
    const t=setTimeout(() => {
      buscarPartidos({texto:query,zona,nivel,formato}).then(r=>{
        if (actual!==version.current) return;
        setRemotos(r.filas);setHayMas(r.hayMas);cursor.current=r.cursor;
      }).catch(()=>{if(actual===version.current)setErrorMas('No pudimos buscar partidos. Reintentá.');})
        .finally(()=>{if(actual===version.current)setCargandoBusqueda(false);});
    },250);
    return ()=>{clearTimeout(t);version.current=actual+1;};
  },[query,zona,nivel,formato,revision,profile?.id]);
  const mas = async () => {
    if (cargandoMas || !hayMas) return;
    const actual=version.current;
    setCargandoMas(true);
    try {
      const r=await buscarPartidos({texto:query,zona,nivel,formato},cursor.current);
      if(actual!==version.current)return;
      setRemotos(prev=>unirPorId(prev,r.filas));setHayMas(r.hayMas);cursor.current=r.cursor;setErrorMas(null);
    } catch {if(actual===version.current)setErrorMas('No pudimos cargar más partidos. Reintentá.');}
    finally {setCargandoMas(false);}
  };


  const toggle = (actual: string | null, valor: string, set: (v: string | null) => void) =>
    set(actual === valor ? null : valor);

  const resultados = useMemo(
    () =>
      (supabaseConfigurado ? remotos : partidos).filter((p) => {
        if (matchDateTime(p.fecha,p.hora).getTime() <= Date.now()) return false;
        if (query && !`${p.cancha} ${p.zona}`.toLowerCase().includes(query.toLowerCase())) return false;
        if (zona && p.zona !== zona) return false;
        if (nivel && p.nivel !== nivel) return false;
        if (formato && p.formato !== formato) return false;
        return true;
      }),
    [partidos, remotos, query, zona, nivel, formato],
  );

  const hayFiltros = zona || nivel || formato || query;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    if (supabaseConfigurado) setRevision(r=>r+1);
    else if (profile?.id) await hidratar(profile.id, true);
    setRefreshing(false);
  };

  return (
    <Screen>
      <FadeIn delay={40}>
        <View className="px-6 pb-3 pt-2">
          <Text className="mb-4 font-display text-4xl uppercase text-cream" style={{ lineHeight: 44, paddingTop: 2 }}>Buscar partido</Text>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Cancha, zona, parche..." />
        </View>
      </FadeIn>

      <ErrorBanner message={errorCarga ?? errorMas} className="mx-6 mt-2" />
      <FlatList
        data={cargando || cargandoBusqueda ? [] : resultados}
        keyExtractor={p=>p.id}
        renderItem={({item,index}) => <View className="px-6"><FadeIn delay={60+Math.min(index,6)*50}><GameCard partido={item} /></FadeIn></View>}
        ListFooterComponent={hayMas ? <View className="px-6"><GlowButton label="Cargar más partidos" variant="outline" loading={cargandoMas} onPress={mas} /></View> : null}
        ListHeaderComponent={<>
        <FadeIn delay={120}>
          <View className="px-6">
            <Filtro titulo="Zona">
              {ZONAS.map((z) => (
                <Chip key={z} label={z} selected={zona === z} onPress={() => toggle(zona, z, setZona)} />
              ))}
            </Filtro>
            <Filtro titulo="Nivel">
              {NIVELES.map((n) => (
                <Chip key={n} label={n} selected={nivel === n} onPress={() => toggle(nivel, n, setNivel)} />
              ))}
            </Filtro>
            <Filtro titulo="Formato">
              {FORMATOS.map((f) => (
                <Chip key={f} label={f} selected={formato === f} onPress={() => toggle(formato, f, setFormato)} />
              ))}
            </Filtro>
          </View>
        </FadeIn>

        <View className="mb-2 mt-2 flex-row items-center justify-between px-6">
          <Text className="font-body-semibold text-sm text-muted">
            {resultados.length} {resultados.length === 1 ? 'partido' : 'partidos'}
          </Text>
          {hayFiltros ? (
            <Text
              onPress={() => {
                setZona(null);
                setNivel(null);
                setFormato(null);
                setQuery('');
              }}
              className="font-body-semibold text-sm text-primary">
              Limpiar
            </Text>
          ) : null}
        </View>

        </>}
        contentContainerStyle={{paddingBottom:110}}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
        ListEmptyComponent={cargando || cargandoBusqueda ? <View className="px-6"><GameCardSkeleton /><GameCardSkeleton /><GameCardSkeleton /></View> :
          <EmptyState icon="search-outline" titulo={hayFiltros ? 'Nada con esos filtros' : 'Tu zona está quieta'} texto={hayFiltros ? 'Probá quitando alguno, parce.' : 'Nadie ha armado pichanga por acá. Sé el primero 👟'} />}
      />
    </Screen>
  );
}

function Filtro({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="mb-2 font-body-semibold text-xs uppercase tracking-wider text-muted">{titulo}</Text>
      <View className="flex-row flex-wrap">{children}</View>
    </View>
  );
}
