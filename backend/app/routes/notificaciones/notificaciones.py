from flask import Blueprint, jsonify, request, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from ...extensions import db
from ...models.notificaciones.notificacion import (
    Notificacion, PreferenciaNotificacion, TIPOS_NOTIFICACION,
)
from ...utils.bitacora import log

bp = Blueprint('notificaciones', __name__)

# Etiquetas legibles para cada tipo de notificación
ETIQUETAS_TIPO = {
    'alerta_mantenimiento': 'Alerta de mantenimiento',
    'orden_asignada':       'Orden de trabajo asignada',
    'proyecto_actualizado': 'Proyecto actualizado',
    'pago_registrado':      'Pago registrado',
    'stock_critico':        'Stock crítico',
}


@bp.get('/')
@jwt_required()
def listar():
    id_usuario = int(get_jwt_identity())
    notifs = Notificacion.query.filter_by(id_usuario=id_usuario).order_by(Notificacion.fecha_creacion.desc()).all()
    return jsonify([_serializar(n) for n in notifs])


@bp.get('/no-leidas')
@jwt_required()
def no_leidas():
    id_usuario = int(get_jwt_identity())
    notifs = (Notificacion.query
              .filter_by(id_usuario=id_usuario, leida=False)
              .order_by(Notificacion.fecha_creacion.desc())
              .all())
    return jsonify([_serializar(n) for n in notifs])


@bp.put('/leer-todas')
@jwt_required()
def marcar_todas_leidas():
    """CU46 — Marca todas las notificaciones pendientes del usuario como leídas."""
    id_usuario = int(get_jwt_identity())
    cantidad = Notificacion.query.filter_by(id_usuario=id_usuario, leida=False).update({'leida': True})
    db.session.commit()
    if cantidad:
        log('NOTIFICACIONES_LEER_TODAS', f"{cantidad} notificación(es) marcada(s) como leídas",
            id_usuario=id_usuario, modulo='notificaciones')
        return jsonify({
            'mensaje': f'{cantidad} notificación(es) marcada(s) como leídas',
            'actualizadas': cantidad,
        })
    # E1: no había notificaciones pendientes
    return jsonify({'mensaje': 'No tenías notificaciones pendientes', 'actualizadas': 0})


@bp.put('/<int:id_notificacion>/leer')
@jwt_required()
def marcar_leida(id_notificacion):
    id_usuario = int(get_jwt_identity())
    n = db.get_or_404(Notificacion, id_notificacion)
    if n.id_usuario != id_usuario:
        abort(403)
    n.leida = True
    db.session.commit()
    log('NOTIFICACION_LEER', f"Notificación #{id_notificacion} '{n.titulo}' marcada como leída",
        id_usuario=id_usuario, modulo='notificaciones')
    return jsonify({'mensaje': 'Notificación marcada como leída'})


@bp.delete('/<int:id_notificacion>')
@jwt_required()
def eliminar(id_notificacion):
    id_usuario = int(get_jwt_identity())
    n = db.get_or_404(Notificacion, id_notificacion)
    if n.id_usuario != id_usuario:
        abort(403)
    titulo = n.titulo
    db.session.delete(n)
    db.session.commit()
    log('ELIMINAR_NOTIFICACION', f"Notificación #{id_notificacion} '{titulo}' eliminada",
        id_usuario=id_usuario, modulo='notificaciones')
    return jsonify({'mensaje': 'Notificación eliminada'})


def _serializar(n: Notificacion) -> dict:
    return {
        'id': n.id,
        'tipo': n.tipo,
        'titulo': n.titulo,
        'mensaje': n.mensaje,
        'leida': n.leida,
        'fecha_creacion': n.fecha_creacion.isoformat() if n.fecha_creacion else None,
        'url': n.url,
    }


# ── CU45: Configurar preferencias de notificación ───────────────

@bp.get('/preferencias')
@jwt_required()
def listar_preferencias():
    """Devuelve la preferencia de cada tipo (con valores por defecto si no existe)."""
    id_usuario = int(get_jwt_identity())
    existentes = {
        p.tipo: p for p in
        PreferenciaNotificacion.query.filter_by(id_usuario=id_usuario).all()
    }
    resultado = []
    for tipo in TIPOS_NOTIFICACION:
        pref = existentes.get(tipo)
        resultado.append({
            'tipo':      tipo,
            'etiqueta':  ETIQUETAS_TIPO.get(tipo, tipo),
            'en_centro': pref.en_centro if pref else True,
            'en_correo': pref.en_correo if pref else True,
        })
    return jsonify(resultado)


@bp.put('/preferencias')
@jwt_required()
def guardar_preferencias():
    """Guarda (upsert) las preferencias de notificación del usuario."""
    id_usuario = int(get_jwt_identity())
    data = request.get_json() or {}
    items = data.get('preferencias')
    if not isinstance(items, list):
        return jsonify({'error': 'Se esperaba una lista de preferencias'}), 400

    existentes = {
        p.tipo: p for p in
        PreferenciaNotificacion.query.filter_by(id_usuario=id_usuario).all()
    }
    actualizadas = 0
    for item in items:
        tipo = item.get('tipo')
        if tipo not in TIPOS_NOTIFICACION:
            continue
        en_centro = bool(item.get('en_centro', True))
        en_correo = bool(item.get('en_correo', True))
        pref = existentes.get(tipo)
        if pref:
            pref.en_centro = en_centro
            pref.en_correo = en_correo
        else:
            db.session.add(PreferenciaNotificacion(
                id_usuario=id_usuario, tipo=tipo,
                en_centro=en_centro, en_correo=en_correo,
            ))
        actualizadas += 1

    db.session.commit()
    log('GUARDAR_PREFERENCIAS_NOTIF',
        f'Preferencias de notificación actualizadas ({actualizadas} tipo(s))',
        id_usuario=id_usuario, modulo='notificaciones')
    return jsonify({'mensaje': 'Preferencias guardadas', 'actualizadas': actualizadas})
