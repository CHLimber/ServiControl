# Implementación CU39, CU41, CU44–CU49 — Mapa de archivos y líneas

> Sesión de implementación de los 8 casos de uso finales de **ServiControl**.
> Este documento mapea **qué archivo y qué rango de líneas** corresponde a cada CU,
> con foco en los **archivos compartidos** que mezclan código de varios CU (clave para
> separar commits/ramas con `git add -p`).
> 
> Las líneas son aproximadas al estado del código tras la implementación; si el archivo
> se edita, reconfirmá con `grep -n`.

---

## 1. Resumen de lo implementado

| CU       | Nombre                            | Esencia                                                                                                                                                 |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CU39** | Consultar Catálogo de Proveedores | Endpoints solo-lectura `/proveedores/catalogo` + página maestro-detalle. Permiso `consultar_proveedores` (Admin + Téc. Superior) vía `requiere_alguno`. |
| **CU41** | Reprogramar Mantenimiento         | `PUT /mantenimiento/{id}/reprogramar`: valida estado (E1) y fecha futura (E2), actualiza alertas y bitácora. Modal en `MantenimientoPage`.              |
| **CU44** | Enviar Notificación por Correo    | Modelo `LogCorreo`; `correo.py` registra cada envío (enviado/fallido/omitido). Viewer admin `GET /notificaciones/correos` + `CorreosPage`.              |
| **CU45** | Preferencias de Notificación      | Modelo `PreferenciaNotificacion`; `GET/PUT /notificaciones/preferencias` + `PreferenciasPage`.                                                          |
| **CU46** | Marcar Todas como Leídas          | Ajuste de respuesta backend (caso E1 sin pendientes) en `/notificaciones/leer-todas`. UI ya existía.                                                    |
| **CU47** | Exportar Log de Auditoría         | `GET /auditoria/exportar?formato=csv                                                                                                                    |
| **CU48** | Consultar Auditoría por Usuario   | Filtro `id_usuario` + `GET /auditoria/usuarios`. `AuditoriaUsuarioPage`.                                                                                |
| **CU49** | Generar Reporte de Actividad      | `GET /auditoria/reporte-actividad?desde&hasta` (conteos). `ReporteActividadPage`.                                                                       |

**Migraciones necesarias** (en `backend/seed_railway.py`): crea tablas `log_correo` y
`preferencia_notificacion`, e inserta el permiso `consultar_proveedores`.





| CU       | Nombre         |     |
| -------- | -------------- | --- |
| **CU39** | Camila         |     |
| **CU41** | Diego Pereira  |     |
| **CU44** | Diego Llanos   |     |
| **CU45** | Pachuri        |     |
| **CU46** | Diego Perreira |     |
| **CU47** | Limber         |     |
| **CU48** | Santiago       |     |
| **CU49** | Pachuri        |     |



---

## 2. Archivos NUEVOS (el archivo completo = un solo CU)

| CU   | Archivo                                                   |
| ---- | --------------------------------------------------------- |
| CU39 | `frontend/src/pages/catalogo/CatalogoProveedoresPage.jsx` |
| CU44 | `frontend/src/pages/sistema/CorreosPage.jsx`              |
| CU45 | `frontend/src/pages/notificaciones/PreferenciasPage.jsx`  |
| CU47 | `frontend/src/pages/auditoria/ExportarLogPage.jsx`        |
| CU48 | `frontend/src/pages/auditoria/AuditoriaUsuarioPage.jsx`   |
| CU49 | `frontend/src/pages/auditoria/ReporteActividadPage.jsx`   |

---

## 3. Archivos de UN solo CU pero MODIFICADOS

### CU39

- `backend/app/utils/permisos.py` → **líneas 34–57**: helper `requiere_alguno(*nombres)`.
- `backend/app/routes/catalogo/proveedores.py`
  - **línea 8**: import `requiere_alguno`.
  - **líneas 186–252**: bloque `# ── CU39` (`catalogo_listar`, `catalogo_productos`).
- `frontend/src/api/proveedores.js` → **líneas 22–24**: `catalogoListar`, `catalogoProductos`.

### CU41

- `backend/app/routes/mantenimiento/mantenimiento.py`
  - **línea 1**: `from datetime import date, datetime`.
  - **línea 10**: `from ...utils.timezone import ahora_bolivia`.
  - **líneas 92–~165**: bloque `# ── CU41` (`ESTADOS_NO_REPROGRAMABLES`, `def reprogramar`).
- `frontend/src/api/mantenimiento.js` → **línea 8**: `reprogramar`.
- `frontend/src/pages/mantenimiento/MantenimientoPage.jsx`
  - **línea 4**: import `CalendarClock`.
  - **línea 33**: método inline `reprogramar`.
  - **línea 36**: const `ESTADOS_NO_REPROG`.
  - **líneas 64–71**: estado del modal (`modalReprog`, `fechaReprog`, `obsReprog`, etc.).
  - **líneas 123–156**: funciones `abrirReprogramar` y `reprogramar`.
  - **líneas 248–253**: botón "Reprogramar" en la columna de acciones.
  - **líneas 311–349**: modal de reprogramación.

---

## 4. Archivos COMPARTIDOS (varios CU en el mismo archivo) ⚠️

> Para separar por rama, usá `git add -p <archivo>` y aceptá solo los hunks del CU.

### `frontend/src/App.jsx`

| CU       | Líneas                                                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CU39     | **27** (import `CatalogoProveedoresPage`) · **114–115** (ruta `/catalogo/consultar-proveedores`)                                                                               |
| CU45     | **29** (import `PreferenciasPage`) · **119** (ruta `/notificaciones/preferencias`)                                                                                             |
| CU44     | **30** (import `CorreosPage`) · **120** (ruta `/sistema/correos`)                                                                                                              |
| CU47     | **31** (import `ExportarLogPage`) · **123** (ruta `/auditoria/exportar`)                                                                                                       |
| CU48     | **32** (import `AuditoriaUsuarioPage`) · **122** (ruta `/auditoria/por-usuario`)                                                                                               |
| CU49     | **33** (import `ReporteActividadPage`) · **124** (ruta `/auditoria/reporte`)                                                                                                   |
| Limpieza | **4–6** (se quitó import de iconos del placeholder) y se eliminó la función `P()` y el import `ModuloPlaceholder` (placeholders reemplazados por páginas reales de CU47/CU49). |

### `frontend/src/components/Layout/Sidebar.jsx`

| CU     | Líneas                                                                              |
| ------ | ----------------------------------------------------------------------------------- |
| varios | **9** (import iconos `Mail`, `Search`, `SlidersHorizontal`)                         |
| CU39   | **51** (ítem "Catálogo proveedores" en OPERACIONES)                                 |
| CU45   | **113–120** (Notificaciones convertido a grupo con hijo "Preferencias")             |
| CU48   | **127** (hijo "Por usuario")                                                        |
| CU49   | **129** (hijo "Reporte de actividad" → permiso `ver_reportes`)                      |
| CU44   | **123** (`paths` incluye `/sistema/correos`) · **130** (hijo "Registro de correos") |

### `backend/app/routes/auditoria/auditoria.py`

| CU        | Líneas                                                                              |
| --------- | ----------------------------------------------------------------------------------- |
| varios    | **1–11** (imports `csv`, `io`, `datetime`, `Response`, `func`, `timezone`)          |
| CU47/CU48 | **16–40** (`_aplicar_filtros`; incluye el filtro `id_usuario` de CU48 en ~21/33–34) |
| CU48      | **109–127** (`listar_usuarios_con_actividad`, endpoint `/usuarios`)                 |
| CU47      | **129–231** (`exportar`, `_exportar_csv`, `_exportar_pdf`, `_ascii`)                |
| CU49      | **233–308** (`reporte_actividad`, endpoint `/reporte-actividad`)                    |

> Nota: `listar()` (43–68) reutiliza `_aplicar_filtros`, por lo que el soporte de
> `id_usuario` (CU48) se activa también ahí sin código adicional.

### `backend/app/routes/notificaciones/notificaciones.py`

| CU        | Líneas                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| CU44/CU45 | **1–20** (imports de `PreferenciaNotificacion`, `LogCorreo`, `TIPOS_NOTIFICACION`, `Usuario`, `requiere_permiso`, y `ETIQUETAS_TIPO`) |
| CU46      | **42–57** (`marcar_todas_leidas` con respuesta E1 sin pendientes)                                                                     |
| CU45      | **101–160** (`listar_preferencias`, `guardar_preferencias`)                                                                           |
| CU44      | **163–207** (`listar_correos`, endpoint `/correos`)                                                                                   |

### `backend/app/models/notificaciones/notificacion.py`

| CU        | Líneas                                                                   |
| --------- | ------------------------------------------------------------------------ |
| CU44/CU45 | **5–9** (`TIPOS_NOTIFICACION`, reutilizado por el modelo `Notificacion`) |
| CU45      | **23–39** (modelo `PreferenciaNotificacion`)                             |
| CU44      | **41–52** (modelo `LogCorreo`)                                           |

### `backend/app/models/__init__.py`

| CU        | Líneas                                                    |
| --------- | --------------------------------------------------------- |
| CU44/CU45 | **12** (export de `PreferenciaNotificacion`, `LogCorreo`) |

### `backend/app/utils/correo.py` (reescrito para CU44)

| CU   | Líneas                                                                                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CU44 | **7–29** (`_registrar_log`) · **32–39** (`_enviar_async` registra enviado/fallido) · **42–54** (`_enviar` registra omitido) · resto: `notificar_*` con parámetro `id_usuario` |

### `backend/app/routes/seguridad/auth.py`

| CU   | Líneas                                                                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CU44 | **68** (`notificar_cuenta_bloqueada(..., id_usuario=usuario.id)`) · **78** (`notificar_intento_fallido(..., id_usuario=usuario.id)`) · **185** (`notificar_cambio_password(..., id_usuario=usuario.id)`) |

### `backend/app/routes/seguridad/usuarios.py`

| CU   | Líneas                                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| CU44 | **121** (`notificar_cambio_password(..., id_usuario=u.id)`) · **153** (`notificar_cuenta_desbloqueada(..., id_usuario=u.id)`) |

### `backend/seed_railway.py`

| CU   | Líneas                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------ |
| CU39 | **116–142** (`permisos_nuevos` con `consultar_proveedores` + loop generalizado que asigna a Administrador + roles extra) |
| CU45 | **242–253** (DDL tabla `preferencia_notificacion`)                                                                       |
| CU44 | **254–267** (DDL tabla `log_correo`)                                                                                     |

### `frontend/src/api/notificaciones.js`

| CU   | Líneas                                               |
| ---- | ---------------------------------------------------- |
| CU45 | **10–12** (`getPreferencias`, `guardarPreferencias`) |
| CU44 | **14–15** (`listarCorreos`)                          |

### `frontend/src/api/auditoria.js`

| CU   | Líneas                                |
| ---- | ------------------------------------- |
| CU48 | **19–22** (`getUsuariosConActividad`) |
| CU49 | **24–27** (`getReporteActividad`)     |
| CU47 | **29–32** (`exportarAuditoria`, blob) |

### `frontend/src/pages/notificaciones/NotificacionesPage.jsx`

| CU   | Líneas                                                                                |
| ---- | ------------------------------------------------------------------------------------- |
| CU45 | **6** (import `SlidersHorizontal`) · **~107–118** (botón "Preferencias" en el header) |

---

## 5. Permisos usados por cada CU

| CU            | Permiso(s)                                         | Notas                                                          |
| ------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| CU39          | `consultar_proveedores` **o** `gestionar_catalogo` | Permiso nuevo, sembrado para Administrador + Técnico Superior. |
| CU41          | `gestionar_mantenimientos`                         | Existente.                                                     |
| CU44 (viewer) | `gestionar_usuarios`                               | Solo administradores.                                          |
| CU45          | (autenticado)                                      | Cualquier usuario sobre sus propias preferencias.              |
| CU46          | (autenticado)                                      | El usuario sobre sus notificaciones.                           |
| CU47          | `gestionar_usuarios`                               | Igual que el módulo de auditoría.                              |
| CU48          | `gestionar_usuarios`                               | Igual que el módulo de auditoría.                              |
| CU49          | `ver_reportes`                                     | Existente; lo tienen Administrador y Técnico Superior.         |

---

## 6. Verificación realizada

- Backend: `python -m py_compile` OK; `create_app('testing')` carga 19 blueprints.
- Frontend: `npm run build` OK.
- Tests: 38 pasan. Los 2 fallos (`telefono_entidad`) son **preexistentes** (tabla de
  asociación con SQL crudo, no modelada en ORM) y ajenos a estos CU.
