import { Redirect } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { Dimensions, View } from 'react-native';

import { useAuth } from '@/lib/auth';

const { width, height } = Dimensions.get('window');

// Animación de marca al abrir: el video del logo sobre el Negro Tribuna.
const INTRO = require('../assets/brand/intro.mp4');

export default function Index() {
  const { profile, loading } = useAuth();
  const [done, setDone] = useState(false);

  const player = useVideoPlayer(INTRO, (p) => {
    p.muted = true;
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const end = player.addListener('playToEnd', () => setDone(true));
    const st = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') setDone(true);
    });
    // Tope de seguridad por si el video no avisa el fin
    const safety = setTimeout(() => setDone(true), 6000);
    return () => {
      end.remove();
      st.remove();
      clearTimeout(safety);
    };
  }, [player]);

  if (done && !loading) {
    return <Redirect href={profile ? '/(tabs)' : '/(auth)/welcome'} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F0D', alignItems: 'center', justifyContent: 'center' }}>
      <VideoView
        player={player}
        style={{ width, height }}
        contentFit="contain"
        nativeControls={false}
        pointerEvents="none"
      />
    </View>
  );
}
