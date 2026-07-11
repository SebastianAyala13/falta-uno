# Migración a Supabase CLI (migraciones versionadas) — Plan de Implementación

> **Para workers agénticos:** SUB-SKILL REQUERIDA: usá superpowers:subagent-driven-development
> (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos
> usan checkbox (`- [ ]`) para el seguimiento.

**Goal:** Reemplazar el schema idempotente (`supabase/schema.sql` + `pnpm supa:setup`) por migraciones
versionadas del CLI de Supabase, con stack local (Docker) y CI que aplica `db push` a prod.

**Architecture:** El CLI gestiona el schema como migraciones con historial (`schema_migrations`). El
estado actual de prod se convierte en una migración *baseline* con `supabase db pull` (que la marca como
ya aplicada en prod, así el primer `db push` no recrea nada). GitHub Actions aplica migraciones nuevas a
prod en cada push a `main`. Edge Functions y secrets quedan fuera de alcance (los gestiona el owner en el dashboard).

**Tech Stack:** Supabase CLI (devDependency), Docker Desktop, GitHub Actions, pnpm 11 / Node ≥22.

## Global Constraints

- **pnpm, NUNCA npm** (vía corepack). pnpm 11 requiere Node ≥ 22. No hay `package-lock.json`.
- **Build scripts de pnpm 11:** todo dep con postinstall (como `supabase`) debe aprobarse en
  `pnpm-workspace.yaml` bajo `allowBuilds:`, o el binario no se descarga.
- **Project ref:** `gwkzcjgsuxgqejaukbse` — es público (está en la URL de Supabase), NO es secreto.
- **Fuera de alcance:** Edge Functions (`supabase/functions/**`) y secrets → gestionados en el dashboard.
  **No tocar `supabase/functions/`.** Ni el CLI ni el CI las despliegan.
- **Nunca commitear:** DB password, access token, ni dumps con datos de prod. Los secrets van a
  GitHub Secrets; los backups a un directorio gitignoreado.
- **No hay staging:** probar SIEMPRE con `pnpm db:reset` local antes de mergear. `db reset` es
  destructivo y **solo** para la base local — nunca contra prod. El CI solo hace `db push`.
- **Orden de seguridad:** el baseline debe quedar marcado como *aplicado* en prod (Tarea 6) ANTES de que
  el CI corra un `db push` (Tarea 13). Y `schema.sql` solo se borra DESPUÉS de validar el baseline.

**Convención de propietario de cada tarea:** `[CLAUDE]` = la ejecuto yo (artefactos del repo).
`[TÚ]` = la corrés vos (requiere credenciales de prod, Docker, o el dashboard/GitHub). En las tareas
`[TÚ]`, pegame la salida de los comandos y yo verifico antes de avanzar.

---

### Task 1: Instalar el CLI de Supabase como devDependency `[CLAUDE]`

**Files:**
- Modify: `pnpm-workspace.yaml:3-4` (agregar `supabase: true` a `allowBuilds:`)
- Modify: `package.json` (devDependencies — lo agrega `pnpm add`)

**Interfaces:**
- Produces: el binario `supabase` disponible vía `pnpm supabase …` para todas las tareas siguientes.

- [ ] **Step 1: Aprobar el build script de `supabase` en pnpm**

En `pnpm-workspace.yaml`, dejar el bloque `allowBuilds:` así:

```yaml
allowBuilds:
  unrs-resolver: true
  supabase: true
```

- [ ] **Step 2: Instalar el CLI como devDependency**

Run: `pnpm add -D supabase`
Expected: instala `supabase`, corre su postinstall (descarga el binario) sin el aviso de "build script
ignored". Se agrega a `devDependencies` en `package.json`.

- [ ] **Step 3: Verificar que el binario funciona**

Run: `pnpm supabase --version`
Expected: imprime una versión (ej. `2.x.x`), sin error de "command not found".

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml
git commit -m "build: agregar Supabase CLI como devDependency (build aprobado en pnpm)"
```

---

### Task 2: Scripts `db:*` en package.json `[CLAUDE]`

**Files:**
- Modify: `package.json:55-63` (bloque `scripts`)

**Interfaces:**
- Produces: scripts `db:start`, `db:stop`, `db:new`, `db:reset`, `db:diff`, `db:push`, `db:pull`.
- Consumes: el binario `supabase` de la Tarea 1.

- [ ] **Step 1: Reemplazar `supa:setup` por los scripts `db:*`**

En `package.json`, dejar `scripts` así (quitar la línea `"supa:setup"`):

```jsonc
"scripts": {
  "start": "expo start",
  "reset-project": "node ./scripts/reset-project.js",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "web": "expo start --web",
  "lint": "expo lint",
  "db:start": "supabase start",
  "db:stop": "supabase stop",
  "db:new": "supabase migration new",
  "db:reset": "supabase db reset",
  "db:diff": "supabase db diff",
  "db:push": "supabase db push",
  "db:pull": "supabase db pull"
}
```

- [ ] **Step 2: Verificar que pnpm ve los scripts**

Run: `pnpm run`
Expected: lista los scripts e incluye `db:start`, `db:new`, `db:reset`, `db:push`, etc. Ya NO aparece `supa:setup`.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "build: scripts db:* del CLI de Supabase (reemplazan supa:setup)"
```

---

### Task 3: Inicializar el CLI (config.toml + seed local) `[CLAUDE]`

**Files:**
- Create: `supabase/config.toml` (lo genera `supabase init`)
- Create: `supabase/.gitignore` (lo genera `supabase init` — ignora `.branches/`, `.temp/`)
- Modify: `.gitignore` (agregar `backups/`)

**Interfaces:**
- Consumes: el CLI de la Tarea 1.
- Produces: `supabase/config.toml` con el seed local apuntando a `seed-demo.sql`.

- [ ] **Step 1: Generar la config del CLI**

Run: `pnpm supabase init`
Expected: crea `supabase/config.toml` y `supabase/.gitignore`. No borra `schema.sql`, `functions/`, ni los
seed. Si pregunta por generar settings de VS Code / Deno, responder que no (Enter/`n`).

> Nota: `supabase init` puede avisar que `supabase/` ya existe; es esperado — solo agrega `config.toml`
> y `.gitignore`, sin tocar lo demás.

- [ ] **Step 2: Apuntar el seed local a `seed-demo.sql`**

En `supabase/config.toml`, en la sección `[db.seed]`, dejar:

```toml
[db.seed]
enabled = true
sql_paths = ["./seed-demo.sql"]
```

(Dejar `project_id` con su valor por defecto — es un identificador LOCAL para los contenedores Docker,
no el ref remoto. El ref se pasa explícito con `--project-ref` en link/CI.)

- [ ] **Step 3: Gitignorear el directorio de backups**

Agregar al final de `.gitignore` (raíz):

```
# Backups/dumps de la base (pueden tener datos de prod — NUNCA commitear)
backups/
```

- [ ] **Step 4: Verificar**

Run: `git status --short supabase/`
Expected: aparecen `supabase/config.toml` y `supabase/.gitignore` como nuevos. `supabase/.gitignore`
contiene `.branches/` y `.temp/`.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml supabase/.gitignore .gitignore
git commit -m "chore(supabase): inicializar CLI (config.toml + seed local seed-demo.sql)"
```

---

### Task 4: Prerrequisitos de tu máquina `[TÚ]`

**Interfaces:**
- Produces: Docker corriendo + sesión del CLI autenticada, necesarios para las Tareas 5–7 y 13.

- [ ] **Step 1: Instalar Docker Desktop y verificar**

Run: `docker --version`
Expected: imprime una versión (ej. `Docker version 27.x`). Docker Desktop debe estar **abierto/corriendo**.

- [ ] **Step 2: Autenticar el CLI**

Run: `pnpm supabase login`
Expected: abre el navegador para autorizar; al volver, la terminal confirma `Finished supabase login.`

- [ ] **Step 3: Verificar acceso al proyecto**

Run: `pnpm supabase projects list`
Expected: lista tus proyectos e incluye uno con reference id `gwkzcjgsuxgqejaukbse`. Pegame la salida.

---

### Task 5: Backup de producción (BLOQUEANTE) `[TÚ]`

**Interfaces:**
- Produces: un respaldo de prod recuperable ANTES de tocar la base. Ninguna tarea posterior avanza sin esto.

- [ ] **Step 1: Backup desde el dashboard (principal)**

En el dashboard de Supabase → **Database → Backups**: confirmá que hay un backup reciente (o creá uno si
tu plan lo permite). Anotá la fecha/hora.

- [ ] **Step 2: (Opcional pero recomendado) Dump local a `backups/`**

```bash
mkdir -p backups
pnpm supabase db dump --linked -f backups/pre-cli-schema.sql
pnpm supabase db dump --linked --data-only -f backups/pre-cli-data.sql
```

> Nota: esto requiere el link de la Tarea 6 Step 1. Si preferís, corré primero ese paso y volvé acá.
> `backups/` está gitignoreado — estos archivos NO se commitean.

- [ ] **Step 3: Confirmar**

Run: `ls -la backups/` (si hiciste el Step 2) — deben existir los `.sql`. Confirmame que el backup del
dashboard está OK. **No avanzamos a la Tarea 6 sin esta confirmación.**

---

### Task 6: Link + rebaseline con `db pull` `[TÚ]` → commit `[CLAUDE]`

**Files:**
- Create: `supabase/migrations/<timestamp>_remote_schema.sql` (lo genera `db pull`)

**Interfaces:**
- Consumes: CLI autenticado (Tarea 4), backup hecho (Tarea 5).
- Produces: la migración *baseline*, marcada como **aplicada** en el historial de prod.

- [ ] **Step 1: Linkear el proyecto**

Run: `pnpm supabase link --project-ref gwkzcjgsuxgqejaukbse`
Expected: pide la **DB password** (Settings → Database). Al terminar: `Finished supabase link.`

- [ ] **Step 2: Generar el baseline desde prod**

Run: `pnpm supabase db pull`
Expected: crea `supabase/migrations/<timestamp>_remote_schema.sql` con el schema real, e **inserta la
fila correspondiente en `supabase_migrations.schema_migrations` de prod** (la marca como aplicada). Pegame la salida.

- [ ] **Step 3: Verificar que el baseline figura aplicado en remoto**

Run: `pnpm supabase migration list`
Expected: el timestamp del baseline aparece con marca en la columna **Local** y **Remote** (no "pendiente
solo local"). Pegame la salida — yo la verifico.

> Si aparece solo en Local (no en Remote), NO sigas: correr
> `pnpm supabase migration repair --status applied <timestamp>` y volver a listar.

- [ ] **Step 4: Commit del baseline `[CLAUDE]`**

(Yo lo hago una vez que confirmes los Steps 2–3.)

```bash
git add supabase/migrations/
git commit -m "feat(supabase): migración baseline (estado actual de prod via db pull)"
```

---

### Task 7: Validación local con `db reset` `[TÚ]`

**Interfaces:**
- Consumes: Docker (Tarea 4), el baseline (Tarea 6), `config.toml` con seed (Tarea 3).
- Produces: prueba de que el baseline + seed se re-aplican de cero sin errores.

- [ ] **Step 1: Levantar el stack local**

Run: `pnpm db:start`
Expected: Docker levanta los contenedores; imprime las URLs locales (`API URL`, `DB URL`, `Studio URL`).
La 1ª vez descarga imágenes (tarda).

- [ ] **Step 2: Re-aplicar todo desde cero**

Run: `pnpm db:reset`
Expected: `Applying migration <timestamp>_remote_schema.sql...` seguido de `Seeding data from
seed-demo.sql...` y termina sin errores (`Finished supabase db reset.`). Pegame la salida.

- [ ] **Step 3: (Opcional) Bajar el stack**

Run: `pnpm db:stop`

---

### Task 8: Comparar baseline vs schema.sql y borrar schema.sql `[CLAUDE]`

**Files:**
- Delete: `supabase/schema.sql`

**Interfaces:**
- Consumes: baseline validado (Tareas 6–7).

- [ ] **Step 1: Comparar el baseline con `schema.sql` (detectar drift)**

Comparar `supabase/migrations/<timestamp>_remote_schema.sql` contra `supabase/schema.sql`: mismas tablas,
columnas, policies y funciones. Diferencias de orden/formato son normales (el baseline sale del dump de
prod). Si hay diferencias *semánticas* (una tabla/columna/policy que está en uno y no en el otro), reportar
al owner antes de borrar — significa drift entre `schema.sql` y prod, y gana prod.

- [ ] **Step 2: Borrar `schema.sql` (ya es redundante)**

Run: `git rm supabase/schema.sql`
Expected: lo marca para borrado.

- [ ] **Step 3: Verificar que nada lo referencia**

Run: `git grep -n "schema.sql"` (excluyendo docs que vamos a actualizar)
Expected: no quedan referencias en código/scripts activos. (Referencias en `docs/` se arreglan en la Tarea 12.)

- [ ] **Step 4: Commit**

```bash
git add -A supabase/
git commit -m "refactor(supabase): eliminar schema.sql (reemplazado por la migración baseline)"
```

---

### Task 9: Eliminar el enfoque viejo (script + .env + dep pg) `[CLAUDE]`

**Files:**
- Delete: `scripts/supabase-setup.mjs`
- Delete: `.supabase-deploy.env.example`
- Modify: `package.json` (quitar `pg` de devDependencies si no se usa en otro lado)
- Modify: `.gitignore` (quitar líneas obsoletas del enfoque viejo)

**Interfaces:**
- Consumes: nada nuevo. Cierra la eliminación del sistema anterior.

- [ ] **Step 1: Confirmar que `pg` solo lo usaba el script**

Run: `git grep -n "from 'pg'\|require('pg')\|\"pg\""` -- `:!package.json` `:!pnpm-lock.yaml`
Expected: la única referencia estaba en `scripts/supabase-setup.mjs` (que vamos a borrar). Si aparece en
`lib/` o `app/`, NO quitar `pg`.

- [ ] **Step 2: Borrar el script y el .env de ejemplo**

```bash
git rm scripts/supabase-setup.mjs .supabase-deploy.env.example
```

- [ ] **Step 3: Quitar `pg` de devDependencies (si el Step 1 dio limpio)**

Run: `pnpm remove pg`
Expected: lo saca de `devDependencies` y actualiza el lockfile.

- [ ] **Step 4: Limpiar `.gitignore`**

Quitar de `.gitignore` estas 3 líneas (ya no aplican — el script se borró):

```
.supabase-deploy.env
supabase/.tmp-secrets.env
supabase/.env.wompi
```

(y su comentario `# Credenciales de deploy/migración a Supabase (NUNCA commitear)`).

- [ ] **Step 5: Recordatorio al owner `[TÚ]`**

Borrá tu copia local de `.supabase-deploy.env` (está gitignoreada, vive solo en tu PC):
`rm .supabase-deploy.env`

- [ ] **Step 6: Verificar que la app sigue OK**

Run: `pnpm lint`
Expected: sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(supabase): eliminar supa:setup, .supabase-deploy.env.example y dep pg"
```

---

### Task 10: Workflow de CI (GitHub Actions) `[CLAUDE]`

**Files:**
- Create: `.github/workflows/db-migrations.yml`

**Interfaces:**
- Consumes: secrets del repo (los carga el owner en la Tarea 11).
- Produces: aplicación automática de migraciones a prod en push a `main`.

- [ ] **Step 1: Crear el workflow**

`.github/workflows/db-migrations.yml`:

```yaml
name: Aplicar migraciones a Supabase (prod)

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'
      - 'supabase/config.toml'

concurrency:
  group: db-migrations
  cancel-in-progress: false

jobs:
  db-push:
    runs-on: ubuntu-latest
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
      PROJECT_REF: gwkzcjgsuxgqejaukbse
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Link al proyecto
        run: supabase link --project-ref "$PROJECT_REF"

      - name: Aplicar migraciones pendientes
        run: supabase db push
```

- [ ] **Step 2: Validar la sintaxis YAML**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/db-migrations.yml')); print('OK')"`
Expected: `OK` (YAML parseable). Si no hay python, revisar el YAML a mano (indentación de 2 espacios).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/db-migrations.yml
git commit -m "ci: aplicar migraciones de Supabase (db push) en push a main"
```

---

### Task 11: Cargar los GitHub Secrets `[TÚ]`

**Interfaces:**
- Produces: `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD` disponibles para el workflow de la Tarea 10.

- [ ] **Step 1: Agregar los secrets del repo**

En GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**, crear:
- `SUPABASE_ACCESS_TOKEN` — token de cuenta (Supabase → Account → Access Tokens → Generate new token).
- `SUPABASE_DB_PASSWORD` — la DB password (Supabase → Settings → Database).

- [ ] **Step 2: Verificar**

En la misma pantalla deben figurar ambos secrets listados (sus valores no se ven, es lo esperado).
Confirmame que están los dos.

---

### Task 12: Actualizar la documentación `[CLAUDE]`

**Files:**
- Modify: `CLAUDE.md` (sección **Supabase**)
- Modify: `docs/ONBOARDING.md` (setup CLI/Docker + flujo de migraciones)

**Interfaces:**
- Consumes: el flujo definitivo de las Tareas 1–11.

- [ ] **Step 1: Reescribir la sección Supabase de `CLAUDE.md`**

Reemplazar el párrafo que hoy describe `supabase/schema.sql` + `pnpm supa:setup` por uno que describa
migraciones del CLI. Contenido a reflejar (adaptar a la prosa del archivo):

- El schema se gestiona con **migraciones versionadas** en `supabase/migrations/`; la fuente de verdad son
  las migraciones, no un `schema.sql`.
- Dev local con Docker: `pnpm db:start`, cambios con `pnpm db:new <nombre>` (o `pnpm db:diff`), probar con
  `pnpm db:reset` (re-aplica migraciones + `seed-demo.sql`).
- Prod: el push a `main` dispara el workflow `db-migrations.yml` que corre `supabase db push`. `db reset`
  es **solo local**, nunca contra prod. No hay staging → probar local antes de mergear.
- **Edge Functions y secrets** se gestionan en el **dashboard** (fuera del CLI/CI); `supabase/functions/`
  queda como referencia, no se despliega desde el repo.

- [ ] **Step 2: Agregar setup del CLI a `docs/ONBOARDING.md`**

En la sección de setup de máquina, agregar: instalar **Docker Desktop**; el CLI viene como devDependency
(`pnpm supabase …`); `pnpm supabase login` una vez; para trabajar el schema: `pnpm db:start` +
`pnpm db:new`/`pnpm db:reset`. Aclarar que aplicar a prod es automático vía CI al mergear a `main`.

- [ ] **Step 3: Verificar coherencia**

Run: `git grep -n "supa:setup\|schema.sql\|supabase-setup"` -- `CLAUDE.md` `docs/`
Expected: no quedan menciones al flujo viejo salvo, si acaso, en specs/planes históricos (esos NO se tocan).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/ONBOARDING.md
git commit -m "docs: describir el flujo de migraciones del CLI de Supabase"
```

---

### Task 13: Merge a main + verificación end-to-end `[TÚ + CLAUDE]`

**Interfaces:**
- Consumes: todo lo anterior + secrets cargados (Tarea 11).
- Produces: el ciclo migración→merge→`db push`→prod funcionando.

- [ ] **Step 1: Mergear la rama a `main` `[TÚ]`**

Abrí un PR de `feat/supabase-cli-migraciones` → `main` (o mergealo). Al mergear, el workflow corre.

- [ ] **Step 2: Verificar el primer run del CI `[TÚ]`**

En GitHub → **Actions** → run "Aplicar migraciones a Supabase (prod)": debe terminar en verde, y el paso
`supabase db push` debe reportar que **no hay nada pendiente** (`Remote database is up to date.`), porque
el baseline ya está marcado como aplicado. Pegame el log si algo falla.

- [ ] **Step 3: (Recomendado) Prueba end-to-end con una migración trivial `[TÚ + CLAUDE]`**

Para confirmar que el ciclo aplica cambios reales:

```bash
pnpm db:new prueba_ci
```

En el archivo generado, poner algo inocuo e idempotente-seguro:

```sql
comment on table public.perfiles is 'migración de prueba del CI — segura de revertir';
```

(usar una tabla que exista; ajustar el nombre si `perfiles` no es el correcto). Luego:

```bash
pnpm db:reset          # prueba local, debe correr limpio
git add supabase/migrations/ && git commit -m "test(ci): migración trivial de prueba"
```

Mergear a `main` → el CI debe aplicar la migración → verificar en el dashboard (SQL editor:
`select obj_description('public.perfiles'::regclass);`) que el comment quedó. Confirma que anduvo.

- [ ] **Step 4: Cerrar**

Con el ciclo verificado, la migración a Supabase CLI queda completa. (El `comment` de prueba puede quedar
o revertirse con otra migración; es inocuo.)

---

## Self-Review (cobertura del spec)

- **Full CLI + stack local (Docker):** Tareas 1–3 (CLI + config), 4 (Docker), 7 (`db reset`). ✓
- **Rebaseline directo en prod con backup:** Tarea 5 (backup, bloqueante) + Tarea 6 (`db pull` marca
  aplicado). ✓
- **Limpieza (borrar script + .env; seed a mano):** Tareas 3 (seed local en config), 8 (borrar schema.sql),
  9 (borrar script/.env/pg). Seed en prod = manual en el SQL editor (documentado en Tarea 12). ✓
- **CI ahora (GitHub Actions):** Tarea 10 (workflow) + 11 (secrets) + 13 (verificación). ✓
- **Fuera de alcance functions/secrets:** respetado en Global Constraints y Tarea 12. ✓
- **Docs actualizadas:** Tarea 12 (CLAUDE.md + ONBOARDING.md). ✓
