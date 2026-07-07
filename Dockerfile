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
# Empaquetar las páginas legales bajo /legal
RUN mkdir -p dist/legal && cp legal/*.html dist/legal/

# ---- Stage 2: servir con nginx ----
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
