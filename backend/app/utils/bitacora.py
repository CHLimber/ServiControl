import sys
from datetime import datetime


def log(accion: str, descripcion: str, usuario: str = None,
        id_usuario: int = None, modulo: str = None, detalles: list = None):
    """Registra un evento en consola y en la tabla bitacora de la BD.

    detalles: lista de dicts con claves 'campo', 'anterior', 'nuevo'
    """
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    quien = usuario if usuario else (f'id:{id_usuario}' if id_usuario else 'sistema')
    mod   = f'[{modulo}]' if modulo else '[---]'
    print(f"[BITÁCORA] {timestamp} {mod} {accion} | {quien} | {descripcion}", flush=True)

    try:
        from flask import has_request_context, request as flask_request
        from ..extensions import db
        from ..models.auditoria.auditoria import Bitacora, BitacoraDetalle

        ip = flask_request.remote_addr if has_request_context() else None

        entrada = Bitacora(
            id_usuario=id_usuario,
            accion=accion,
            modulo=modulo,
            descripcion=descripcion,
            ip=ip,
        )
        db.session.add(entrada)
        db.session.flush()

        if detalles:
            for d in detalles:
                db.session.add(BitacoraDetalle(
                    id_bitacora=entrada.id,
                    campo=str(d.get('campo', '')),
                    valor_anterior=str(d['anterior']) if d.get('anterior') is not None else None,
                    valor_nuevo=str(d['nuevo']) if d.get('nuevo') is not None else None,
                ))

        db.session.commit()
    except Exception as e:
        print(f"[BITÁCORA] ERROR al guardar en BD: {e}", file=sys.stderr, flush=True)
        try:
            from ..extensions import db
            db.session.rollback()
        except Exception:
            pass
