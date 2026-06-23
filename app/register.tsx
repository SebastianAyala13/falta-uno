import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import Chip from '@/components/Chip';
import Field from '@/components/Field';
import { Colors } from '@/constants/colors';
import { APP, NIVELES, POSICIONES, type Nivel, type Posicion } from '@/constants/config';

export default function RegisterScreen() {
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [ciudad, setCiudad] = useState<string>(APP.defaultCity);
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const [nivel, setNivel] = useState<Nivel | null>(null);
  const [celular, setCelular] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = () => {
    // TODO: conectar con supabase.auth.signUp + insert en profiles
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-6 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-card">
          <Ionicons name="chevron-back" size={22} color={Colors.cream} />
        </Pressable>
        <Text className="font-display text-3xl uppercase text-cream">Armá tu perfil</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
        <Text className="mb-6 font-body text-sm text-muted">
          Contanos cómo jugás, parce. Así te cuadramos con los partidos que van con vos.
        </Text>

        <Field
          label="Nombre"
          placeholder="Tu nombre"
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="words"
        />

        <Field
          label="Ciudad"
          placeholder="Pereira"
          value={ciudad}
          onChangeText={setCiudad}
          autoCapitalize="words"
        />

        {/* Posición */}
        <Text className="mb-2 font-body-semibold text-sm text-cream">Posición</Text>
        <View className="mb-4 flex-row flex-wrap">
          {POSICIONES.map((p) => (
            <Chip key={p} label={p} selected={posicion === p} onPress={() => setPosicion(p)} />
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
          label="Número de celular"
          placeholder="+57 3xx xxx xxxx"
          value={celular}
          onChangeText={setCelular}
          keyboardType="phone-pad"
        />

        <Field
          label="Contraseña"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <View className="mt-2">
          <Button label="Crear cuenta" variant="accent" onPress={onSubmit} />
        </View>

        <Text className="mt-4 text-center font-body text-xs text-muted">
          ¿Ya tenés cuenta?{' '}
          <Text className="text-primary" onPress={() => router.replace('/(tabs)')}>
            Entrá acá
          </Text>
        </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
