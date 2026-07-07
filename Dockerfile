# ---- Stage 1: exportar la web ----
FROM node:20-alpine AS builder
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

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx expo export --platform web
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
