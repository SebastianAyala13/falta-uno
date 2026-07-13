import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import Badge from '@/components/Badge';
import { ScreenHeader } from '@/components/BackButton';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { CardListSkeleton, SkeletonBlock } from '@/components/Skeleton';
import { BANCOS, COMISION_CANCHA_DEFAULT, MEMBRESIA, MERCADOPAGO_CONFIGURADO } from '@/constants/config';
import { useAuth } from '@/lib/auth';
import {
  getDatosDesembolso,
  guardarDatosDesembolso,
  membresiaActiva,
  misCanchas,
  movimientos,
  retirosDeCancha,
  saldoCancha,
  solicitarRetiro,
} from '@/lib/canchas';
import { precioCOP, tiempoRelativo } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { Cancha, DatosDesembolso, MovimientoCancha, Retiro } from '@/types/database';

const TIPOS_CUENTA: { id: DatosDesembolso['tipo_cuenta']; label: string }[] = [
  { id: 'ahorros', label: 'Ahorros' },
  { id: 'corriente', label: 'Corriente' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'daviplata', label: 'Daviplata' },
];

const TIPO_MOVIMIENTO: Record<MovimientoCancha['tipo'], string> = {
  ingreso_reserva: 'Ingreso por reserva',
  comision: 'Comisión',
  retiro: 'Retiro',
  ajuste: 'Ajuste',
};

const ESTADO_RETIRO: Record<Retiro['estado'], { label: string; tone: 'primary' | 'warning' | 'danger' }> = {
  solicitado: { label: 'Solicitado', tone: 'warning' },
  procesando: { label: 'Procesando', tone: 'warning' },
  pagado: { label: 'Pagado', tone: 'primary' },
  rechazado: { label: 'Rechazado', tone: 'danger' },
};

export default function Finanzas() {
  const router = useRouter();
  const { profile } = useAuth();
  const c = useTheme();

  const [cancha, setCancha] = useState<Cancha | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [movs, setMovs] = useState<MovimientoCancha[]>([]);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [esPro, setEsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalRetiro, setModalRetiro] = useState(false);
  const [monto, setMonto] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Datos de desembolso (cuenta del dueño)
  const [desembolso, setDesembolso] = useState<DatosDesembolso | null>(null);
  const [modalCuenta, setModalCuenta] = useState(false);
  const [banco, setBanco] = useState<string>(BANCOS[0]);
  const [tipoCuenta, setTipoCuenta] = useState<DatosDesembolso['tipo_cuenta']>('ahorros');
  const [numero, setNumero] = useState('');
  const [titular, setTitular] = useState('');
  const [documento, setDocumento] = useState('');
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);

  const cargarDatos = useCallback(async (cch: Cancha) => {
    const [s, m, r, pro] = await Promise.all([
      saldoCancha(cch.id),
      movimientos(cch.id),
      retirosDeCancha(cch.id),
      membresiaActiva(cch.id),
    ]);
    setSaldo(s);
    setMovs(m);
    setRetiros(r);
    setEsPro(pro);
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        if (!profile) return;
        const [canchas, dd] = await Promise.all([misCanchas(profile.id), getDatosDesembolso(profile.id)]);
        if (!activo) return;
        const cch = canchas[0] ?? null;
        setCancha(cch);
        setDesembolso(dd);
        if (cch) await cargarDatos(cch);
      } finally {
        if (activo) setLoading(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, [profile, cargarDatos]);

  const onRefresh = useCallback(async () => {
    if (!cancha) return;
    setRefreshing(true);
    try {
      await cargarDatos(cancha);
    } finally {
      setRefreshing(false);
    }
  }, [cancha, cargarDatos]);

  const confirmarRetiro = async () => {
    if (!cancha) return;
    const valor = Number(monto);
    if (!monto.trim() || Number.isNaN(valor) || valor <= 0) {
      Alert.alert('Monto inválido', 'Ingresá un monto mayor a cero, parce.');
      return;
    }
    setEnviando(true);
    try {
      await solicitarRetiro(cancha.id, valor);
      setModalRetiro(false);
      setMonto('');
      await cargarDatos(cancha);
      Alert.alert('¡Retiro solicitado!', 'Te lo desembolsamos pronto.');
    } catch (e) {
      Alert.alert('No se pudo', e instanceof Error ? e.message : 'Intentá de nuevo en un rato.');
    } finally {
      setEnviando(false);
    }
  };

  const abrirCuenta = () => {
    if (desembolso) {
      setBanco(desembolso.banco);
      setTipoCuenta(desembolso.tipo_cuenta);
      setNumero(desembolso.numero);
      setTitular(desembolso.titular);
      setDocumento(desembolso.documento);
    }
    setModalCuenta(true);
  };

  const guardarCuenta = async () => {
    if (!profile) return;
    if (!titular.trim() || !numero.trim() || !documento.trim()) {
      Alert.alert('Faltan datos', 'Completá titular, número de cuenta y documento.');
      return;
    }
    setGuardandoCuenta(true);
    try {
      const datos = {
        banco,
        tipo_cuenta: tipoCuenta,
        numero: numero.trim(),
        titular: titular.trim(),
        documento: documento.trim(),
      };
      await guardarDatosDesembolso(profile.id, datos);
      setDesembolso({ owner_id: profile.id, ...datos, created_at: '', updated_at: '' });
      setModalCuenta(false);
      Alert.alert('Guardado', 'Tus datos de desembolso quedaron guardados.');
    } catch (e) {
      Alert.alert('No se pudo', e instanceof Error ? e.message : 'Intentá de nuevo.');
    } finally {
      setGuardandoCuenta(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Finanzas" className="px-6 pb-2 pt-2" />

      {loading ? (
        <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
          <View className="rounded-lg border border-border bg-card p-6">
            <SkeletonBlock height={12} width={'42%'} />
            <View style={{ height: 16 }} />
            <SkeletonBlock height={40} width={'60%'} />
            <View style={{ height: 22 }} />
            <SkeletonBlock height={48} radius={18} />
          </View>
          <View style={{ height: 28 }} />
          <SkeletonBlock height={18} width={'35%'} />
          <View style={{ height: 14 }} />
          <CardListSkeleton rows={3} />
        </View>
      ) : !cancha ? (
        <EmptyState
          icon="business-outline"
          titulo="Sin cancha registrada"
          texto="Registrá tu cancha para empezar a recibir reservas y ver tus finanzas acá."
          cta={{ label: 'Registrar mi cancha', onPress: () => router.push('/cancha/registrar') }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }>
          {/* Saldo disponible */}
          <FadeIn delay={40}>
            <View className="rounded-lg border border-borderStrong bg-card p-6">
              <Text className="font-body text-xs uppercase tracking-wider text-muted">Saldo disponible</Text>
              <Text className="mt-2 font-display text-4xl text-cream" style={{ lineHeight: 46, paddingTop: 2 }}>
                {precioCOP(saldo)}
              </Text>
              <View className="mt-4">
                <GlowButton
                  label="Solicitar retiro"
                  variant="primary"
                  icon="cash-outline"
                  disabled={saldo <= 0}
                  onPress={() => setModalRetiro(true)}
                />
              </View>
              <View className="mt-4 flex-row items-center justify-between border-t border-border pt-3">
                <Text className="font-body text-sm text-muted">Comisión actual</Text>
                <Text className="font-body-bold text-sm" style={{ color: esPro ? c.primary : c.cream }}>
                  {esPro ? '0% (Cancha Pro)' : `${Math.round(COMISION_CANCHA_DEFAULT * 100)}%`}
                </Text>
              </View>
            </View>
          </FadeIn>

          {/* Membresía */}
          <FadeIn delay={100}>
            <View className="mt-4 rounded-lg border border-border bg-card p-5">
              <View className="flex-row items-center">
                <View
                  className="h-11 w-11 items-center justify-center rounded-sm"
                  style={{ backgroundColor: c.accent + '22' }}>
                  <Ionicons name="star" size={22} color={c.accentText} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-body-bold text-base text-cream">{MEMBRESIA.nombre}</Text>
                  <Text className="font-body text-xs text-muted">
                    {precioCOP(MEMBRESIA.precioMensual)}/mes
                  </Text>
                </View>
              </View>
              <Text className="mt-3 font-body text-sm text-muted">{MEMBRESIA.beneficio}</Text>
              <View className="mt-4">
                {MERCADOPAGO_CONFIGURADO ? (
                  <GlowButton
                    label="Activar membresía"
                    variant="accent"
                    icon="star-outline"
                    onPress={() =>
                      Alert.alert('Disponible pronto', 'La activación de membresía se habilita en breve.')
                    }
                  />
                ) : (
                  <GlowButton label="Próximamente" variant="dark" icon="time-outline" disabled />
                )}
              </View>
            </View>
          </FadeIn>

          {/* Datos de desembolso (cuenta del dueño) */}
          <FadeIn delay={130}>
            <View className="mt-4 rounded-lg border border-border bg-card p-5">
              <View className="flex-row items-center">
                <View
                  className="h-11 w-11 items-center justify-center rounded-sm"
                  style={{ backgroundColor: c.primary + '22' }}>
                  <Ionicons name="card-outline" size={22} color={c.primary} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-body-bold text-base text-cream">Datos para recibir tu plata</Text>
                  <Text className="font-body text-xs text-muted">
                    {desembolso ? 'A dónde te desembolsamos tus retiros.' : 'Cargá tu cuenta para poder retirar.'}
                  </Text>
                </View>
              </View>
              {desembolso ? (
                <View className="mt-3 rounded-md border border-border bg-background p-3">
                  <Text className="font-body-semibold text-sm text-cream">
                    {desembolso.banco} · {TIPOS_CUENTA.find((t) => t.id === desembolso.tipo_cuenta)?.label}
                  </Text>
                  <Text className="font-body text-xs text-muted">
                    •••• {desembolso.numero.slice(-4)} · {desembolso.titular}
                  </Text>
                </View>
              ) : null}
              <View className="mt-4">
                <GlowButton
                  label={desembolso ? 'Editar cuenta' : 'Agregar cuenta'}
                  variant={desembolso ? 'dark' : 'primary'}
                  icon="card-outline"
                  onPress={abrirCuenta}
                />
              </View>
            </View>
          </FadeIn>

          {/* Nota informativa */}
          <FadeIn delay={160}>
            <View className="mt-4 flex-row items-start rounded-md border border-border bg-card p-4">
              <Ionicons name="information-circle-outline" size={20} color={c.muted} style={{ marginTop: 1 }} />
              <Text className="ml-2 flex-1 font-body text-xs text-muted">
                Los ingresos por reservas pagadas en efectivo los cobrás directo en la cancha. El saldo acá
                refleja los pagos online (próximamente con Mercado Pago).
              </Text>
            </View>
          </FadeIn>

          {/* Movimientos */}
          <FadeIn delay={220}>
            <Text className="mb-3 mt-7 font-display text-xl uppercase text-cream" style={{ lineHeight: 26, paddingTop: 2 }}>
              Movimientos
            </Text>
            {movs.length === 0 ? (
              <Text className="font-body text-sm text-muted">
                Todavía no hay movimientos. Tus ingresos por reservas online aparecerán acá.
              </Text>
            ) : (
              movs.map((m) => {
                const positivo = m.monto > 0;
                const color = positivo ? c.primary : c.danger;
                return (
                  <View
                    key={m.id}
                    className="mb-3 flex-row items-center rounded-md border border-border bg-card p-4">
                    <View
                      className="h-10 w-10 items-center justify-center rounded-sm"
                      style={{ backgroundColor: color + '22' }}>
                      <Ionicons
                        name={positivo ? 'arrow-down-circle' : 'arrow-up-circle'}
                        size={20}
                        color={color}
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="font-body-bold text-sm text-cream" numberOfLines={1}>
                        {TIPO_MOVIMIENTO[m.tipo]}
                      </Text>
                      {m.descripcion ? (
                        <Text className="font-body text-xs text-muted" numberOfLines={1}>
                          {m.descripcion}
                        </Text>
                      ) : null}
                      <Text className="font-body text-xs text-muted">{tiempoRelativo(m.created_at)}</Text>
                    </View>
                    <Text className="font-display text-base" style={{ color }}>
                      {positivo ? '+' : '-'}
                      {precioCOP(Math.abs(m.monto))}
                    </Text>
                  </View>
                );
              })
            )}
          </FadeIn>

          {/* Retiros */}
          {retiros.length > 0 ? (
            <FadeIn delay={280}>
              <Text className="mb-3 mt-7 font-display text-xl uppercase text-cream" style={{ lineHeight: 26, paddingTop: 2 }}>
                Retiros
              </Text>
              {retiros.map((r) => {
                const estado = ESTADO_RETIRO[r.estado];
                return (
                  <View
                    key={r.id}
                    className="mb-3 flex-row items-center rounded-md border border-border bg-card p-4">
                    <View className="flex-1">
                      <Text className="font-display text-base text-cream">{precioCOP(r.monto)}</Text>
                      <Text className="font-body text-xs text-muted">{tiempoRelativo(r.solicitado_at)}</Text>
                    </View>
                    <Badge label={estado.label} tone={estado.tone} />
                  </View>
                );
              })}
            </FadeIn>
          ) : null}
        </ScrollView>
      )}

      {/* Modal de retiro */}
      <Modal visible={modalRetiro} transparent animationType="fade" onRequestClose={() => setModalRetiro(false)}>
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View className="w-full rounded-lg border border-borderStrong bg-background p-6">
            <View className="flex-row items-center justify-between">
              <Text className="font-display text-2xl uppercase text-cream" style={{ lineHeight: 30, paddingTop: 2 }}>
                Solicitar retiro
              </Text>
              <Pressable onPress={() => setModalRetiro(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={c.muted} />
              </Pressable>
            </View>
            <Text className="mb-4 mt-1 font-body text-sm text-muted">
              Saldo disponible: {precioCOP(saldo)}
            </Text>
            <Field
              label="Monto a retirar"
              icon="cash-outline"
              placeholder="Ej: 50000"
              keyboardType="numeric"
              value={monto}
              onChangeText={setMonto}
            />
            <GlowButton
              label="Confirmar"
              variant="primary"
              icon="checkmark"
              loading={enviando}
              onPress={confirmarRetiro}
            />
          </View>
        </View>
      </Modal>

      {/* Modal de datos de desembolso */}
      <Modal visible={modalCuenta} transparent animationType="fade" onRequestClose={() => setModalCuenta(false)}>
        <View className="flex-1 justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className="w-full rounded-lg border border-borderStrong bg-background p-6">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="font-display text-2xl uppercase text-cream" style={{ lineHeight: 30, paddingTop: 2 }}>
                  Tu cuenta
                </Text>
                <Pressable onPress={() => setModalCuenta(false)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={c.muted} />
                </Pressable>
              </View>
              <Text className="mb-2 font-body-semibold text-sm text-cream">Banco / billetera</Text>
              <View className="mb-3 flex-row flex-wrap">
                {BANCOS.map((b) => (
                  <Chip key={b} label={b} selected={banco === b} onPress={() => setBanco(b)} />
                ))}
              </View>
              <Text className="mb-2 font-body-semibold text-sm text-cream">Tipo de cuenta</Text>
              <View className="mb-3 flex-row flex-wrap">
                {TIPOS_CUENTA.map((t) => (
                  <Chip key={t.id} label={t.label} selected={tipoCuenta === t.id} onPress={() => setTipoCuenta(t.id)} />
                ))}
              </View>
              <Field
                label="Número de cuenta / celular"
                icon="card-outline"
                placeholder="Número"
                keyboardType="numeric"
                value={numero}
                onChangeText={setNumero}
              />
              <Field
                label="Titular"
                icon="person-outline"
                placeholder="Nombre del titular"
                value={titular}
                onChangeText={setTitular}
                autoCapitalize="words"
              />
              <Field
                label="Documento (cédula/NIT)"
                icon="document-text-outline"
                placeholder="Documento del titular"
                keyboardType="numeric"
                value={documento}
                onChangeText={setDocumento}
              />
              <GlowButton
                label="Guardar cuenta"
                variant="primary"
                icon="save"
                loading={guardandoCuenta}
                onPress={guardarCuenta}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}
