import pytest
from sqlalchemy import text
from werkzeug.security import generate_password_hash
from app import create_app
from app.extensions import db as _db
from app.models.seguridad.auth import Rol, Permiso, RolPermiso, Usuario
from app.models.entidades.entidad import Entidad, Empleado


# Tablas sin modelo ORM (se consultan con SQL crudo en las rutas).
# create_all() solo crea tablas de modelos, así que las añadimos a mano
# para que el entorno SQLite reproduzca el esquema MySQL de producción.
_TABLAS_SIN_MODELO = [
    "CREATE TABLE IF NOT EXISTS telefono ("
    " id INTEGER PRIMARY KEY AUTOINCREMENT,"
    " numero VARCHAR(20) NOT NULL)",
    "CREATE TABLE IF NOT EXISTS telefono_entidad ("
    " id_telefono INTEGER NOT NULL,"
    " id_entidad INTEGER NOT NULL,"
    " PRIMARY KEY (id_telefono, id_entidad))",
    "CREATE TABLE IF NOT EXISTS telefono_proveedor ("
    " id_telefono INTEGER NOT NULL,"
    " id_proveedor INTEGER NOT NULL,"
    " PRIMARY KEY (id_telefono, id_proveedor))",
]


@pytest.fixture()
def app():
    _app = create_app('testing')
    with _app.app_context():
        _db.create_all()
        for ddl in _TABLAS_SIN_MODELO:
            _db.session.execute(text(ddl))
        _db.session.commit()
        _sembrar_base()
        yield _app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


# ── helpers públicos ────────────────────────────────────────────────

def crear_usuario(username, permisos: list[str], password='pass1234'):
    """Crea un rol con los permisos dados y un usuario con ese rol."""
    rol = Rol(nombre=f'rol_{username}')
    _db.session.add(rol)
    _db.session.flush()

    for nombre in permisos:
        p = Permiso.query.filter_by(nombre=nombre).first()
        if p:
            _db.session.add(RolPermiso(id_rol=rol.id, id_permiso=p.id))

    entidad = Entidad(nombre=username, tipo='natural')
    _db.session.add(entidad)
    _db.session.flush()
    empleado = Empleado(id_entidad=entidad.id)
    _db.session.add(empleado)
    _db.session.flush()

    usuario = Usuario(
        username=username,
        password=generate_password_hash(password),
        id_rol=rol.id,
        id_empleado=empleado.id,
        estado=True,
        intentos_fallidos=0,
    )
    _db.session.add(usuario)
    _db.session.commit()
    return usuario


def login(client, username, password='pass1234'):
    """Hace POST /api/auth/login y retorna el JSON de respuesta."""
    rv = client.post('/api/auth/login', json={'username': username, 'password': password})
    return rv.status_code, rv.get_json()


def auth_headers(token):
    return {'Authorization': f'Bearer {token}'}


# ── seed de permisos compartidos ─────────────────────────────────────

_PERMISOS = [
    'ver_proyectos', 'crear_proyectos', 'editar_proyectos',
    'ver_ordenes', 'crear_ordenes', 'editar_ordenes',
    'ver_clientes', 'crear_clientes', 'editar_clientes',
    'ver_cotizaciones', 'crear_cotizaciones',
    'gestionar_usuarios', 'gestionar_catalogo',
    'ver_finanzas', 'gestionar_finanzas',
    'ver_mantenimientos', 'gestionar_mantenimientos',
    'ver_reportes',
]


def _sembrar_base():
    for nombre in _PERMISOS:
        _db.session.add(Permiso(nombre=nombre))
    _db.session.commit()
