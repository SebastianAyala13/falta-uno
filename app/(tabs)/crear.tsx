import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import Chip from '@/components/Chip';
import Field from '@/components/Field';
import {
  FORMATOS,
  NIVELES,
  ZONAS,
  type Formato,
  type Nivel,
  type Zona,
} from '@/constants/config';

export default function CrearScreen() {
  const [cancha, setCancha] = useState('');
  const [zona, setZona] = useState<Zona | null>(null);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [formato, setFormato] = useState<Formato | null>(null);
  const [nivel, setNivel] = useState<Nivel | null>(null);
  const [precio, setPrecio] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const onSubmit = () => {
    // TODO: insertar en supabase.from('partidos')
    Alert.alert('¡Listo, parce!', 'Tu partido quedó publicado. Ahora a cuadrar la llave. ⚽');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-6 pb-1 pt-2">
        <Text className="font-display text-3xl uppercase text-cream">Crear partido</Text>
        <Text className="mt-1 font-body text-sm text-muted">
          Armá el parche y dejá que la gente se cuadre.
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Field
            label="Nombre de la cancha"
            placeholder="Ej. Cancha La Bombonera"
            value={cancha}
            onChangeText={setCancha}
            autoCapitalize="words"
          />

          {/* Zona */}
          <Text className="mb-2 font-body-semibold text-sm text-cream">Zona</Text>
          <View className="mb-4 flex-row flex-wrap">
            {ZONAS.map((z) => (
              <Chip key={z} label={z} selected={zona === z} onPress={() => setZona(z)} />
            ))}
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label="Fecha"
                placeholder="2026-06-25"
                value={fecha}
                onChangeText={setFecha}
              />
            </View>
            <View className="flex-1">
              <Field label="Hora" placeholder="20:00" value={hora} onChangeText={setHora} />
            </View>
          </View>

          {/* Formato */}
          <Text className="mb-2 font-body-semibold text-sm text-cream">Número de jugadores</Text>
          <View className="mb-4 flex-row flex-wrap">
            {FORMATOS.map((f) => (
              <Chip key={f} label={f} selected={formato === f} onPress={() => setFormato(f)} />
            ))}
          </View>

          {/* Nivel */}
          <Text className="mb-2 font-body-semibold text-sm text-cream">Nivel</Text>
          <View className="mb-4 flex-row flex-wrap">
            {NIVELES.map((n) => (
              <Chip key={n} label={n} selected={nivel === n} onPress={() => setNivel(n)} />
            ))}
          </View>

          <Field
            label="Precio por jugador (COP)"
            placeholder="12000"
            value={precio}
            onChangeText={setPrecio}
            keyboardType="numeric"
            hint="Lo que pone cada uno para la cancha."
          />

          <Field
            label="Descripción"
            placeholder="Contale al parche cómo está la cosa..."
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={3}
            style={{ height: 100, paddingTop: 14, textAlignVertical: 'top' }}
          />

          <View className="mt-2">
            <Button label="Publicar partido" variant="accent" onPress={onSubmit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
