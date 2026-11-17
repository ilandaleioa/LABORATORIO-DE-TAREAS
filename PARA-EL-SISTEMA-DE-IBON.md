# Kit de entrenamiento ACFC → generación automática desde el Diseñador de tareas

> Texto para pasárselo al Claude de Ibon (Claude Code abierto en su repo `ilandaleioa/disenador-tareas-ac-center`).
> Antes, Aritz le pasa la carpeta del kit por Drive: `Formaciones/26-27/27.01. IA aplicada al entrenamiento/Kit del curso/`.

---

Necesito que mi Diseñador de tareas genere automáticamente los seis documentos del kit de **IA aplicada al entrenamiento** (ACFC), en PowerPoint editable y en PDF, a partir de los ejercicios que ya guarda y de lo que proponga la IA. Trabaja en una rama `kit-entrenamiento`, ve por fases (abajo) y, al terminar cada fase, dime en dos líneas qué funciona y cómo probarlo. No subas nada a `main` sin que yo lo vea.

## 1. Qué es el kit

Seis plantillas A4 con la línea visual de ACFC, ya diseñadas y aprobadas. Cada una se genera desde un JSON:

| Plantilla (`plantilla`) | Documento | Formato | Sale de… |
|---|---|---|---|
| `temporada` | Planificación de temporada: bloques, ola de carga, descargas, hitos | A4 apaisado | IA + calendario |
| `microciclo` | Semana de MD+1 a MD: contenido, carga, objetivos y tareas por día | A4 apaisado | IA + temporada |
| `sesion` | Ficha de sesión: 4 tareas con dibujo, estructura, equipos, mensajes | A4 vertical | **ejercicios del diseñador** |
| `tarea` | Ficha de tarea: dibujo grande + 3 fotogramas, carga, reglas, variantes | A4 vertical | **un ejercicio del diseñador** |
| `carga` | Panel de carga semanal: minutos × RPE, variación, bienestar, semáforo | A4 apaisado | Excel / formulario |
| `informe` | Informe individual: objetivos, evaluación 1-10, próximo mes, comentario | A4 vertical | evaluaciones + IA |

La carpeta que te paso contiene:

- `_fuentes/`: el generador en Python. `acfc_pptx.py` (componentes de marca), `kit.py` (cabecera, pie, **`dibujo()` que pinta un ejercicio del diseñador**), un módulo por plantilla (`temporada.py`, `microciclo.py`, `sesion.py`, `tarea.py`, `carga.py`, `informe.py`), `generar.py` (punto de entrada), `excel_carga.py` (calculadora de carga), `esquemas.py`, `assets/` (logos) y `render.sh` (solo para Mac: ignóralo).
- `datos/ejemplo-*.json`: un ejemplo completo de cada plantilla. **Son la referencia del formato.**
- `datos/esquemas/*.schema.json`: el esquema JSON de cada plantilla (y `ejercicio-disenador.schema.json`, el de un ejercicio de mi diseñador).
- Los `.pptx`, `.pdf` y el `.xlsx` ya generados, para que veas el resultado esperado.

Uso del generador (no hay que cambiarlo):

```powershell
pip install python-pptx lxml openpyxl jsonschema
python kit/generar.py kit/datos/ejemplo-tarea.json salida.pptx     # una ficha desde un JSON
python kit/generar.py --kit                                       # el kit completo (ejemplo + en blanco + guía)
```

Desde `servidor.py`: `sys.path.insert(0, str(ROOT / "kit"))` y después `from generar import ficha; ficha(datos_dict, ruta_salida)`. Tiene que ir **al principio** del `sys.path`, porque dentro hay un módulo que se llama `kit.py`, igual que la carpeta. Añade `kit/*.pptx` y `kit/*.pdf` al `.gitignore`.

## 2. Cómo encaja con el diseñador

El generador lee **el mismo objeto que ya guardo** en `tactics-exercises` / `ac-center-ejercicios.json`:

```json
{ "id": "ex…", "title": "Juego de posición 7c7+3", "pitch": "libre", "type": "Posesiones", "players": 17,
  "description": "…", "frames": [ { "items": [ … ], "arrows": [ … ] } ] }
```

- `kit.dibujo()` pinta `pitch` (total, ataque, defensa, libre) y los elementos con sus nombres: jugadores `athletic` (rojiblanco) y `color`, el `num` 1 como portero/a, `ball`, `cone`, `flat`, `goal`, `minigoal`, `pole`, `ring`, `mannequin`, `hurdle`, `tallhurdle`, `ladder`, `text` y `zone` (con `sx`/`sy` sobre `SIZES.zone`); también las flechas `pass`, `dribble` y `run`, con `curve`. Las porterías con `rot` de 90/270 se dibujan en vertical.
- **Fotogramas:** la ficha de tarea dibuja el fotograma 1 en grande y los tres primeros como secuencia.
- **Comodines:** jugador `kit: "color"` con `color: "#E0A100"`.
- Correspondencia de campos:

| Diseñador | Ficha de tarea | Ficha de sesión |
|---|---|---|
| `title` | Título | Nombre de la tarea |
| `type` (Juegos, Posesiones, Finalizaciones, Juegos reducidos) | Casilla «Tipo» | Línea bajo el nombre |
| `players` | Casilla «Jugadores» | Línea bajo el nombre |
| `pitch` | Casilla «Campo» | Línea bajo el nombre |
| `description` | Bloque «Descripción · la del diseñador» | — |
| `frames` | Dibujo + secuencia | Dibujo (fotograma 1) |

El resto de campos de la ficha (objetivo, dimensiones, duración, series, tiempo útil, RPE, intensidad, organización, reglas, variantes, consigna, notas de los fotogramas, material, MD, equipo, fecha) **no existen hoy en el diseñador**. Se añaden como un objeto opcional `ficha` dentro de cada ejercicio (ver fase 2).

## 3. Fases

### Fase 1 · Generador en el servidor local

1. Copia la carpeta del kit al repo como `kit/` (solo `_fuentes/*.py`, `_fuentes/assets/`, `datos/`). No copies los `.pptx`/`.pdf`/`.xlsx` ni `render.sh`. Añade `python-pptx`, `lxml`, `openpyxl` y `jsonschema` a `requirements.txt`.
2. En `servidor.py`:
   - `GET /api/estado` devuelve también `"kit": true`.
   - `POST /api/kit/generar` con `{"plantilla": "...", "datos": {...}, "formato": "pptx" | "pdf"}`:
     - Mismas defensas que el resto: `Host`/`Origin`, `Content-Type: application/json`, límite de tamaño (300 KB), `rate_ok()`.
     - Valida `datos` con `datos/esquemas/<plantilla>.schema.json` (jsonschema). Si falla, 400 con el primer error en español.
     - Recorta textos largos (500 caracteres por campo como máximo) y fuerza `datos["plantilla"] = plantilla`.
     - Genera en un `tempfile.TemporaryDirectory()` con `generar.ficha()` y devuelve el archivo con `Content-Disposition: attachment; filename="ACFC - <Plantilla> - <título>.pptx"` (nombre saneado).
     - **PDF:** si existe LibreOffice (`soffice` en el PATH o en `LIBREOFFICE` del `.env`), convierte con `soffice --headless --convert-to pdf`. Si no, intenta PowerPoint por COM en Windows (`comtypes`: `Presentations.Open(...).SaveAs(ruta, 32)`). Si no hay ninguno, 503 con el mensaje «Para PDF instala LibreOffice o usa PowerPoint: Archivo › Exportar › PDF». La tipografía es Akrobat: si no está instalada en el equipo, el PDF sale con otra fuente (avísalo en el README).
3. Prueba: con el servidor arrancado, un `POST` con cada `datos/ejemplo-*.json` tiene que devolver un PPTX igual que los que te paso.

### Fase 2 · Ficha de tarea y de sesión desde «Mis ejercicios»

1. **Modal Guardar / Editar ejercicio:** añade una sección plegable «FICHA (opcional)» con: objetivo, dimensiones, duración (min), series, tiempo útil (min), RPE esperado (0-10), intensidad (Baja/Media/Alta), organización, reglas (hasta 3 líneas), variante +, variante −, consigna, una nota por fotograma (hasta 3), material, MD, equipo y fecha. Guárdalo dentro del ejercicio como `ficha: {…}`, con las mismas claves que `datos/ejemplo-tarea.json`.
2. **Ojo:** `buildEntry()` crea el objeto desde cero y `confirmSaveLocal` lo sustituye entero, así que hoy se perdería `ficha` al volver a guardar. Conserva los campos que ya tuviera (`Object.assign({}, actual, nuevo)`). Lo mismo en `confirmRename`/`updateMeta`.
3. **En cada ejercicio de «Mis ejercicios»:** botón «FICHA» que monte `{plantilla: "tarea", ejercicio: <el ejercicio sin ficha>, ...ejercicio.ficha}`, lo mande a `/api/kit/generar` y deje elegir PPT o PDF. Si faltan campos de la ficha, se mandan vacíos: la plantilla los deja en blanco.
4. **Nueva vista «Sesión»:** elegir hasta 4 ejercicios guardados (en orden), poner minutos, intensidad y consigna de cada uno, más los datos de la cabecera (día, equipo, MD, título, duración, jugadores, objetivo, principios), equipos, mensajes clave, objetivos personales y alternativa si faltan jugadores. Exporta `plantilla: "sesion"` (formato en `datos/ejemplo-sesion.json`).
5. En la web pública (acfootballcenter.eus o GitHub Pages) no hay servidor: si `/api/estado` no responde con `kit: true`, oculta estos botones. Que nada se rompa sin servidor.

### Fase 3 · Que la IA rellene las plantillas

1. `POST /api/kit/ia` con `{"plantilla": "...", "instruccion": "...", "contexto": {...}}`. Llama a Claude como ya lo hace `/api/asistente` (`messages.create` con `output_config={"format": {"type": "json_schema", "schema": <esquema de la plantilla>}}`) y devuelve el JSON propuesto, **sin generar todavía el archivo**: el entrenador lo revisa y ajusta en pantalla y después pulsa «Generar».
2. Prompts de sistema: uno por plantilla. Parte de la «instrucción de ejemplo» de la página de guía de cada `.pptx` (el texto del recuadro gris) y añade las reglas del formato:
   - **tarea/sesion:** el ejercicio va en el formato del diseñador. Reutiliza las reglas de coordenadas del `SYSTEM_PROMPT` actual (0-100, ids, kinds, `num` 1-11, portero/a = 1) y pasa el resultado por la misma validación que `/api/asistente` (ids, colores, límites `MAX_ITEMS`/`MAX_ARROWS`). Pide **tres fotogramas** cuando la tarea tenga secuencia (posesión → pérdida → recuperación, por ejemplo). Para `sesion`, cuatro tareas encadenadas por el objetivo del día y cuyos minutos sumen la duración.
   - **temporada:** `carga` con un valor de 0 a 10 por semana (tantos como `semanas`); bloques sin huecos ni solapes; `inicio` en un lunes.
   - **microciclo:** 7 días de MD+1 a MD; el pico de carga en MD-3; MD-1 con carga baja.
   - **informe:** tono positivo y cercano (lo lee el jugador/a o su familia), 3 objetivos como mucho, frases cortas. Siempre «jugador/a» en textos genéricos.
   - En todos los textos: español, «recuperar» el balón (nunca «robar»), sin emojis.
3. Botón «Guardar como ejercicio» en las tareas que proponga la IA: las mete en «Mis ejercicios» con su `ficha`.

### Fase 4 · Panel de carga e informe

1. **Panel de carga:** importar el Excel `ACFC - 04 Panel de carga (calculadora).xlsx` (pestaña «Registro»: semana, día, jugador/a, minutos, RPE, sueño, fatiga, dolor, ánimo) o un CSV con esas columnas. El servidor arma `plantilla: "carga"` para la semana elegida: sesiones de esa semana, `ultimas4` = carga total de cada una de las 4 semanas anteriores, bienestar = media de la semana. La carga, la variación y el semáforo los calcula `carga.py`: **no los dupliques**. La «propuesta de ajuste» la puede sugerir la IA, pero el entrenador la edita antes de generar.
2. **Informe individual:** formulario por jugador/a (datos del periodo, objetivos, evaluación de 1 a 10 con la nota anterior y el objetivo, minutos por mes) + «Redactar con IA» para el comentario y el «próximo mes».

## 4. Datos personales (importante)

- El panel de carga y el informe llevan **nombres, bienestar y evaluaciones de menores**. Se quedan en el equipo del entrenador (`ac-center-ejercicios.json` o un archivo aparte en `datos/`, nunca en el repo: añádelo a `.gitignore`).
- A la API de Claude **no se mandan nombres ni datos de bienestar**. Antes de llamar a `/api/kit/ia` con `carga` o `informe`, cambia los nombres por iniciales o «Jugador 1, 2…» y deshaz el cambio en la respuesta. Nada de diagnósticos ni datos médicos en ningún campo: para casos especiales, texto neutro («Vuelta de lesión», «Readaptación»).
- Igual que hoy: la clave de la API vive solo en `.env`.

## 5. Lo que no hay que tocar

- **El diseño de las plantillas.** Si algo no cabe, se recorta el texto o se avisa: no cambies colores, tipografías, tamaños ni la composición en `kit/*.py`. Si hace falta un cambio de diseño, me lo dices y lo pido a ACFC.
- El formato de `tactics-exercises`: solo se **añade** `ficha` (opcional). Los ejercicios antiguos sin `ficha` siguen funcionando.
- La seguridad del servidor (solo `127.0.0.1`, comprobación de `Host`/`Origin`, límites y ritmo).

## 6. Cómo comprobarlo al final

1. `python kit/generar.py --kit` funciona sin errores.
2. Un ejercicio guardado → «FICHA» → PPTX que se abre en PowerPoint con su dibujo, tipo, jugadores y campo correctos. Lo mismo en PDF si hay LibreOffice o PowerPoint.
3. Vista «Sesión» con 4 ejercicios → ficha de sesión con los 4 dibujos y la estructura proporcional a los minutos.
4. `/api/kit/ia` con «Diseña una tarea de presión tras pérdida en espacio reducido para un cadete» → JSON válido según el esquema → «Generar» → ficha de tarea con 3 fotogramas.
5. Importar el Excel de ejemplo → panel de la semana 18 con M. Arana en rojo (pico +39 %), A. Larrañaga en rojo (sueño bajo) y U. Zabala en ámbar (vuelta de lesión).
6. La web pública sigue funcionando igual (sin los botones del kit).
7. Actualiza el `README.md` con: dependencias nuevas, cómo generar el kit, LibreOffice o PowerPoint para PDF y la nota de datos personales.
