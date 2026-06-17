# Tablero de Control y Seguimiento de Auditorías Finales de Confección

Stack: React + Vite + TypeScript + TailwindCSS (Vercel) · Supabase (Postgres + Auth) · Claude API (serverless /api)

---

## Requisitos previos

- Node.js 20+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Vercel](https://vercel.com)
- API Key de Anthropic (para módulo IA)

---

## 1. Configurar Supabase

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, ejecuta el archivo `supabase_schema.sql` para crear las tablas y políticas RLS.
3. Copia la **Project URL** y la **anon/public key** desde *Project Settings → API*.

---

## 2. Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores:

```bash
cp .env.example .env.local
```

```env
# Frontend
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Servidor (solo Vercel /api)
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_SERVICE_ROLE=eyJ...   # Opcional, para tareas admin
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_MODEL_BARATO=claude-haiku-4-5
```

> **Seguridad**: NUNCA expongas `ANTHROPIC_API_KEY` ni `SUPABASE_SERVICE_ROLE` en el frontend.
> Las variables `VITE_*` son públicas por diseño.

---

## 3. Correr en local

```bash
npm install
npm run dev
```

La app estará en `http://localhost:5173`.

Para probar las funciones serverless de IA en local, instala la CLI de Vercel:

```bash
npm i -g vercel
vercel dev
```

Esto levanta el servidor en `http://localhost:3000` con las rutas `/api/*` activas.

---

## 4. Tests

```bash
npm test
```

Corre los tests de parsers y normalizadores de PO con Vitest.

---

## 5. Despliegue en Vercel

### Opción A: desde la CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

Sigue el wizard: vincula al repositorio, selecciona framework **Vite**.

### Opción B: desde la UI de Vercel

1. Importa el repositorio desde GitHub/GitLab.
2. Vercel detecta el framework Vite automáticamente.
3. En **Environment Variables**, agrega **todas** las variables del `.env.example`:
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` → visibles en cliente.
   - `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE`, `ANTHROPIC_MODEL`, `ANTHROPIC_MODEL_BARATO` → **solo servidor**.
4. Deploy.

### Configurar dominio personalizado (opcional)

En *Vercel → Settings → Domains*, agrega tu dominio.

---

## 6. Uso del tablero

### Carga de archivos

Ve a la pestaña **Cargar Excel** y arrastra (o selecciona) los 3 archivos:

| Zona | Archivo esperado | Hoja |
|------|-----------------|------|
| Auditorías | `Auditorias Semana XX.xlsx` | Una hoja por semana |
| PGO | `PGO_XX.xlsm` | Hoja "PGO" |
| Status Cortes | `RptStatusGeneral...xlsx` | Hoja "StatusCorte" |

Si una columna no se reconoce, aparece un aviso en amarillo indicando qué falta.

### Flujo de trabajo

1. Carga los 3 Excel → el cruce se genera automáticamente.
2. Haz clic en **Sincronizar seguimiento desde Supabase** para recuperar datos previos.
3. Usa los filtros (cliente, semana, estado, responsable, semáforo) para navegar.
4. Haz clic en cualquier fila para abrir el **Drawer de detalle**, donde puedes:
   - Cambiar el estado (Pendiente → Programada → Aprobada / Rechazada…)
   - Registrar responsable, fechas, resultado/hallazgos.
   - Agregar comentarios a la bitácora.
   - Usar IA para generar acciones correctivas o redactar comentarios.
5. Al guardar, el registro se persiste en Supabase por `item_key`.
6. Exporta a Excel con el botón **Exportar Excel**.

---

## 7. Módulo IA

Los endpoints serverless están en `/api/ia/`:

| Endpoint | Modelo | Propósito |
|----------|--------|-----------|
| `/api/ia/accion-correctiva` | sonnet-4-6 | 5 Porqués + acción correctiva para rechazos |
| `/api/ia/priorizar` | haiku-4-5 | Ranking de qué auditar primero |
| `/api/ia/redactar-comentario` | sonnet-4-6 | Redactar comentario de bitácora |
| `/api/ia/resumen-semanal` | sonnet-4-6 | Párrafo ejecutivo para gerencia |

Todas las respuestas son **sugerencias editables**; el usuario decide si usarlas.

---

## 8. Estructura del proyecto

```
.
├── api/
│   ├── _claude.ts              # Helper compartido para llamar a Claude
│   └── ia/
│       ├── accion-correctiva.ts
│       ├── priorizar.ts
│       ├── redactar-comentario.ts
│       └── resumen-semanal.ts
├── data_ejemplo/               # Archivos Excel de prueba
├── src/
│   ├── components/
│   │   ├── auth/               # LoginPage
│   │   ├── dashboard/          # KPICards, CumplimientoPorPersona
│   │   ├── drawer/             # DrawerDetalle (edición + bitácora)
│   │   ├── table/              # TablaPrincipal, Filtros
│   │   ├── ui/                 # Badge, Semaforo, Spinner
│   │   └── upload/             # DropZone, DiagnosticoCruce
│   ├── hooks/
│   │   ├── useAppStore.ts      # Estado global + cruce reactivo
│   │   └── useSeguimiento.ts   # CRUD Supabase
│   ├── lib/
│   │   ├── parsers/            # parseAuditorias, parsePgo, parseCortes, cruzar
│   │   ├── exporters/          # exportExcel
│   │   └── supabase.ts
│   ├── pages/
│   │   └── MainPage.tsx        # Layout principal con tabs
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example
├── supabase_schema.sql
├── vercel.json
└── README.md
```

---

## 9. Troubleshooting

**"Columnas no reconocidas"**: el parser detecta encabezados por texto normalizado (sin tildes, mayúsculas). Si tu archivo tiene un nombre diferente, el aviso te indicará cuál falta. Próxima versión incluirá remapeo manual con persistencia.

**"ANTHROPIC_API_KEY no configurada"**: revisa que la variable esté en Vercel como variable de servidor (no `VITE_*`).

**Las filas no se guardan**: verifica que el usuario esté autenticado y que las políticas RLS en Supabase incluyan `authenticated`.

**El cruce da 0 matches**: asegúrate de que los POs en los 3 archivos usen el mismo formato (el normalizador hace trim + mayúsculas, pero no puede inferir diferencias semánticas como "OP-001" vs "001").
