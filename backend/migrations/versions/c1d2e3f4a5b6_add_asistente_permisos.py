"""add_asistente_permisos

Revision ID: c1d2e3f4a5b6
Revises: a3f7b2c1d8e4
Create Date: 2026-07-04 00:00:00.000000

"""
from alembic import op

revision = 'c1d2e3f4a5b6'
down_revision = 'a3f7b2c1d8e4'
branch_labels = None
depends_on = None

_PERMISOS = [
    ('asistente_proyectos',      'Permite al asistente IA consultar el módulo de Proyectos'),
    ('asistente_ordenes',        'Permite al asistente IA consultar el módulo de Órdenes de trabajo'),
    ('asistente_clientes',       'Permite al asistente IA consultar el módulo de Clientes'),
    ('asistente_cotizaciones',   'Permite al asistente IA consultar el módulo de Cotizaciones'),
    ('asistente_finanzas',       'Permite al asistente IA consultar el módulo de Finanzas'),
    ('asistente_mantenimientos', 'Permite al asistente IA consultar el módulo de Mantenimiento'),
    ('asistente_empleados',      'Permite al asistente IA consultar el módulo de Empleados'),
    ('asistente_catalogo',       'Permite al asistente IA consultar el módulo de Catálogo'),
]


def upgrade():
    for nombre, descripcion in _PERMISOS:
        op.execute(
            f"INSERT IGNORE INTO permiso (nombre, descripcion) "
            f"VALUES ('{nombre}', '{descripcion}')"
        )


def downgrade():
    nombres = ', '.join(f"'{n}'" for n, _ in _PERMISOS)
    op.execute(f"DELETE FROM permiso WHERE nombre IN ({nombres})")
