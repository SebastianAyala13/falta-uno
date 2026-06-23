import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Chip from '@/components/Chip';
import GameCard from '@/components/GameCard';
import { Colors } from '@/constants/colors';
import { FORMATOS, NIVELES, POSICIONES, ZONAS } from '@/constants/config';
import { partidosDisponibles } from '@/lib/mockData';

type FiltroKey = 'zona' | 'nivel' | 'formato';

export default function BuscarScreen() {
  const [query, setQuery] = useState('');
  const [zona, setZona] = useState<string | null>(null);
  const [nivel, setNivel] = useState<string | null>(null);
  const [formato, setFormato] = useState<string | null>(null);

  const toggle = (
    actual: string | null,
    valor: string,
    setter: (v: string | null) => void,
  ) => setter(actual === valor ? null : valor);

  const resultados = useMemo(() => {
    return partidosDisponibles.filter((p) => {
      if (query && !`${p.cancha} ${p.zona}`.toLowerCase().includes(query.toLowerCase()))
        return false;
      if (zona && p.zona !== zona) return false;
      if (nivel && p.nivel !== nivel) return false;
      if (formato && p.formato !== formato) return false;
      return true;
    });
  }, [query, zona, nivel, formato]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-6 pb-2 pt-2">
        <Text className="mb-4 font-display text-3xl uppercase text-cream">Buscar partido</Text>

        {/* Search bar */}
        <View className="mb-4 h-14 flex-row items-center rounded-2xl border border-border bg-card px-4">
          <Ionicons name="search" size={20} color={Colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cancha, zona, parche..."
            placeholderTextColor={Colors.muted}
            className="ml-3 flex-1 font-body text-base text-cream"
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        {/* Filtros */}
        <View className="px-6">
          <FiltroFila titulo="Zona">
            {ZONAS.map((z) => (
              <Chip key={z} label={z} selected={zona === z} onPress={() => toggle(zona, z, setZona)} />
            ))}
          </FiltroFila>

          <FiltroFila titulo="Nivel">
            {NIVELES.map((n) => (
              <Chip
                key={n}
                label={n}
                selected={nivel === n}
                onPress={() => toggle(nivel, n, setNivel)}
              />
            ))}
          </FiltroFila>

          <FiltroFila titulo="Formato">
            {FORMATOS.map((f) => (
              <Chip
                key={f}
                label={f}
                selected={formato === f}
                onPress={() => toggle(formato, f, setFormato)}
              />
            ))}
          </FiltroFila>
        </View>

        {/* Resultados */}
        <View className="mb-2 mt-2 flex-row items-center justify-between px-6">
          <Text className="font-body-semibold text-sm text-muted">
            {resultados.length} {resultados.length === 1 ? 'partido' : 'partidos'} disponibles
          </Text>
        </View>

        <View className="px-6">
          {resultados.length === 0 ? (
            <View className="mt-10 items-center">
              <Ionicons name="sad-outline" size={40} color={Colors.muted} />
              <Text className="mt-3 text-center font-body text-sm text-muted">
                No hay partidos con esos filtros, parce.{'\n'}Probá quitando alguno.
              </Text>
            </View>
          ) : (
            resultados.map((p) => <GameCard key={p.id} partido={p} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FiltroFila({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="mb-2 font-body-semibold text-xs uppercase tracking-wide text-muted">
        {titulo}
      </Text>
      <View className="flex-row flex-wrap">{children}</View>
    </View>
  );
}
