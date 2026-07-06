# CU50 y CU51 — Asistente IA · Guía de defensa

---

## Índice
1. [Visión general del paquete](#1-visión-general-del-paquete)
2. [CU50 — Consultar información mediante Asistente IA](#2-cu50--consultar-información-mediante-asistente-ia)
   - 2.1 Qué hace
   - 2.2 Archivos involucrados
   - 2.3 Flujo completo paso a paso
   - 2.4 Las 14 herramientas de consulta
   - 2.5 Cómo funciona el agente con Claude
   - 2.6 Casos de error
3. [CU51 — Gestionar acceso al Asistente IA](#3-cu51--gestionar-acceso-al-asistente-ia)
   - 3.1 Qué hace
   - 3.2 Archivos involucrados
   - 3.3 Los 8 permisos asistente_*
   - 3.4 Flujo completo paso a paso
   - 3.5 Casos de error
4. [Decisiones técnicas clave](#4-decisiones-técnicas-clave)
5. [Preguntas frecuentes de defensa](#5-preguntas-frecuentes-de-defensa)

---

## 1. Visión general del paquete

El paquete **Asistente IA** tiene dos casos de uso:

| CU | Nombre | Quién lo usa |
|----|--------|--------------|
| CU50 | Consultar información mediante Asistente IA | Cualquier usuario con al menos un permiso `asistente_*` |
| CU51 | Gestionar acceso al Asistente IA | Administrador (usuario con permiso `gestionar_roles`) |

**Qué es el asistente**: un chatbot integrado en ServiControl que permite hacer consultas en lenguaje natural sobre los datos del sistema. No crea, no modifica, no elimina — solo lee. Usa la API de Anthropic (modelo `claude-haiku-4-5-20251001`) con la técnica de **tool-use** para obtener datos reales de la base de datos antes de responder.

---

## 2. CU50 — Consultar información mediante Asistente IA

### 2.1 Qué hace

El usuario escribe (o dicta por voz) una pregunta en lenguaje natural. El sistema:
1. Identifica qué módulos puede consultar ese usuario según su rol.
2. Envía la pregunta a Claude junto con las "herramientas" disponibles (funciones SQL).
3. Claude decide qué herramienta invocar, el sistema ejecuta la consulta SQL, devuelve el resultado a Claude.
4. Este ciclo se repite hasta que Claude genera una respuesta final en Markdown.
5. La respuesta se muestra renderizada (tablas, negritas, listas).

### 2.2 Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `frontend/src/pages/asistente/AsistentePage.jsx` | Página principal del chat |
| `frontend/src/components/Asistente/markdown.js` | Renderiza la respuesta del asistente como HTML |
| `frontend/src/api/asistente.js` | Cliente HTTP: llama a `/api/asistente/modulos` y `/api/asistente/consultar` |
| `backend/app/routes/asistente/asistente.py` | Todo el backend: rutas, lógica del agente, 14 herramientas de consulta |

> **Importante**: todo el backend está en un único archivo `asistente.py`. Antes estaba dividido en tres archivos (`asistente.py`, `agente.py`, `herramientas.py`) y se fusionaron para simplificar.

### 2.3 Flujo completo paso a paso

#### Al abrir la página (`/asistente`)

```
1. AsistentePage monta → llama a asistenteApi.modulos()
2. GET /api/asistente/modulos  [con JWT en el header]
3. Backend: valida el token JWT → obtiene el id del usuario
4. Backend: db.session.get(Usuario, id)  →  obtiene el usuario
5. Backend: Permiso.query.join(RolPermiso).filter(id_rol=?).all()
           → obtiene TODOS los permisos del rol
6. Backend: filtra cuáles empiezan con "asistente_" y están en el dict MODULOS
7. Backend: retorna 200 { modulos: [{clave, nombre}, ...], disponible: bool }
8. Frontend: muestra el badge "N áreas disponibles para consultar"
```

Si el usuario no tiene ningún permiso `asistente_*`, `disponible` es `false` y no puede consultar.

#### Al enviar una consulta

```
1. Usuario escribe pregunta → presiona Enter o botón enviar
2. AsistentePage.enviar(): valida que pregunta no esté vacía y no haya otra en curso
3. Agrega mensaje del usuario al historial visual
4. asistenteApi.consultar({ pregunta, historial })
5. POST /api/asistente/consultar  [con JWT]
   Body: { pregunta: "...", historial: [{role, content}, ...] }

6. Backend — validaciones:
   a. pregunta vacía → 400
   b. pregunta > 1000 caracteres → 400
   c. db.session.get(Usuario, id) → usuario no encontrado → 401

7. Backend — _permisos_usuario(usuario):
   - Consulta Permiso JOIN RolPermiso WHERE id_rol = usuario.id_rol
   - Verifica si rol.nombre == "Administrador" → es_admin = True/False
   - Retorna (permisos[], es_admin)

8. Backend — _responder(pregunta, historial, permisos, es_admin):
   a. Verifica ANTHROPIC_API_KEY en config → si no existe → error
   b. _modulos_permitidos() → si lista vacía → error
   c. _herramientas_permitidas() → filtra las 14 herramientas según permisos
   d. _system_prompt() → construye las instrucciones del sistema para Claude
   e. Toma los últimos 10 mensajes del historial + agrega la pregunta actual

9. LOOP (máx. 6 iteraciones):
   a. client.messages.create(model, system, tools[], messages[])
   b. Si stop_reason == "tool_use":
      - Claude indica qué herramienta invocar y con qué argumentos
      - _ejecutar_herramienta(nombre, args) → función SQL → SELECT LIMIT 30
      - Resultado serializado a JSON → se agrega como tool_result
      - Continúa la siguiente iteración
   c. Si stop_reason == "end_turn":
      - Extrae el texto de la respuesta
      - Sale del loop → va al paso 10

10. log("CONSULTA_ASISTENTE", pregunta[:120], modulos_consultados[])
11. Retorna 200 { respuesta: "Markdown...", modulos_consultados: [...] }

12. Frontend: muestra la respuesta renderizada con renderMarkdown()
```

#### Dictado por voz (opcional)

- Usa la **Web Speech API** nativa del navegador (`window.SpeechRecognition`)
- Idioma: `es-ES`
- Solo funciona en Chrome/Edge con HTTPS (o localhost)
- Si el micrófono está denegado, muestra un mensaje específico por tipo de error (`not-allowed`, `network`, `no-speech`, etc.)
- El texto dictado se agrega al textarea, no se envía solo — el usuario confirma

### 2.4 Las 14 herramientas de consulta

Cada herramienta es una función Python que recibe `args` (filtros opcionales) y ejecuta un SELECT en la BD. Todas tienen `LIMIT 30` máximo.

| Herramienta | Módulo | Qué consulta |
|-------------|--------|--------------|
| `finanzas_pagos_por_cliente` | finanzas | Resumen de pagos agrupado por cliente (total, cantidad, último pago) |
| `finanzas_pagos_detalle` | finanzas | Lista de pagos individuales con fecha, monto, método |
| `finanzas_gastos` | finanzas | Gastos en órdenes de trabajo (materiales, viáticos, transporte) |
| `proyectos_buscar` | proyectos | Lista proyectos con estado, cliente y fechas |
| `proyecto_detalle` | proyectos | Detalle de un proyecto por código, incluye sus órdenes |
| `orden_detalle` | ordenes | Detalle de una OT: productos usados, empleados, total gastos |
| `cotizaciones_buscar` | cotizaciones | Lista cotizaciones con estado y total |
| `cotizacion_detalle` | cotizaciones | Detalle de una cotización: productos, proveedores, precios |
| `clientes_buscar` | clientes | Busca clientes por nombre |
| `cliente_detalle` | clientes | Datos de un cliente y lista de sus proyectos |
| `productos_buscar` | catalogo | Busca productos del catálogo por nombre o categoría |
| `producto_precio` | catalogo | Precio más reciente de un producto por proveedor (desde cotizaciones) |
| `empleados_buscar` | empleados | Lista empleados con nombre, cargo, email y estado activo |
| `mantenimientos_listar` | mantenimiento | Mantenimientos programados con días para vencer |

**Cada herramienta tiene `input_schema`** que Claude usa para saber qué parámetros puede enviar y de qué tipo. Claude no inventa parámetros — los saca del esquema.

### 2.5 Cómo funciona el agente con Claude

El patrón se llama **tool-use** (uso de herramientas):

```
[Pregunta del usuario]
        ↓
Claude recibe: system_prompt + tools[] + messages[]
        ↓
Claude responde con stop_reason = "tool_use"
(indica: "quiero llamar a finanzas_pagos_detalle con {cliente: 'ABC'}")
        ↓
El backend ejecuta la función Python → SELECT a la BD → devuelve JSON
        ↓
Ese JSON se agrega al historial como "tool_result"
        ↓
Claude vuelve a procesar → puede pedir otra herramienta o responder
        ↓
Claude responde con stop_reason = "end_turn" + texto en Markdown
```

**Constantes clave:**
- `MAX_ITERACIONES = 6` — máximo 6 llamadas a Claude por consulta
- `MAX_TOKENS = 1500` — máximo 1500 tokens en la respuesta de Claude
- `LIMITE_FILAS = 30` — máximo 30 filas por consulta SQL

**El system prompt le dice a Claude:**
- Responder siempre en español y en Markdown
- Solo leer, nunca decir que modificó algo
- Solo usar las herramientas disponibles, no inventar datos
- Si la pregunta es ambigua, repreguntar antes de consultar
- Qué módulos puede y qué módulos NO puede consultar ese usuario
- Los montos están en bolivianos (Bs)
- No responder consultas ajenas a ServiControl (no es un asistente general)

### 2.6 Casos de error

| Código | Situación | Mensaje |
|--------|-----------|---------|
| 400 | Pregunta vacía | `"La pregunta no puede estar vacía"` |
| 400 | Pregunta > 1000 caracteres | `"La pregunta es demasiado larga (máx. 1000 caracteres)"` |
| 401 | Token inválido o usuario inexistente | `"Usuario no encontrado"` |
| 200* | Rol sin ningún permiso `asistente_*` | `"Tu rol no tiene permiso para consultar ningún módulo con el asistente"` |
| 200* | `ANTHROPIC_API_KEY` no configurada | `"El asistente no está configurado (falta ANTHROPIC_API_KEY)"` |
| 200* | 6 iteraciones agotadas sin respuesta final | `"La consulta resultó demasiado compleja. Probá dividirla en partes más simples"` |
| 200* | Excepción al llamar a Claude API | `"No se pudo procesar la consulta. Intentá nuevamente"` |

> Los errores marcados con `200*` retornan código HTTP 200 porque el frontend los trata como respuestas del asistente, no como errores de red. El campo `error` en el JSON indica la situación al usuario.

---

## 3. CU51 — Gestionar acceso al Asistente IA

### 3.1 Qué hace

El administrador puede controlar qué módulos puede consultar cada rol a través del asistente. Lo hace marcando o desmarcando checkboxes en la columna **"Asistente IA"** dentro de la página de Roles y Permisos. Cada checkbox corresponde a un permiso `asistente_*` en la base de datos.

### 3.2 Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `frontend/src/pages/roles/RolesPage.jsx` | UI con la matriz de permisos |
| `backend/app/routes/seguridad/roles.py` | API de roles (existente, no modificado para este CU) |
| `backend/migrations/versions/c1d2e3f4a5b6_add_asistente_permisos.py` | Migración que inserta los 8 permisos en la tabla `permiso` |

> **No se creó un controlador nuevo para CU51.** Se reutilizó completamente el sistema de roles existente. El CU51 se implementó agregando los permisos `asistente_*` a la BD y modificando la UI para mostrarlos como una columna separada.

### 3.3 Los 8 permisos `asistente_*`

Insertados mediante la migración `c1d2e3f4a5b6`:

| Permiso | Módulo que habilita |
|---------|---------------------|
| `asistente_proyectos` | Herramientas de proyectos |
| `asistente_ordenes` | Herramienta de órdenes de trabajo |
| `asistente_clientes` | Herramientas de clientes |
| `asistente_cotizaciones` | Herramientas de cotizaciones |
| `asistente_finanzas` | Herramientas de finanzas |
| `asistente_mantenimientos` | Herramienta de mantenimiento |
| `asistente_empleados` | Herramienta de empleados |
| `asistente_catalogo` | Herramientas de catálogo |

La migración usa `INSERT IGNORE` (MySQL) para no fallar si los permisos ya existen.

### 3.4 Flujo completo paso a paso

#### Al abrir la página (`/personal/roles`)

```
1. RolesPage monta → cargarDatos()
2. Promise.all([rolesApi.listar(), rolesApi.permisos()])
   → GET /roles/  y  GET /roles/permisos  en paralelo
3. Backend listar(): Rol.query.order_by(Rol.nombre).all()
4. Backend listar_permisos(): Permiso.query.order_by(Permiso.nombre).all()
   (incluye los 8 permisos asistente_* junto con todos los demás)
5. Frontend: buildMatrix(catalogo)
   - Separa permisos en 3 grupos:
     a. "matrix": permisos con prefijo ver_, crear_, editar_, gestionar_ → columnas CRUD
     b. "asistente_matrix": permisos que empiezan con "asistente_" → columna Asistente IA
     c. "sinGrupo": cualquier otro permiso (se muestra aparte)
6. Renderiza la tabla con la columna extra "Asistente IA" (ícono Bot)
```

#### Al seleccionar un rol

```
1. clic en un rol → seleccionarRol(rol)
2. GET /roles/{id_rol}
3. Backend: RolPermiso.query.filter_by(id_rol=?).all()
            → retorna permisos_asignados (lista de IDs)
4. Frontend: setAsignados(new Set(ids))  &  setPendientes(new Set(ids))
   - "asignados" = estado guardado en BD
   - "pendientes" = estado actual en pantalla (puede diferir si hay cambios sin guardar)
5. Renderiza checkboxes marcados/desmarcados según permisos del rol
   - Columna CRUD: checkbox por cada celda (ver_, crear_, etc.)
   - Columna Asistente IA: checkbox por cada módulo (asistente_proyectos, etc.)
```

#### Al marcar/desmarcar permisos

```
1. togglePermiso(perm.id):
   - Si el ID está en "pendientes" → lo quita
   - Si no está → lo agrega
   → Actualiza el Set local, NO hace llamada al backend todavía

2. toggleColumnaIA(asistente_matrix):
   - Si TODOS los asistente_* están en "pendientes" → los quita todos
   - Si falta alguno → agrega todos
   → También es local, sin llamada al backend

3. toggleFila(mod, matrix):
   - Similar pero para todos los permisos CRUD de un módulo

4. toggleColumna(prefijo, matrix):
   - Marca/desmarca toda una columna CRUD (ej: todos los "ver_")
```

#### Al guardar cambios

```
1. clic en "Guardar cambios" → intentarGuardar()

CASO ESPECIAL: rol Administrador sin ningún permiso (pendientes.size === 0)
→ Muestra modal de advertencia
→ Si confirma → guardar(forzar=true)
→ Si cancela → no hace nada

CASO NORMAL:
2. PUT /roles/{id_rol}/permisos
   Body: { permisos: [id1, id2, ...], forzar: false }
   (el array incluye TODOS los permisos marcados: CRUD + asistente_*)

3. Backend:
   a. Valida que todos los IDs existan en la tabla permiso
   b. Si rol=Administrador y permisos=[] y forzar=false → 409 con advertencia
   c. RolPermiso.query.filter_by(id_rol=?).delete()  ← borra todos los anteriores
   d. INSERT RolPermiso por cada id_permiso nuevo
   e. Calcula agregados y quitados para la bitácora
   f. log("ACTUALIZAR_PERMISOS_ROL", detalles[campo, anterior, nuevo])
   g. Retorna 200 { rol, total_permisos, permisos_asignados[] }

4. Frontend: actualiza "asignados" y "pendientes" con el resultado del servidor
```

### 3.5 Casos de error

| Código | Situación | Comportamiento |
|--------|-----------|----------------|
| 409 + `advertencia: true` | Administrador quedaría sin permisos | Modal de confirmación; si acepta, reenvía con `forzar: true` |
| 400 | Se enviaron IDs de permisos que no existen en el catálogo | Mensaje de error: `"Permisos inexistentes en el catálogo: [ids]"` |
| 403 | Intento de eliminar el rol Administrador | `"No se puede eliminar el rol Administrador"` (en DELETE, no aplica aquí) |

---

## 4. Decisiones técnicas clave

### ¿Por qué tool-use y no prompt directo?

Si se enviara todo el contenido de la BD en el prompt, el contexto sería gigantesco e impreciso. Con tool-use, Claude solicita solo los datos que necesita según la pregunta, y el backend ejecuta queries SQL acotadas (LIMIT 30). Esto garantiza:
- Datos siempre actualizados (no embeddings ni caché)
- Menor consumo de tokens
- Control fino sobre qué puede ver cada usuario

### ¿Por qué máximo 6 iteraciones?

Porque algunas consultas requieren más de una herramienta (ej: primero busca el proyecto, luego pide el detalle de una orden). 6 iteraciones permiten consultas complejas sin riesgo de bucle infinito.

### ¿Por qué permisos `asistente_*` separados de `ver_*`?

Porque `ver_*` da acceso a la UI del módulo (lista, filtros, detalles). `asistente_*` es un acceso de lectura agregada específicamente para el chatbot. Un técnico podría necesitar ver órdenes en la UI pero no que el asistente acceda a finanzas, por ejemplo. Son permisos ortogonales.

### ¿Por qué el Administrador accede a todo sin verificar permisos?

```python
es_admin = bool(usuario.rol and usuario.rol.nombre == ROL_ADMIN)
```
Si `es_admin` es `True`, la función `_tiene_acceso()` retorna `True` sin verificar el dict `MODULOS`. Esto evita que el administrador quede sin acceso al asistente si se olvida de asignarle los `asistente_*`.

### ¿Por qué un solo archivo `asistente.py` y no tres?

Originalmente había `asistente.py` (rutas), `agente.py` (orquestación Claude) y `herramientas.py` (funciones SQL). Se fusionaron en un único archivo para eliminar imports entre módulos internos y simplificar el mantenimiento. Al ser un paquete autocontenido con un único Blueprint, un archivo es suficiente.

### ¿Por qué `INSERT IGNORE` en la migración?

MySQL no tiene `INSERT OR IGNORE` como SQLite. `INSERT IGNORE` evita que la migración falle si los permisos ya existen en la BD (idempotente). Si se corre `flask db upgrade` dos veces, no genera error.

### ¿Por qué los errores de Claude retornan HTTP 200?

Porque desde el punto de vista del frontend, la petición al backend fue exitosa. El error ocurrió internamente (Claude no pudo responder). Retornar 500 haría que el interceptor de Axios lo trate como error de red y muestre un mensaje genérico. Con 200 + `{error: "..."}`, el mensaje llega al chat correctamente.

---

## 5. Preguntas frecuentes de defensa

**¿Cómo sabe el sistema qué puede ver cada usuario?**
Al recibir el JWT, extrae el `id` del usuario, consulta sus permisos del rol en la BD, filtra los que empiezan con `asistente_` y compara con el dict `MODULOS`. Solo las herramientas de los módulos permitidos se envían a Claude.

**¿Qué pasa si Claude intenta invocar una herramienta de un módulo que el usuario no tiene?**
`_ejecutar_herramienta()` verifica el permiso antes de ejecutar la función SQL. Si el usuario no tiene el permiso, retorna `{"error": "No tenés permiso para consultar el módulo X"}` como tool_result, y Claude lo incluye en su respuesta al usuario.

**¿Cómo se evita que el asistente invente datos?**
El system prompt dice explícitamente: *"Para obtener datos usá exclusivamente las herramientas disponibles. Nunca inventes datos: si una herramienta no devuelve resultados, decilo."* Además, Claude no tiene acceso a internet ni a la BD directamente — solo puede llamar a las funciones que el backend le expone.

**¿Se guarda el historial de la conversación en la BD?**
No. El historial existe solo en el estado React de `AsistentePage` (en memoria del navegador). Al refrescar la página se pierde. Lo único que se registra en BD es la bitácora: acción `CONSULTA_ASISTENTE`, los primeros 120 caracteres de la pregunta y los módulos consultados.

**¿Qué graba exactamente la bitácora?**
```python
log('CONSULTA_ASISTENTE',
    f'Consulta: "{pregunta[:120]}" | módulos: {modulos_consultados}',
    id_usuario=usuario.id,
    modulo='asistente')
```
Registra: quién consultó, parte de la pregunta y qué módulos se consultaron en esa interacción.

**¿Cómo se conecta CU51 con CU50?**
CU51 asigna permisos `asistente_*` a los roles. CU50 lee esos permisos para decidir qué herramientas y qué módulos muestra. Si el Administrador quita `asistente_finanzas` a un rol, la próxima vez que un usuario con ese rol consulte, el asistente no tendrá la herramienta de finanzas disponible ni la mencionará.

**¿Por qué la respuesta está en Markdown?**
El system prompt instruye a Claude a responder en Markdown para que el frontend pueda renderizarlo. `markdown.js` convierte el texto con `**negrita**`, `# encabezados`, `| tablas |` etc. al HTML correspondiente mediante `dangerouslySetInnerHTML`.

**¿Qué modelo de IA se usa y por qué?**
`claude-haiku-4-5-20251001` — es el modelo más rápido y económico de la familia Claude. Para consultas de negocio con respuestas estructuradas, Haiku tiene capacidad suficiente y la latencia es aceptable para un chatbot.

**¿Qué son los `modulos_consultados` en la respuesta?**
Es una lista de los módulos de dominio que el agente efectivamente consultó durante esa interacción. Por ejemplo, si la pregunta era "¿cuánto pagó el cliente ABC?" y Claude usó `finanzas_pagos_por_cliente`, `modulos_consultados` sería `["finanzas"]`. Sirve para la bitácora y para que el frontend sepa qué áreas se tocaron.
