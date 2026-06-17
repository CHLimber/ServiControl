"""Emisor central de notificaciones (CU45).

Punto único por el que el sistema genera avisos a los usuarios. Respeta las
preferencias configuradas en la tabla ``preferencia_notificacion``:

  - ``en_centro``  → inserta la notificación en el centro de notificaciones
                     (campanita), tabla ``notificacion``.
  - ``en_correo``  → envía además un correo electrónico al usuario.

Si el usuario no configuró preferencia para ese tipo de evento, se asume que
desea recibirlo por ambos canales (valores por defecto ``True``).

El emisor es **resiliente**: cualquier fallo se registra en el log pero nunca
interrumpe la operación de negocio que lo invocó. Por eso debe llamarse
siempre *después* del ``commit`` del evento principal.

Nota: el tipo ``stock_critico`` está definido en el catálogo de tipos pero no
tiene emisor porque el sistema aún no maneja inventario/stock de productos.
"""
from flask import current_app
from ..extensions import db
from ..models.notificaciones.notificacion import (
    Notificacion, PreferenciaNotificacion, TIPOS_NOTIFICACION,
)
from ..models.seguridad.auth import Usuario, RolPermiso, Permiso
from .correo import _enviar


def emitir(id_usuario, tipo, titulo, mensaje, url=None):
    """Notifica a un único usuario."""
    _emitir_lote([id_usuario], tipo, titulo, mensaje, url)


def emitir_a_empleados(ids_empleado, tipo, titulo, mensaje, url=None, excluir_usuario=None):
    """Notifica a los usuarios vinculados a los empleados indicados."""
    ids_empleado = [e for e in (ids_empleado or []) if e]
    if not ids_empleado:
        return
    ids = [
        u.id for u in Usuario.query
        .filter(Usuario.id_empleado.in_(ids_empleado), Usuario.estado.is_(True))
        .all()
    ]
    _emitir_lote(ids, tipo, titulo, mensaje, url, excluir_usuario)


def emitir_a_permiso(nombre_permiso, tipo, titulo, mensaje, url=None, excluir_usuario=None):
    """Notifica a todos los usuarios activos cuyo rol tiene el permiso dado."""
    ids = [
        row[0] for row in db.session.query(Usuario.id)
        .join(RolPermiso, RolPermiso.id_rol == Usuario.id_rol)
        .join(Permiso, Permiso.id == RolPermiso.id_permiso)
        .filter(Permiso.nombre == nombre_permiso, Usuario.estado.is_(True))
        .distinct().all()
    ]
    _emitir_lote(ids, tipo, titulo, mensaje, url, excluir_usuario)


def _emitir_lote(ids_usuario, tipo, titulo, mensaje, url=None, excluir_usuario=None):
    if tipo not in TIPOS_NOTIFICACION:
        current_app.logger.warning(f"[notif] tipo de notificación desconocido: {tipo}")
        return

    destinos = {i for i in (ids_usuario or []) if i and i != excluir_usuario}
    if not destinos:
        return

    try:
        prefs = {
            p.id_usuario: p for p in PreferenciaNotificacion.query
            .filter(
                PreferenciaNotificacion.id_usuario.in_(destinos),
                PreferenciaNotificacion.tipo == tipo,
            ).all()
        }
        usuarios = {u.id: u for u in Usuario.query.filter(Usuario.id.in_(destinos)).all()}

        creadas = False
        for uid in destinos:
            pref = prefs.get(uid)
            en_centro = pref.en_centro if pref else True
            en_correo = pref.en_correo if pref else True

            if en_centro:
                db.session.add(Notificacion(
                    id_usuario=uid, tipo=tipo, titulo=titulo, mensaje=mensaje, url=url,
                ))
                creadas = True
            if en_correo:
                u = usuarios.get(uid)
                if u and u.email:
                    _enviar(u.email, titulo, mensaje, id_usuario=uid)

        if creadas:
            db.session.commit()
    except Exception as exc:  # pragma: no cover - nunca debe romper el flujo
        db.session.rollback()
        current_app.logger.warning(f"[notif] no se pudo emitir '{tipo}': {exc}")
