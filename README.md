# Laboratorio de Tareas

Web app mobile-first para analistas y entrenadores de fútbol: sube la imagen de un ejercicio, la IA (Claude, con visión) extrae **puntos clave** y **roles**, y puedes añadir **comodines** y **porterías** para ver cómo cambia el análisis (vista Antes / Después).

**Stack:** React + Vite + TypeScript + Tailwind · Supabase (Postgres + Storage) · Función serverless de Vercel → Anthropic API.

## 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Abre **SQL Editor** y ejecuta el contenido de [`supabase/schema.sql`](supabase/schema.sql). Crea las tablas `ejercicios` y `analisis`, el bucket público `ejercicios` y las políticas RLS.
3. En **Project Settings → API** copia la *Project URL* y la clave *anon public*.

> Las políticas incluidas son de **usuario único** (acceso abierto con la clave anon). Para varios usuarios, activa Supabase Auth, añade `user_id` a las tablas y cambia las políticas a `auth.uid() = user_id`.

## 2. Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` | cliente | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | cliente | Clave anon pública |
| `ANTHROPIC_API_KEY` | **solo servidor** | Clave de la API de Anthropic. Nunca en el cliente ni en el repo |
| `ANTHROPIC_MODEL` | servidor | Modelo con visión (por defecto sugerido: `claude-sonnet-5-5`). Compruébalo en [docs.claude.com](https://docs.claude.com) |

Copia `.env.example` a `.env.local` para desarrollo.

## 3. Desarrollo local

```bash
npm install
npx vercel dev      # sirve el frontend y /api/analizar-ejercicio (necesita las variables)
```

`npm run dev` solo levanta el frontend: la función `/api` no existirá sin `vercel dev`.

## 4. Despliegue en Vercel

1. Sube el proyecto a un repositorio y impórtalo en Vercel (preset Vite, se detecta solo).
2. En **Settings → Environment Variables** define las 4 variables anteriores.
3. Despliega. `vercel.json` ya fija `maxDuration: 60` para la función.

## Cómo funciona

- **Nuevo ejercicio**: valida tipo (JPG/PNG/WebP) y tamaño (≤10 MB), comprime a JPEG (≤1600 px), sube a Storage y crea el registro.
- **Analizar con IA**: el cliente envía imagen en base64 + descripción a `/api/analizar-ejercicio`. El endpoint llama a Claude, exige JSON estricto, valida el esquema y reintenta una vez si no es válido. Se guarda en `analisis`.
- **Modificadores**: contadores de comodines/porterías → "Reanalizar" reenvía el análisis base y los modificadores; el modelo explica el impacto (`impacto_modificadores`). Se guarda con `es_version_modificada = true`.
- **Antes / Después**: pestañas Base · Con cambios · Antes/Después (dos columnas en pantallas anchas).
- **Librería**: grid con miniatura, filtro por categoría e historial completo de análisis con fecha.

### Esquema JSON de la IA

```json
{
  "puntos_clave": ["..."],
  "roles": [{ "posicion": "...", "descripcion": "..." }],
  "dinamica_general": "...",
  "impacto_modificadores": "..."
}
```
