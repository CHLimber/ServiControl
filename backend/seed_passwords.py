"""
Ejecutar UNA VEZ para:
1. Agregar columnas intentos_fallidos y bloqueado_hasta a la tabla usuario (si no existen)
2. Actualizar los hashes de contraseña al formato werkzeug (pbkdf2:sha256)

Uso:
    cd backend
    python seed_passwords.py

Credenciales que quedan:
    admin.mendoza   / Admin123!      (Administrador)
    marco.ibanez    / Tecnico123!    (Técnico Superior)
    luis.mamani     / Tecnico123!    (Técnico Superior)
    ana.quispe      / Atencion123!   (Atención al Cliente)
    patricia.medina / Atencion123!   (Atención al Cliente)
    roberto.flores  / Campo123!      (Técnico de Campo)
    miguel.torrez   / Campo123!      (Técnico de Campo)
    diego.rojas     / Campo123!      (Técnico de Campo)
    fernando.chavez / Campo123!      (Técnico de Campo)
    sergio.pedraza  / Campo123!      (Técnico de Campo)
"""

from werkzeug.security import generate_password_hash
from sqlalchemy import text
from app import create_app
from app.extensions import db

PASSWORDS = {
    'admin.mendoza':   'Admin123!',
    'marco.ibanez':    'Tecnico123!',
    'luis.mamani':     'Tecnico123!',
    'ana.quispe':      'Atencion123!',
    'patricia.medina': 'Atencion123!',
    'roberto.flores':  'Campo123!',
    'miguel.torrez':   'Campo123!',
    'diego.rojas':     'Campo123!',
    'fernando.chavez': 'Campo123!',
    'sergio.pedraza':  'Campo123!',
}

app = create_app()

with app.app_context():

    # ── 1. Agregar columnas faltantes si no existen ───────────────────────────
    print('Verificando columnas en tabla usuario...')

    columnas_requeridas = {
        'intentos_fallidos': 'ALTER TABLE usuario ADD COLUMN intentos_fallidos SMALLINT NOT NULL DEFAULT 0',
        'bloqueado_hasta':   'ALTER TABLE usuario ADD COLUMN bloqueado_hasta DATETIME NULL',
    }

    resultado = db.session.execute(text('SHOW COLUMNS FROM usuario')).fetchall()
    columnas_existentes = {fila[0] for fila in resultado}

    for columna, sql in columnas_requeridas.items():
        if columna not in columnas_existentes:
            db.session.execute(text(sql))
            db.session.commit()
            print(f'  + Columna "{columna}" agregada.')
        else:
            print(f'  ✓ Columna "{columna}" ya existe.')

    # ── 2. Actualizar contraseñas ─────────────────────────────────────────────
    print('\nActualizando contraseñas...')
    from app.models.seguridad.auth import Usuario
    actualizados = 0
    for username, password in PASSWORDS.items():
        usuario = Usuario.query.filter_by(username=username).first()
        if usuario:
            usuario.password = generate_password_hash(password)
            actualizados += 1
            print(f'  ✓ {username}')
        else:
            print(f'  ✗ {username} — no encontrado en BD')
    db.session.commit()
    print(f'\n{actualizados} contraseñas actualizadas.')
