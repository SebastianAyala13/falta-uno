import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/BackButton';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import { MEDIOS_PAGO } from '@/constants/config';
import { precioCOP } from '@/lib/format';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';

const nombreMedio = (id: string) => MEDIOS_PAGO.find((m) => m.id === id)?.nombre ?? id;

export default function MisPagos() {
  const pagos = useStore((s) => s.pagos);
  const getPartido = useStore((s) => s.getPartido);
  const c = useTheme();

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Mis pagos" className="px-6 pb-2 pt-2" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {pagos.length === 0 ? (
          <FadeIn delay={60} className="mt-16 items-center">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-card">
              <Ionicons name="receipt-outline" size={38} color={c.muted} />
            </View>
            <Text className="mt-4 font-display text-2xl uppercase text-cream">Sin pagos aún</Text>
            <Text className="mt-2 max-w-[260px] text-center font-body text-sm text-muted">
              Cuando te inscribas a un partido, acá te queda el comprobante.
            </Text>
          </FadeIn>
        ) : (
          pagos.map((p, i) => {
            const partido = getPartido(p.partido_id);
            const aprobado = p.estado === 'aprobado';
            return (
              <FadeIn key={p.id} delay={60 + i * 50}>
                <View className="mb-3 flex-row items-center rounded-2xl border border-border bg-card p-4">
                  <View
                    className="h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: aprobado ? c.primary + '22' : c.warning + '22' }}>
                    <Ionicons name={aprobado ? 'checkmark-circle' : 'time'} size={22} color={aprobado ? c.primary : c.warning} />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="font-body-bold text-base text-cream" numberOfLines={1}>
                      {partido?.cancha ?? 'Partido'}
                    </Text>
                    <Text className="font-body text-xs text-muted">
                      {nombreMedio(p.medio)} · {p.referencia}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-display text-lg text-cream">{precioCOP(p.monto)}</Text>
                    <Text className="font-body text-[10px] uppercase tracking-wide" style={{ color: aprobado ? c.primary : c.warning }}>
                      {aprobado ? 'Aprobado' : 'Pendiente'}
                    </Text>
                  </View>
                </View>
              </FadeIn>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
