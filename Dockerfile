# ---- Stage 1: exportar la web ----
# Node 22: pnpm 11 usa node:sqlite (built-in desde Node 22), no disponible en Node 20.
FROM node:22-alpine AS builder
WORKDIR /app

# Vars públicas que se hornean en el bundle al exportar
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ARG EXPO_PUBLIC_SITE_URL
ARG EXPO_PUBLIC_LEMONSQUEEZY_ENABLED
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL \
    EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY \
    EXPO_PUBLIC_SITE_URL=$EXPO_PUBLIC_SITE_URL \
    EXPO_PUBLIC_LEMONSQUEEZY_ENABLED=$EXPO_PUBLIC_LEMONSQUEEZY_ENABLED

# Este proyecto usa pnpm (no npm). corepack activa la versión fijada en el campo
# "packageManager" de package.json. pnpm-workspace.yaml trae `nodeLinker: hoisted`,
# imprescindible para que Metro/NativeWind resuelvan un node_modules plano.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Instalar deps con el lockfile del repo (cacheable si no cambian estos archivos)
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# Guardarraíl (pre-export): en app/ el mapa va SIEMPRE por @/components/CanchaMap
# (tiene variante .web). Un import directo de react-native-maps es native-only y
# rompe el export web con un error críptico de Metro; fallamos temprano y claro.
RUN if grep -rl "react-native-maps" app/ >/dev/null 2>&1; then echo "ERROR: import directo de react-native-maps en app/ -> usá el componente @/components/CanchaMap"; exit 1; fi
RUN pnpm exec expo export --platform web
# Guardarraíl: el bundle web se carga con <script> clásico (no type=module), así que
# NO puede contener import.meta u otros tokens solo-módulo. Si alguno no parsea como
# script clásico, fallamos el build acá en vez de servir una página en blanco.
RUN node -e "const vm=require('vm'),fs=require('fs'),p=require('path');const d='dist/_expo/static/js/web';let n=0;for(const f of fs.readdirSync(d)){if(!f.endsWith('.js'))continue;new vm.Script(fs.readFileSync(p.join(d,f),'utf8'),{filename:f});n++;}console.log('OK: '+n+' bundle(s) web parsean como classic script');"
# Empaquetar las páginas legales bajo /legal
RUN mkdir -p dist/legal && cp legal/*.html dist/legal/

# ---- Stage 2: servir con nginx ----
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
