"""
Script de inicializacion de BD para Railway.
Se ejecuta como build step (NIXPACKS_BUILD_CMD o railway.json buildCommand).

Orden:
  1) crear tablas SQL (idempotente: CREATE TABLE IF NOT EXISTS)
  2) poblar datos (solo si la BD esta vacia)
  3) actualizar contrasenas con hash werkzeug

Si MYSQL_URL no esta definida, el script termina con codigo 0
(para que el build no falle cuando no hay plugin MySQL conectado).
"""
import os
import sys
from pathlib import Path
import pymysql
from urllib.parse import urlparse
from werkzeug.security import generate_password_hash

MYSQL_URL = os.getenv('MYSQL_URL', '')
if not MYSQL_URL:
    print("[seed] MYSQL_URL no definida, omitiendo seed.")
    sys.exit(0)

parsed = urlparse(MYSQL_URL)
base_dir = Path(__file__).parent


def get_conn():
    return pymysql.connect(
        host=parsed.hostname,
        port=parsed.port or 3306,
        user=parsed.username,
        password=parsed.password,
        database=parsed.path.lstrip('/'),
        charset='utf8mb4',
        autocommit=False,
    )


def run_sql_file(filepath):
    print(f"\n>>> Ejecutando: {filepath.name}")
    sql = filepath.read_text(encoding='utf-8')
    skip_prefixes = ('create database', 'drop database', 'use ', 'set foreign_key_checks', 'set names')
    statements = []
    for s in sql.split(';'):
        s = s.strip()
        if not s:
            continue
        lower = s.lower()
        if any(lower.startswith(p) for p in skip_prefixes):
            continue
        if lower.startswith('create table') and 'if not exists' not in lower:
            s = s.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS', 1)
            s = s.replace('create table', 'CREATE TABLE IF NOT EXISTS', 1)
        statements.append(s)

    conn = get_conn()
    cursor = conn.cursor()
    ok = errors = 0
    for stmt in statements:
        try:
            cursor.execute(stmt)
            ok += 1
        except Exception as e:
            errors += 1
            msg = str(e)
            if 'Duplicate entry' not in msg and 'already exists' not in msg:
                print(f"  WARN: {msg[:200]}")
    conn.commit()
    cursor.close()
    conn.close()
    print(f"    {ok} OK, {errors} advertencias")


def seed_passwords():
    print("\n>>> Actualizando contrasenas...")
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
    conn = get_conn()
    cursor = conn.cursor()
    actualizados = 0
    for username, password in PASSWORDS.items():
        hashed = generate_password_hash(password)
        rows = cursor.execute(
            "UPDATE usuario SET password=%s WHERE username=%s",
            (hashed, username)
        )
        if rows:
            actualizados += 1
            print(f"  OK {username}")
        else:
            print(f"  -- {username} no encontrado")
    conn.commit()
    cursor.close()
    conn.close()
    print(f"    {actualizados} contrasenas actualizadas")


def aplicar_migraciones_permisos():
    """Inserta permisos nuevos y los asigna a los roles indicados si aún no existen.

    Cada tupla: (nombre, descripcion, [roles que lo reciben]).
    El Administrador siempre recibe el permiso aunque no esté en la lista.
    """
    permisos_nuevos = [
        ('gestionar_roles',     'Gestionar roles y permisos del sistema',         []),
        ('gestionar_empleados', 'Crear, editar y desactivar empleados',           []),
        ('consultar_proveedores', 'Consultar el catálogo de proveedores y precios',
            ['Técnico Superior']),
        # Asistente IA (CU50/CU51) — permisos por módulo. El Administrador los recibe
        # automáticamente; el resto de roles se asignan desde Gestión de Roles.
        ('asistente_proyectos',      'Permite al asistente IA consultar el módulo de Proyectos',            []),
        ('asistente_ordenes',        'Permite al asistente IA consultar el módulo de Órdenes de trabajo',   []),
        ('asistente_clientes',       'Permite al asistente IA consultar el módulo de Clientes',             []),
        ('asistente_cotizaciones',   'Permite al asistente IA consultar el módulo de Cotizaciones',         []),
        ('asistente_finanzas',       'Permite al asistente IA consultar el módulo de Finanzas',             []),
        ('asistente_mantenimientos', 'Permite al asistente IA consultar el módulo de Mantenimiento',        []),
        ('asistente_empleados',      'Permite al asistente IA consultar el módulo de Empleados',            []),
        ('asistente_catalogo',       'Permite al asistente IA consultar el módulo de Catálogo',             []),
    ]
    conn = get_conn()
    cursor = conn.cursor()
    for nombre, descripcion, roles_extra in permisos_nuevos:
        cursor.execute("SELECT COUNT(*) FROM permiso WHERE nombre=%s", (nombre,))
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                "INSERT INTO permiso (nombre, descripcion) VALUES (%s, %s)",
                (nombre, descripcion),
            )
            cursor.execute("SELECT LAST_INSERT_ID()")
            id_permiso = cursor.fetchone()[0]
            for rol_nombre in ['Administrador', *roles_extra]:
                cursor.execute("SELECT id FROM rol WHERE nombre=%s", (rol_nombre,))
                row = cursor.fetchone()
                if row:
                    cursor.execute(
                        "INSERT IGNORE INTO rol_permiso (id_rol, id_permiso) VALUES (%s, %s)",
                        (row[0], id_permiso),
                    )
            destinos = ', '.join(['Administrador', *roles_extra])
            print(f"  + permiso '{nombre}' (id={id_permiso}) asignado a {destinos}")
    conn.commit()
    cursor.close()
    conn.close()


def aplicar_migraciones_pendientes():
    """ALTER TABLE idempotentes y CREATE TABLE IF NOT EXISTS para BDs creadas con DDL anterior."""
    columnas_a_agregar = [
        ('usuario',  'intentos_fallidos', 'SMALLINT NOT NULL DEFAULT 0'),
        ('usuario',  'bloqueado_hasta',   'DATETIME NULL'),
        ('usuario',  'veces_bloqueado',   'SMALLINT NOT NULL DEFAULT 0'),
        ('usuario',  'ultima_salida',     'DATETIME NULL'),
        ('servicio', 'estado',            'BOOLEAN NOT NULL DEFAULT TRUE'),
    ]
    tablas_a_crear = [
        (
            'bitacora',
            """CREATE TABLE IF NOT EXISTS bitacora (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_usuario INT NULL,
                accion VARCHAR(50) NOT NULL,
                modulo VARCHAR(50) NULL,
                descripcion TEXT NULL,
                ip VARCHAR(45) NULL,
                fecha DATETIME NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_bitacora_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id),
                INDEX ix_bitacora_id_usuario (id_usuario),
                INDEX ix_bitacora_accion (accion),
                INDEX ix_bitacora_modulo (modulo),
                INDEX ix_bitacora_fecha (fecha)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
        ),
        (
            'bitacora_detalle',
            """CREATE TABLE IF NOT EXISTS bitacora_detalle (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_bitacora INT NOT NULL,
                campo VARCHAR(100) NOT NULL,
                valor_anterior TEXT NULL,
                valor_nuevo TEXT NULL,
                CONSTRAINT fk_bitdet_bitacora FOREIGN KEY (id_bitacora) REFERENCES bitacora(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
        ),
        (
            'producto_proveedor',
            """CREATE TABLE IF NOT EXISTS producto_proveedor (
                id_producto         INT NOT NULL,
                id_proveedor        INT NOT NULL,
                precio_unitario     DECIMAL(12,2) NOT NULL,
                es_principal        BOOLEAN DEFAULT FALSE,
                fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id_producto, id_proveedor),
                CONSTRAINT fk_prod_prov_producto  FOREIGN KEY (id_producto)  REFERENCES producto(id)  ON DELETE CASCADE,
                CONSTRAINT fk_prod_prov_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
        ),
        (
            'telefono_proveedor',
            """CREATE TABLE IF NOT EXISTS telefono_proveedor (
                id_telefono  INT NOT NULL,
                id_proveedor INT NOT NULL,
                PRIMARY KEY (id_telefono, id_proveedor),
                CONSTRAINT fk_tel_prov_telefono  FOREIGN KEY (id_telefono)  REFERENCES telefono(id)  ON DELETE CASCADE,
                CONSTRAINT fk_tel_prov_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
        ),
        (
            'telefono_entidad',
            """CREATE TABLE IF NOT EXISTS telefono_entidad (
                id_telefono INT NOT NULL,
                id_entidad  INT NOT NULL,
                PRIMARY KEY (id_telefono, id_entidad),
                CONSTRAINT fk_telefono_entidad_telefono FOREIGN KEY (id_telefono) REFERENCES telefono(id) ON DELETE CASCADE,
                CONSTRAINT fk_telefono_entidad_entidad  FOREIGN KEY (id_entidad)  REFERENCES entidad(id)  ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
        ),
        (
            'empleado_especialidad',
            """CREATE TABLE IF NOT EXISTS empleado_especialidad (
                id_empleado     INT NOT NULL,
                id_especialidad INT NOT NULL,
                PRIMARY KEY (id_empleado, id_especialidad),
                CONSTRAINT fk_emp_esp_empleado     FOREIGN KEY (id_empleado)     REFERENCES empleado(id)     ON DELETE CASCADE,
                CONSTRAINT fk_emp_esp_especialidad FOREIGN KEY (id_especialidad) REFERENCES especialidad(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
        ),
        (
            'bitacora_cliente',
            """CREATE TABLE IF NOT EXISTS bitacora_cliente (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_entidad INT NOT NULL,
                id_usuario INT NOT NULL,
                nota TEXT NOT NULL,
                fecha_creacion DATETIME NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_bitcli_entidad FOREIGN KEY (id_entidad) REFERENCES entidad(id) ON DELETE CASCADE,
                CONSTRAINT fk_bitcli_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
        ),
        (
            'bitacora_proyecto',
            """CREATE TABLE IF NOT EXISTS bitacora_proyecto (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_proyecto INT NOT NULL,
                id_usuario INT NOT NULL,
                nota TEXT NOT NULL,
                fecha_creacion DATETIME NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_bitproy_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyecto(id) ON DELETE CASCADE,
                CONSTRAINT fk_bitproy_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
        ),
        (
            'documento',
            """CREATE TABLE IF NOT EXISTS documento (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_proyecto INT NULL,
                id_entidad INT NULL,
                id_usuario INT NOT NULL,
                id_tipo_documento INT NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                ruta VARCHAR(500) NOT NULL,
                fecha_subida DATETIME NOT NULL DEFAULT NOW(),
                descripcion TEXT NULL,
                CONSTRAINT fk_doc_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyecto(id) ON DELETE CASCADE,
                CONSTRAINT fk_doc_entidad FOREIGN KEY (id_entidad) REFERENCES entidad(id) ON DELETE CASCADE,
                CONSTRAINT fk_doc_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id),
                CONSTRAINT fk_doc_tipo FOREIGN KEY (id_tipo_documento) REFERENCES tipo_documento(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
        ),
        (
            'preferencia_notificacion',
            """CREATE TABLE IF NOT EXISTS preferencia_notificacion (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_usuario INT NOT NULL,
                tipo ENUM('alerta_mantenimiento','orden_asignada','proyecto_actualizado','pago_registrado','stock_critico') NOT NULL,
                en_centro BOOLEAN NOT NULL DEFAULT TRUE,
                en_correo BOOLEAN NOT NULL DEFAULT TRUE,
                CONSTRAINT fk_pref_notif_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id) ON DELETE CASCADE,
                CONSTRAINT uq_pref_usuario_tipo UNIQUE (id_usuario, tipo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
        ),
    ]
    db_name = parsed.path.lstrip('/')
    conn = get_conn()
    cursor = conn.cursor()
    agregadas = 0
    for tabla, columna, definicion in columnas_a_agregar:
        cursor.execute(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_schema=%s AND table_name=%s AND column_name=%s",
            (db_name, tabla, columna),
        )
        if cursor.fetchone()[0] == 0:
            cursor.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna} {definicion}")
            agregadas += 1
            print(f"  + {tabla}.{columna}")
    for nombre_tabla, ddl in tablas_a_crear:
        cursor.execute(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema=%s AND table_name=%s",
            (db_name, nombre_tabla),
        )
        if cursor.fetchone()[0] == 0:
            cursor.execute(ddl)
            agregadas += 1
            print(f"  + tabla {nombre_tabla}")
    conn.commit()
    cursor.close()
    conn.close()
    if agregadas:
        print(f">>> {agregadas} cambios aplicados")


def sembrar_datos_negocio():
    """Genera datos ADICIONALES de negocio (clientes, cotizaciones, proyectos,
    órdenes de trabajo, pagos y gastos) para dar volumen a los reportes de
    finanzas / proyectos / OT.

    - NO crea usuarios ni personal nuevo (reutiliza los existentes).
    - Idempotente: si ya existen proyectos con código 'PRY-G%' no vuelve a insertar.
    - Lee todos los IDs de referencia en tiempo de ejecución, así que funciona
      sobre cualquier BD que ya tenga los catálogos base poblados.
    - Corre en una sola transacción: si algo falla, hace rollback completo.
    """
    import random
    from datetime import date, datetime, timedelta

    conn = get_conn()
    cur = conn.cursor()

    def _rows(sql):
        cur.execute(sql)
        return cur.fetchall()

    def _col(sql):
        return [r[0] for r in _rows(sql)]

    # Requisitos mínimos: catálogos base presentes
    cur.execute("SHOW TABLES LIKE 'proyecto'")
    if not cur.fetchone():
        cur.close(); conn.close()
        return

    cur.execute("SELECT COUNT(*) FROM proyecto WHERE codigo LIKE 'PRY-G%'")
    if cur.fetchone()[0] > 0:
        print("[seed] datos de negocio adicionales ya presentes, omitiendo.")
        cur.close(); conn.close()
        return

    servicios  = _col("SELECT id FROM servicio")
    usuarios   = _col("SELECT id FROM usuario")
    empleados  = _col("SELECT id FROM empleado")
    municipios = _col("SELECT id FROM municipio")
    tipos_est  = _col("SELECT id FROM tipo_establecimiento")
    tipos_sis  = _col("SELECT id FROM tipo_sistema")
    prod_prov  = _rows("SELECT id_producto, id_proveedor, precio_unitario FROM producto_proveedor")
    est_proy   = {n: i for i, n in _rows("SELECT id, nombre FROM estado_proyecto")}
    est_orden  = {n: i for i, n in _rows("SELECT id, nombre FROM estado_orden")}

    faltan = [nombre for nombre, val in [
        ('servicio', servicios), ('usuario', usuarios), ('empleado', empleados),
        ('municipio', municipios), ('tipo_establecimiento', tipos_est),
        ('tipo_sistema', tipos_sis), ('producto_proveedor', prod_prov),
        ('estado_proyecto', est_proy), ('estado_orden', est_orden),
    ] if not val]
    if faltan:
        print(f"[seed] faltan catálogos base {faltan}, omitiendo datos de negocio.")
        cur.close(); conn.close()
        return

    rnd = random.Random(20260706)  # determinístico → reproducible

    def eid(mapa, *nombres, defecto=None):
        for n in nombres:
            if n in mapa:
                return mapa[n]
        return defecto if defecto is not None else next(iter(mapa.values()))

    # Estados objetivo (con fallback si algún nombre no existe)
    EP_APROBADO   = eid(est_proy, 'Aprobado', 'En Ejecución')
    EP_EJECUCION  = eid(est_proy, 'En Ejecución', 'Aprobado')
    EP_COMPLETADO = eid(est_proy, 'Completado', 'Cerrado')
    EP_CERRADO    = eid(est_proy, 'Cerrado', 'Completado')
    EP_GARANTIA   = eid(est_proy, 'En Garantía', 'Completado')
    EP_COTIZADO   = eid(est_proy, 'Cotizado', 'Aprobado')
    EO_VALIDADA   = eid(est_orden, 'Validada', 'Completada')
    EO_COMPLETADA = eid(est_orden, 'Completada', 'Validada')
    EO_INICIADA   = eid(est_orden, 'Iniciada', 'En Camino')
    EO_ASIGNADA   = eid(est_orden, 'Asignada', 'Creada')

    NOMBRES_EMPRESA = [
        'Comercial', 'Distribuidora', 'Importadora', 'Constructora', 'Inversiones',
        'Corporación', 'Agroindustrias', 'Servicios', 'Logística', 'Grupo',
    ]
    APELLIDOS = [
        'Vaca', 'Justiniano', 'Roca', 'Áñez', 'Cuéllar', 'Suárez', 'Melgar',
        'Parada', 'Landívar', 'Saucedo', 'Menacho', 'Ribera', 'Egüez', 'Balcázar',
        'Chávez', 'Ortiz', 'Vargas', 'Peña', 'Guzmán', 'Salvatierra',
    ]
    RUBROS = ['SRL', 'SA', 'Ltda.', 'y Cía.', 'Bolivia']
    hoy = date(2026, 7, 6)

    # ------------------------------------------------------------------
    # 1) Nuevos clientes con establecimiento + sistema propios
    # ------------------------------------------------------------------
    NUEVOS_CLIENTES = 22
    triples = []  # (id_entidad, id_establecimiento, id_sistema)
    for k in range(NUEVOS_CLIENTES):
        es_juridica = k % 4 != 0  # ~75% empresas
        fecha_reg = hoy - timedelta(days=rnd.randint(120, 640))
        if es_juridica:
            base = rnd.choice(NOMBRES_EMPRESA)
            ape = rnd.choice(APELLIDOS)
            nombre = f"{base} {ape} {rnd.choice(RUBROS)}"
            email = f"contacto{9000+k}@{base.lower()}{ape.lower()}.com.bo"
        else:
            nombre = f"{rnd.choice(APELLIDOS)} {rnd.choice(APELLIDOS)}"
            email = f"cliente{9000+k}@gmail.com"
        cur.execute(
            "INSERT INTO entidad (nombre, tipo, email, cliente, empleado, fecha_registro, estado) "
            "VALUES (%s, %s, %s, TRUE, FALSE, %s, TRUE)",
            (nombre, 'juridica' if es_juridica else 'natural', email, fecha_reg),
        )
        id_entidad = cur.lastrowid
        if es_juridica:
            cur.execute(
                "INSERT INTO entidad_juridica (id_entidad, nit, nombre_comercial, razon_social) "
                "VALUES (%s, %s, %s, %s)",
                (id_entidad, f"99{5000000 + k:07d}", nombre, f"{nombre} S.R.L."),
            )
        else:
            cur.execute(
                "INSERT INTO entidad_natural (id_entidad, ci, sexo, fecha_nacimiento) "
                "VALUES (%s, %s, %s, %s)",
                (id_entidad, f"90{50000 + k:05d}", rnd.choice(['M', 'F']),
                 date(rnd.randint(1965, 1998), rnd.randint(1, 12), rnd.randint(1, 28))),
            )
        cur.execute(
            "INSERT INTO establecimiento (id_entidad, id_municipio, id_tipo_establecimiento, direccion, estado, fecha_creacion) "
            "VALUES (%s, %s, %s, %s, TRUE, %s)",
            (id_entidad, rnd.choice(municipios), rnd.choice(tipos_est),
             f"Av. {rnd.choice(APELLIDOS)} #{rnd.randint(100, 3999)}", fecha_reg),
        )
        id_est = cur.lastrowid
        tiene_mant = rnd.random() < 0.7
        cur.execute(
            "INSERT INTO sistema (id_establecimiento, id_tipo_sistema, nombre, tiene_mantenimiento, periodicidad_dias, estado) "
            "VALUES (%s, %s, %s, %s, %s, TRUE)",
            (id_est, rnd.choice(tipos_sis),
             f"Sistema de seguridad {nombre[:40]}",
             tiene_mant, rnd.choice([90, 180, 365]) if tiene_mant else None),
        )
        id_sis = cur.lastrowid
        triples.append((id_entidad, id_est, id_sis))

    # También aprovechar establecimientos/sistemas ya existentes para más proyectos
    existentes = _rows(
        "SELECT e.id_entidad, e.id AS id_est, s.id AS id_sis "
        "FROM sistema s JOIN establecimiento e ON s.id_establecimiento = e.id "
        "WHERE e.id_entidad IS NOT NULL"
    )
    combos = triples + [tuple(r) for r in existentes]

    # ------------------------------------------------------------------
    # 2) Cotización + proyecto + órdenes + pagos + gastos
    # ------------------------------------------------------------------
    PROYECTOS = 40
    ESCENARIOS = (
        # (estado_proyecto, fraccion_pagada 0..1, estado_orden_final)
        [(EP_COMPLETADO, 1.00, EO_VALIDADA)]   * 8 +
        [(EP_CERRADO,    1.00, EO_VALIDADA)]   * 6 +
        [(EP_GARANTIA,   1.00, EO_COMPLETADA)] * 4 +
        [(EP_EJECUCION,  0.50, EO_INICIADA)]   * 10 +
        [(EP_APROBADO,   0.30, EO_ASIGNADA)]   * 8 +
        [(EP_COTIZADO,   0.00, None)]          * 4
    )
    TITULOS = [
        'Instalación de CCTV', 'Control de acceso', 'Alarma perimetral',
        'Cerco eléctrico', 'Videovigilancia IP', 'Sistema integrado de seguridad',
        'Ampliación de cámaras', 'Migración a tecnología IP', 'Mantenimiento correctivo',
    ]
    n_cot = n_proy = n_ot = n_pago = n_gasto = 0
    monto_pagos = 0.0

    for i in range(PROYECTOS):
        id_entidad, id_est, id_sis = rnd.choice(combos)
        id_serv = rnd.choice(servicios)
        id_user = rnd.choice(usuarios)
        estado_p, frac, estado_o_final = rnd.choice(ESCENARIOS)

        f_creacion = hoy - timedelta(days=rnd.randint(20, 460))
        # --- Cotización + detalle ---
        mano_obra = round(rnd.uniform(800, 6000), 2)
        n_items = rnd.randint(1, 4)
        items = rnd.sample(prod_prov, min(n_items, len(prod_prov)))
        subtotal_prod = 0.0
        detalles = []
        for id_prod, id_prov, precio in items:
            precio = float(precio)
            cant = rnd.randint(1, 12)
            sub = round(precio * cant, 2)
            subtotal_prod += sub
            detalles.append((id_prod, id_prov, cant, precio, sub))
        subtotal_prod = round(subtotal_prod, 2)
        total_proy = round(subtotal_prod + mano_obra, 2)

        n_cot += 1
        cur.execute(
            "INSERT INTO cotizacion (codigo, id_entidad, id_servicio, id_usuario, id_sistema, estado, "
            "subtotal_productos, mano_de_obra, vigencia_dias, observacion, fecha_creacion) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (f"COT-G{i+1:04d}", id_entidad, id_serv, id_user, id_sis,
             'convertida' if estado_p != EP_COTIZADO else 'enviada',
             subtotal_prod, mano_obra, 30, 'Cotización generada para carga de datos.',
             datetime.combine(f_creacion, datetime.min.time())),
        )
        id_cot = cur.lastrowid
        for id_prod, id_prov, cant, precio, sub in detalles:
            cur.execute(
                "INSERT INTO cotizacion_detalle (id_cotizacion, id_producto, id_proveedor, cantidad, precio_unitario, subtotal) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (id_cot, id_prod, id_prov, cant, precio, sub),
            )

        # Cotización sin convertir → no genera proyecto
        if estado_p == EP_COTIZADO:
            continue

        # --- Proyecto ---
        f_inicio = f_creacion + timedelta(days=rnd.randint(3, 20))
        completo = estado_p in (EP_COMPLETADO, EP_CERRADO, EP_GARANTIA)
        f_fin = f_inicio + timedelta(days=rnd.randint(10, 90)) if completo else None
        n_proy += 1
        cur.execute(
            "INSERT INTO proyecto (codigo, id_entidad, id_establecimiento, id_servicio, id_estado_proyecto, "
            "id_usuario, id_cotizacion, id_sistema, titulo, descripcion, fecha_inicio, fecha_fin, fecha_creacion) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (f"PRY-G{i+1:04d}", id_entidad, id_est, id_serv, estado_p, id_user, id_cot, id_sis,
             rnd.choice(TITULOS), 'Proyecto generado para carga de datos de negocio.',
             f_inicio, f_fin, datetime.combine(f_creacion, datetime.min.time())),
        )
        id_proy = cur.lastrowid

        # --- Órdenes de trabajo (1-3) ---
        for j in range(rnd.randint(1, 3)):
            f_ejec = f_inicio + timedelta(days=rnd.randint(1, 60))
            estado_o = estado_o_final if j == 0 else rnd.choice(
                [EO_VALIDADA, EO_COMPLETADA, EO_INICIADA, EO_ASIGNADA])
            n_ot += 1
            cur.execute(
                "INSERT INTO orden_trabajo (codigo, id_proyecto, id_servicio, id_estado_orden, id_usuario, "
                "descripcion, fecha_ejecucion, tiempo_estimado, fecha_creacion) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (f"OT-G{i+1:04d}-{j+1}", id_proy, id_serv, estado_o, id_user,
                 'Orden de trabajo generada para carga de datos.', f_ejec,
                 rnd.randint(2, 24), datetime.combine(f_creacion, datetime.min.time())),
            )
            id_ot = cur.lastrowid
            # responsable + posible ayudante
            for idx_emp, id_emp in enumerate(rnd.sample(empleados, min(rnd.randint(1, 2), len(empleados)))):
                cur.execute(
                    "INSERT IGNORE INTO orden_empleado (id_orden_trabajo, id_empleado, es_responsable) VALUES (%s, %s, %s)",
                    (id_ot, id_emp, idx_emp == 0),
                )
            # productos usados
            for id_prod, id_prov, cant, precio, sub in rnd.sample(detalles, min(rnd.randint(1, 2), len(detalles))):
                cur.execute(
                    "INSERT IGNORE INTO orden_producto (id_orden_trabajo, id_producto, cantidad_asignada, cantidad_usada) "
                    "VALUES (%s, %s, %s, %s)",
                    (id_ot, id_prod, cant, cant),
                )
            # gastos de la orden (1-2)
            for _ in range(rnd.randint(1, 2)):
                f_gasto = f_ejec + timedelta(days=rnd.randint(0, 5))
                if f_gasto > hoy:
                    f_gasto = hoy
                concepto = rnd.choice(['materiales', 'viaticos', 'transporte', 'otro'])
                n_gasto += 1
                cur.execute(
                    "INSERT INTO gasto_orden (id_orden, id_usuario, concepto, descripcion, monto, fecha_gasto) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    (id_ot, id_user, concepto, f"Gasto de {concepto} en la orden.",
                     round(rnd.uniform(50, 900), 2), f_gasto),
                )

        # --- Pagos según fracción pagada ---
        pagado = round(total_proy * frac, 2)
        if pagado > 0:
            if frac >= 1.0:
                plan = [('anticipo', 0.4), ('pago_parcial', 0.3), ('pago_final', 0.3)]
            elif frac >= 0.5:
                plan = [('anticipo', 0.4), ('pago_parcial', frac - 0.4)]
            else:
                plan = [('anticipo', frac)]
            f_pago = f_inicio
            for tipo, prop in plan:
                monto = round(total_proy * prop, 2)
                if monto <= 0:
                    continue
                f_pago = f_pago + timedelta(days=rnd.randint(5, 40))
                if f_pago > hoy:
                    f_pago = hoy
                n_pago += 1
                monto_pagos += monto
                cur.execute(
                    "INSERT INTO pago (id_proyecto, id_usuario, tipo_pago, monto, fecha_pago, metodo, observacion) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (id_proy, id_user, tipo, monto, f_pago,
                     rnd.choice(['efectivo', 'transferencia', 'QR']),
                     f"Pago ({tipo}) registrado."),
                )

    conn.commit()
    cur.close()
    conn.close()
    print(f">>> datos de negocio: {NUEVOS_CLIENTES} clientes, {n_cot} cotizaciones, "
          f"{n_proy} proyectos, {n_ot} órdenes, {n_pago} pagos (Bs {monto_pagos:,.0f}), {n_gasto} gastos")


def bd_ya_poblada():
    """Devuelve True si la tabla usuario existe y tiene >= 1 registro."""
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES LIKE 'usuario'")
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return False
        cursor.execute("SELECT COUNT(*) FROM usuario")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return count > 0
    except Exception as e:
        print(f"[seed] No se pudo verificar estado de BD: {e}")
        return False


def main():
    try:
        get_conn().close()
    except Exception as e:
        print(f"ERROR conectando a MySQL: {e}")
        sys.exit(1)

    if bd_ya_poblada():
        print("[seed] BD ya poblada, aplicando migraciones y refrescando contrasenas.")
        aplicar_migraciones_pendientes()
        aplicar_migraciones_permisos()
        seed_passwords()
        sembrar_datos_negocio()
        print("\n[seed] OK")
        return

    run_sql_file(base_dir / 'scrip creacion BD.txt')
    run_sql_file(base_dir / 'scrip poblacion.txt')
    aplicar_migraciones_pendientes()
    aplicar_migraciones_permisos()
    seed_passwords()
    sembrar_datos_negocio()
    print("\n[seed] OK")


if __name__ == '__main__':
    main()
