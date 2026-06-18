# Informe General — ServiControl

> **Propósito:** Documento de entrada para quien se incorpora al proyecto. Explica qué es el sistema, cómo está organizado, cómo funciona en conjunto y cómo navegar por él. Para el detalle técnico de cada parte, consultar los informes complementarios.

---

## Documentos complementarios

| Documento | Descripción |
|---|---|
| [`informe-backend.md`](./informe-backend.md) | Estructura y navegación del servidor (Flask + Python) |
| [`informe-frontend.md`](./informe-frontend.md) | Estructura y navegación de la interfaz visual (React) |

---

## ¿Qué es ServiControl?

**ServiControl** es una plataforma web para la gestión interna de una empresa de seguridad electrónica. Centraliza en un solo sistema todo el ciclo operativo: desde que un cliente solicita un servicio hasta que se le instala, mantiene y cobra.

Está diseñado para ser usado por distintos perfiles de la empresa (administradores, técnicos, personal de atención al cliente), cada uno con acceso solo a las secciones que le corresponden.

---

## Alcance del sistema

### El sistema incluye

| # | Módulo | Descripción |
|---|---|---|
| 1 | **Autenticación y Control de Acceso** | Gestiona el inicio y cierre de sesión del personal. Incluye bloqueo automático de cuentas por intentos fallidos, notificaciones por correo electrónico ante intentos sospechosos, y control de acceso basado en 4 roles: Administrador, Técnico Superior, Atención al Cliente y Técnico de Campo. |
| 2 | **Roles y Permisos** | Permite al Administrador crear roles, asignarles permisos específicos y controlar qué acciones puede realizar cada tipo de usuario dentro del sistema. |
| 3 | **Usuarios** | Gestiona las cuentas del personal: crear, editar, activar o desactivar usuarios, asignarles un rol y permitirles editar su propio perfil (nombre, correo y contraseña). |
| 4 | **Entidades (Clientes)** | Registra y administra los datos de los clientes —personas naturales y empresas— que contratan los servicios. Incluye gestión de establecimientos (sucursales o sedes) y de los sistemas de seguridad instalados en cada uno de ellos. |
| 5 | **Empleados** | Registra el personal técnico y operativo de la empresa: datos personales, cargo, especialidades y estado de actividad. Permite asignar técnicos a órdenes de trabajo y proyectos. |
| 6 | **Proveedores** | Gestiona los proveedores de equipos y materiales, incluyendo sus datos de contacto, departamento y los productos que suministran con sus precios referenciales. |
| 7 | **Catálogo** | Administra el catálogo de productos, categorías de productos, servicios disponibles y los datos maestros del sistema (tipos de documento, tipos de establecimiento, tipos de sistema, municipios). |
| 8 | **Cotizaciones** | Permite generar presupuestos para los clientes detallando equipos y servicios requeridos, y hacer seguimiento al estado de cada cotización. |
| 9 | **Proyectos** | Gestiona los proyectos de instalación de sistemas de seguridad electrónica, desde su apertura hasta su cierre, con seguimiento de avances, cambios de estado y responsables. Incluye bitácoras de notas internas y gestión de documentos asociados al proyecto. |
| 10 | **Órdenes de Trabajo** | Registra y asigna las órdenes de trabajo derivadas de los proyectos, indicando las tareas, los técnicos responsables, los productos utilizados y el estado de ejecución. |
| 11 | **Mantenimiento** | Programa y registra los mantenimientos preventivos y correctivos de los sistemas instalados en los clientes. Genera alertas automáticas por vencimiento de mantenimientos y lleva historial de intervenciones. |
| 12 | **Finanzas** | Controla los movimientos económicos: pagos recibidos de clientes (con integración a pasarela Stripe), gastos operativos de órdenes y reportes financieros por período. |
| 13 | **Notificaciones** | Genera alertas internas para informar a los usuarios sobre eventos relevantes del sistema, como vencimientos, asignaciones o cambios de estado. |
| 14 | **Auditoría** | Registra automáticamente todas las acciones realizadas en el sistema (quién, qué, cuándo y desde qué IP), permitiendo trazabilidad completa para fines de seguridad y control. |
| 15 | **Dashboard** | Panel de inicio con indicadores generales del estado del sistema: proyectos activos, órdenes pendientes, mantenimientos próximos y resumen financiero. |

### El sistema NO incluye

- Facturación o cotización electrónica ni integración con sistemas tributarios (SIN/impuestos).
- Aplicación móvil nativa; el acceso desde dispositivos móviles se realiza mediante el navegador web.
- Módulo de contabilidad o gestión financiera completa (balances, estados financieros, libro diario).
- Geolocalización en tiempo real de técnicos.
- Monitoreo remoto de cámaras o equipos de seguridad.
- Acceso de clientes externos al sistema; los clientes son gestionados únicamente por el personal de la empresa.
- Control de inventario con registro formal de entradas y salidas de equipos y materiales.

---

## ¿Qué gestiona el sistema?

| Módulo | ¿Qué permite hacer? |
|---|---|
| **Dashboard** | Panel de indicadores generales: proyectos, órdenes, mantenimientos y finanzas |
| **Clientes y empresas** | Registrar y gestionar clientes (personas y empresas), sus establecimientos y los sistemas instalados |
| **Empleados** | Registrar el personal técnico y operativo de la empresa |
| **Proveedores** | Gestionar proveedores de equipos y materiales con sus precios |
| **Cotizaciones** | Crear y enviar presupuestos a clientes |
| **Proyectos** | Seguimiento de instalaciones con bitácoras y documentos adjuntos |
| **Órdenes de trabajo** | Asignar tareas técnicas al personal de campo |
| **Mantenimiento** | Programar y registrar mantenimientos, con alertas automáticas por vencimiento |
| **Finanzas** | Registrar pagos (Stripe), gastos y generar reportes financieros |
| **Usuarios y roles** | Administrar cuentas, perfiles y permisos del personal |
| **Auditoría** | Ver el historial completo de quién hizo qué y cuándo |
| **Notificaciones** | Recibir avisos internos del sistema |
| **Catálogo** | Gestionar productos, servicios, categorías y datos maestros (municipios, tipos, etc.) |

---

## Arquitectura general

ServiControl está dividido en dos partes que trabajan juntas:

```
┌─────────────────────────────────────────────────────────┐
│                      NAVEGADOR                          │
│                                                         │
│   Frontend (React)                                      │
│   • Interfaz visual                                     │
│   • Pantallas y formularios                             │
│   • Puerto 5174 (desarrollo)                            │
│                                                         │
│         │  Peticiones HTTP (/api/...)                   │
│         ▼                                               │
│   Backend (Flask + Python)                              │
│   • Lógica de negocio                                   │
│   • Control de acceso                                   │
│   • Puerto 5001 (desarrollo)                            │
│                                                         │
│         │  Consultas SQL                                │
│         ▼                                               │
│   Base de datos (MySQL)                                 │
│   • Almacenamiento permanente de toda la información    │
└─────────────────────────────────────────────────────────┘
```

- El **frontend** es lo que el usuario ve. Hace peticiones al backend para obtener o guardar datos.
- El **backend** es el servidor. Recibe esas peticiones, verifica que el usuario tenga permiso, ejecuta la lógica y consulta la base de datos.
- La **base de datos** almacena toda la información de forma permanente.

---

## Estructura de carpetas del proyecto

```
Software/                    ← Raíz del repositorio
├── backend/                 ← Servidor Flask (Python)
│   ├── app/                 ← Código fuente del backend
│   ├── migrations/          ← Historial de cambios en la BD
│   ├── tests/               ← Pruebas automatizadas
│   └── ...                  ← Archivos de configuración
│
├── frontend/                ← Interfaz React
│   ├── src/                 ← Código fuente del frontend
│   └── ...                  ← Archivos de configuración
│
└── ducumentacion/           ← Esta carpeta
    ├── informe-general.md   ← Este documento
    ├── informe-backend.md   ← Detalle del servidor
    └── informe-frontend.md  ← Detalle de la interfaz
```

---

## Cómo funciona el acceso al sistema

El sistema usa **roles y permisos** para controlar qué puede hacer cada usuario.

```
Usuario inicia sesión
        ↓
El backend verifica sus credenciales y devuelve un token
        ↓
Ese token viaja en cada petición (como una credencial temporal)
        ↓
Antes de ejecutar cualquier acción, el backend verifica:
¿Tiene este usuario permiso para hacer esto?
   ├─ Sí → ejecuta la acción
   └─ No → devuelve error 403 (prohibido)
        ↓
El frontend oculta los botones y secciones
a las que el usuario no tiene acceso
```

### Usuarios de prueba (tras cargar los datos iniciales)

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin.mendoza` | `Admin123!` | Administrador (acceso total) |
| `marco.ibanez` | `Tecnico123!` | Técnico Superior |
| `ana.quispe` | `Atencion123!` | Atención al Cliente |
| `roberto.flores` | `Campo123!` | Técnico de Campo |

---

## Cómo arrancar el sistema en desarrollo

Se necesita tener corriendo **ambas partes** al mismo tiempo.

**1. Base de datos**
- Debe estar corriendo MySQL en el puerto `3306`
- Crear la BD ejecutando el script `backend/scrip creacion BD.txt`
- (Opcional) Cargar datos de prueba con `backend/scrip poblacion.txt`

**2. Backend**
```bash
cd backend
venv\Scripts\activate     # Activar entorno virtual (Windows)
python run.py             # Servidor en http://localhost:5001
```

**3. Frontend**
```bash
cd frontend
npm install               # Solo la primera vez
npm run dev               # Interfaz en http://localhost:5174
```

Una vez los dos están corriendo, abrir `http://localhost:5174` en el navegador.

---

## Variables de entorno

Cada parte tiene su propio archivo `.env` con sus configuraciones. Ninguno se sube a Git.

| Archivo | Variables clave |
|---|---|
| `backend/.env` | Credenciales de la BD, claves JWT, configuración de correo SMTP, claves de Stripe |
| `frontend/.env` | `VITE_API_URL` — la URL donde está corriendo el backend |

> Copiar desde los archivos `.env.example` de cada carpeta como punto de partida.

---

## Ciclo de vida de una operación típica

El siguiente ejemplo muestra cómo interactúan las partes cuando un técnico registra una orden de trabajo:

```
1. El técnico abre la sección "Órdenes" en el navegador
        ↓
2. El frontend pide al backend la lista de órdenes
   GET /api/ordenes  (con token de sesión)
        ↓
3. El backend verifica el permiso "ver_ordenes"
        ↓
4. Consulta la tabla orden_trabajo en MySQL
        ↓
5. Devuelve la lista en formato JSON
        ↓
6. El frontend muestra las órdenes en pantalla
        ↓
7. El técnico crea una nueva orden y guarda
   POST /api/ordenes
        ↓
8. El backend valida el permiso "crear_orden",
   guarda en la BD y registra la acción en auditoría
        ↓
9. El frontend actualiza la lista automáticamente
```

---

## Despliegue en producción (Railway)

En producción, ambas partes se despliegan en **Railway** (plataforma en la nube).

| Parte | Cómo se sirve |
|---|---|
| Backend | Gunicorn (servidor Python robusto) en el puerto que Railway asigne |
| Frontend | Vite genera archivos estáticos compilados, Railway los sirve como web estática |
| Base de datos | Plugin MySQL de Railway, se conecta automáticamente vía variable `MYSQL_URL` |

El proceso de despliegue corre automáticamente `seed_railway.py` para cargar los datos iniciales si la base de datos está vacía.

---

## Tecnologías usadas

| Capa | Tecnología | Versión |
|---|---|---|
| Interfaz | React | 18 |
| Enrutamiento frontend | React Router | 6 |
| Peticiones HTTP | Axios | 1.7 |
| Bundler | Vite | 5 |
| Servidor | Flask | 3.0 |
| ORM (base de datos) | SQLAlchemy | 3.1 |
| Autenticación | JWT (Flask-JWT-Extended) | 4.6 |
| Base de datos | MySQL + PyMySQL | — |
| Migraciones | Alembic (Flask-Migrate) | 4.0 |
| Correo | Flask-Mail (SMTP Gmail) | 0.10 |
| Pagos | Stripe | 10.4 |
| Reportes PDF | fpdf2 | 2.7 |
| Servidor producción | Gunicorn | 22 |

---

## Resumen en una línea

| Parte | Una línea |
|---|---|
| **Frontend** | La interfaz visual en React que el usuario usa en el navegador |
| **Backend** | El servidor Flask que procesa la lógica y protege los datos |
| **Base de datos** | MySQL donde se almacena toda la información de forma permanente |
| **Roles y permisos** | Sistema que define qué puede ver y hacer cada tipo de usuario |
| **JWT** | El mecanismo de sesión: un token temporal que identifica al usuario en cada petición |
| **Railway** | La plataforma en la nube donde corre el sistema en producción |
