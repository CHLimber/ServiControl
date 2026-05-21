# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ServiControl** is a web platform for managing electronic security companies. It's a full-stack application with:
- **Backend**: Flask + SQLAlchemy + MySQL
- **Frontend**: React 18 + Vite + React Router
- **Deployment**: Railway (supports auto-seeding and production DB)

The application implements role-based access control (RBAC) with detailed audit logging for all actions.

## Repository Structure

```
Software/
├── backend/               # Flask REST API
│   ├── app/
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── routes/        # Flask Blueprints (13 modules)
│   │   ├── schemas/       # Marshmallow schemas (if used)
│   │   ├── utils/         # Utility functions
│   │   ├── config.py      # Environment & Flask config
│   │   ├── extensions.py  # Flask extension initialization
│   │   ├── permisos.py    # Role-based permission decorator
│   │   ├── bitacora.py    # Audit logging to console & DB
│   │   └── correo.py      # Email notifications (async threads)
│   ├── migrations/        # Alembic migrations
│   ├── tests/             # Unit & integration tests (pytest)
│   ├── requirements.txt    # Python dependencies
│   ├── .env.example       # Environment template
│   ├── run.py             # Dev server entry point (debug=True)
│   ├── wsgi.py            # Production entry point (gunicorn)
│   ├── seed_railway.py    # Idempotent DB seeding for Railway builds
│   ├── seed_passwords.py  # Password hashing helper
│   ├── Procfile           # Heroku-style process file
│   ├── railway.json       # Railway build & deploy config
│   ├── scrip creacion BD.txt     # SQL: schema creation
│   └── scrip poblacion.txt       # SQL: test data seeding
│
└── frontend/              # React SPA
    ├── src/
    │   ├── api/           # Axios API clients per module
    │   ├── pages/         # React page components (12 modules)
    │   ├── components/    # Shared components (Layout, Sidebar, Topbar)
    │   ├── context/       # React Context (Auth, Theme)
    │   ├── hooks/         # Custom React hooks
    │   ├── styles/        # Global CSS
    │   ├── utils/         # Utility functions
    │   ├── App.jsx        # Route definitions
    │   └── main.jsx       # React entry point
    ├── package.json       # Dependencies & npm scripts
    ├── vite.config.js     # Vite build config
    ├── .env.example       # Frontend env template
    └── railway.json       # Railway build & deploy config
```

## Core Architecture

### Backend (Flask)

**App initialization** (`app/__init__.py`):
- Creates Flask app with dynamic config (development/production/testing)
- Initializes 5 extensions: SQLAlchemy, Flask-Migrate, JWT, CORS, Flask-Mail
- Registers 13 Blueprints (API routes) with `/api` prefix

**Database**:
- Uses SQLAlchemy ORM with PyMySQL driver
- Connection string: Built from `MYSQL_URL` (Railway) or individual env vars (local)
- Models organized in `app/models/` by feature (auth, proyecto, orden, etc.)

**Authentication & Authorization**:
- JWT tokens (15min access, 7d refresh) configured in `config.py`
- Login protection: Progressive account blocking (1→3→5→15 min) after 3 failed attempts
- Email notifications on login failure & account lock
- `@requiere_permiso(nombre)` decorator checks role-based permissions via RolPermiso table
- Tokens stored in localStorage on frontend, auto-refreshed via interceptor

**Audit & Logging**:
- `bitacora.py::log()` writes to both console and `bitacora` table
- Tracks: action, user, module, description, IP, change details (campo, anterior, nuevo)
- Used in auth (login attempts, locks), operations (CRUD), and security events
- Async: BitacoraDetalle captures field-level changes for entity updates

**Email** (`correo.py`):
- Async threading for non-blocking sends
- Uses Flask-Mail with SMTP (Gmail template in .env.example)
- Methods: `notificar_intento_fallido()`, `notificar_cuenta_bloqueada()`, etc.

### Modules

The backend is organized around 13 business modules (as Blueprints):

| Module | Purpose | Key Models |
|--------|---------|-----------|
| **auth** | JWT login/refresh, user sessions | Usuario, Rol, Permiso, RolPermiso |
| **entidades** | Clients, suppliers, employees | Entidad, EntidadNatural, EntidadJuridica, Empleado |
| **productos** | Catalog items, pricing | Producto, Categoria |
| **cotizaciones** | Quotes to clients | Cotizacion, CotizacionDetalle |
| **proyectos** | Installation projects, status tracking | Proyecto, EstadoProyecto, ProyectoHistorial |
| **ordenes** | Work orders assigned to technicians | OrdenTrabajo, OrdenEmpleado, OrdenProducto, OrdenHistorial |
| **mantenimiento** | Preventive & corrective maintenance | Mantenimiento, AlertaMantenimiento |
| **finanzas** | Payments, expenses, accounts receivable | Pago, GastoOrden |
| **notificaciones** | System notifications | Notificacion |
| **catalogos** | Master data (types, municipalities, services) | TipoDocumento, TipoSistema, Servicio, etc. |
| **usuarios** | User management (create, edit, permissions) | Usuario, Rol, RolPermiso |
| **roles** | Role & permission management | Rol, Permiso, RolPermiso |
| **auditoria** | Audit log viewer | Bitacora, BitacoraDetalle |

### Frontend (React)

**Architecture**:
- Single-page app (SPA) with client-side routing (React Router v6)
- Protected routes: `RutaProtegida` component redirects to `/login` if no token
- Context-based state: AuthContext (user, token, login/logout), ThemeContext

**API Communication**:
- `api/client.js`: Axios instance with:
  - Request interceptor: Adds `Authorization: Bearer {token}` header
  - Response interceptor: Auto-refreshes expired tokens (shared promise to prevent race conditions)
  - Session clearing on 401 with no refresh token
- Each module has its own API client (e.g., `api/auth.js`, `api/productos.js`)

**Pages** (12 modules, one placeholder):
- Dashboard, Auth, Entidades, Cotizaciones, Proyectos, Ordenes, Mantenimiento, Finanzas, Productos, Usuarios, Auditoria, Roles, Catalogos (placeholder)

**Components**:
- Layout: App shell with Sidebar (nav), Topbar (user menu), main content area
- No UI framework mentioned — likely custom CSS or minimal styling

## Development Workflow

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate # Linux/Mac

pip install -r requirements.txt

# Copy & edit .env with MySQL credentials
copy .env.example .env

# Create database & tables
mysql -u root -p < scrip\ creacion\ BD.txt

# (Optional) Seed test data
mysql -u root -p < scrip\ poblacion.txt

# Run dev server (port 5000, debug=True)
python run.py
```

### Frontend Setup

```bash
cd frontend

npm install

# Copy & edit .env (optional, defaults to localhost:5000/api)
copy .env.example .env

# Run dev server (port 5173, with /api proxy to backend)
npm run dev
```

### Testing

**Backend** (pytest):
```bash
cd backend
pytest                        # Run all tests in tests/
pytest tests/test_auth.py     # Run single test file
pytest tests/test_auth.py::test_login  # Run single test function
```

Config: `pytest.ini` points testpaths to `tests/` directory.

**Frontend**: No test runner configured (no jest/vitest setup).

### Building & Deployment

**Production Backend**:
```bash
# Via gunicorn (Procfile)
gunicorn wsgi:app --bind 0.0.0.0:${PORT:-8080} --workers 2 --timeout 120
```

**Production Frontend**:
```bash
npm run build    # Vite build to dist/
npm run serve    # Serve dist/ on port $PORT (Railway)
```

**Railway Deployment**:
- Backend: Runs `seed_railway.py` before gunicorn (idempotent seeding)
- Frontend: Builds with `VITE_API_URL` inlined (must be set before build)
- MySQL plugin auto-injects `MYSQL_URL` env var

## Key Implementation Details

### Database Schema

**Inheritance Pattern**: Entidad uses single-table inheritance (type column) with separate tables for natural/juridical persons.

**State Machines**: Proyecto, EstadoProyecto, and ProyectoHistorial track state changes; similar pattern for OrdenTrabajo/EstadoOrden.

**Cascading Relationships**: Foreign keys have explicit `name=` clauses (e.g., `fk_usuario_rol`) for clarity.

### Role-Based Access Control

Example usage in routes:
```python
from ..permisos import requiere_permiso

@bp.post('/usuarios')
@requiere_permiso('crear_usuario')
def crear_usuario():
    ...
```

Permission check:
1. Extract user ID from JWT
2. Query RolPermiso join Permiso
3. Match role + permission name
4. Return 403 if missing

### Configuration

Environment-based config (dev/production/testing):
- **Development**: Debug=True, SQLite (tests only), 5s access token
- **Production**: Debug=False, MySQL, 15min access token
- **Secrets**: SECRET_KEY, JWT_SECRET_KEY (must be randomized in production)

JWT expiry: 15min (access), 7d (refresh).

### Migrations

Using Alembic. To add a migration:
```bash
cd backend
flask db migrate -m "description"
flask db upgrade
```

## Common Tasks

### Add a New Module

1. Create model file in `app/models/{module}.py`
2. Export in `app/models/__init__.py`
3. Create route file in `app/routes/{module}.py` (Flask Blueprint with `@requiere_permiso` decorators)
4. Register Blueprint in `app/__init__.py` with url_prefix
5. Create frontend API client in `frontend/src/api/{module}.js`
6. Create page component in `frontend/src/pages/{module}/`
7. Add route to `frontend/src/App.jsx`
8. Create migration: `flask db migrate` + `flask db upgrade`

### Add a Permission

1. Seed/insert into `permiso` table (name, descripcion)
2. Assign to roles via `rol_permiso` table
3. Use `@requiere_permiso('permission_name')` on routes

### Debug Email Issues

- Verify `MAIL_USERNAME` and `MAIL_PASSWORD` in .env
- For Gmail: Use App Password (not regular password)
- Emails send async in background threads — no immediate failure if bad creds

## Environment Variables

**Backend** (`.env`):
- `SECRET_KEY`, `JWT_SECRET_KEY`: Secrets (randomize in production)
- `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`: MySQL connection
- `MYSQL_URL`: Auto-injected by Railway (overrides DB_* vars)
- `LOGIN_MAX_INTENTOS`: Attempts before lockout (default 3)
- `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`: SMTP config
- `ALLOWED_ORIGINS`: CORS allowed domains (comma-separated or `*`)
- `FLASK_ENV`: development/production (default: development)

**Frontend** (`.env`):
- `VITE_API_URL`: Backend API URL (default: `http://localhost:5000/api`)

## Testing Credentials (after seed)

| Username | Password | Role |
|----------|----------|------|
| admin.mendoza | Admin123! | Administrador |
| marco.ibanez | Tecnico123! | Técnico Superior |
| ana.quispe | Atencion123! | Atención Cliente |
| roberto.flores | Campo123! | Técnico de Campo |

(Defined in `seed_railway.py`, used by Railway auto-seed.)

## Deployment Notes

- **Idempotent Seeding**: `seed_railway.py` checks if DB is empty before populating
- **CORS**: Frontend origin must be explicitly listed in `ALLOWED_ORIGINS` (or use `*` in dev)
- **Token Refresh**: Frontend auto-refreshes on 401; no manual token refresh needed
- **Database Charset**: `utf8mb4` hardcoded in connection string for emoji/unicode support
