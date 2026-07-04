"""Agente del chatbot: orquesta la conversación con Claude usando tool-use.

El patrón ahorra tokens: Claude no recibe la base de datos. Recibe únicamente el
catálogo de herramientas permitidas para el rol del usuario. Decide qué herramienta(s)
llamar (o repreguntar si falta información); el backend ejecuta SELECTs acotados y le
devuelve solo esos resultados para que redacte la respuesta final en Markdown.
"""
import json

from flask import current_app

from . import herramientas as H
from ...utils.timezone import ahora_bolivia

MAX_ITERACIONES = 6
MAX_TOKENS = 1500


def _system_prompt(permitidos, denegados):
    labels_ok = ', '.join(H.MODULOS_LABEL[m] for m in permitidos) or 'ninguno'
    labels_no = ', '.join(H.MODULOS_LABEL[m] for m in denegados) or 'ninguno'
    hoy = ahora_bolivia().date().isoformat()
    return (
        "Sos el asistente virtual de ServiControl, un sistema de gestión para una empresa "
        "de seguridad electrónica. Ayudás a los usuarios a consultar información del sistema "
        "y a razonar sobre ella (por ejemplo, estimar costos de materiales).\n\n"
        f"Fecha de hoy: {hoy}.\n\n"
        "REGLAS:\n"
        "1. Respondé SIEMPRE en español y en formato Markdown (negritas, listas, encabezados "
        "y también TABLAS cuando ayuden a mostrar varios registros con columnas, por ejemplo "
        "un listado de pagos). Usá tablas Markdown con el formato "
        "`| Col1 | Col2 |` y la fila separadora `| --- | --- |`. Sé claro y conciso.\n"
        "2. Solo podés CONSULTAR información (solo lectura). Nunca afirmes que creaste, "
        "modificaste o eliminaste algo.\n"
        "3. Para obtener datos usá exclusivamente las herramientas disponibles. Nunca "
        "inventes datos: si una herramienta no devuelve resultados, decilo.\n"
        "4. Si la pregunta es ambigua o muy amplia (falta el cliente, el rango de fechas, "
        "el código de proyecto/orden, etc.), REPREGUNTÁ para acotar antes de consultar.\n"
        "5. Cuando hagas estimaciones o cálculos (costos aproximados, proyecciones), aclará "
        "explícitamente que son APROXIMADOS y explicá brevemente en qué te basaste.\n"
        f"6. El usuario tiene permiso para consultar estos módulos: {labels_ok}.\n"
        f"7. El usuario NO tiene permiso para: {labels_no}. Si su pregunta requiere alguno de "
        "estos, respondé lo que sí puedas con los módulos permitidos y avisale claramente que "
        "no tiene permiso para acceder a la parte restante (nombrá el módulo). No intentes "
        "rodear la restricción.\n"
        "8. Los montos están en bolivianos (Bs).\n"
        "9. ALCANCE: solo respondés consultas relacionadas con ServiControl y sus datos "
        "(clientes, proyectos, órdenes, cotizaciones, finanzas, mantenimiento, catálogo). "
        "Si te piden algo ajeno al sistema —escribir código, resolver tareas generales, "
        "matemáticas no relacionadas, conocimiento general, opiniones, traducciones, etc.— "
        "NO lo hagas: respondé brevemente que solo podés ayudar con consultas sobre "
        "ServiControl y ofrecé un ejemplo de lo que sí podés hacer. No inventes ni uses "
        "conocimiento externo al sistema."
    )


def _texto_de(respuesta):
    return ''.join(
        b.text for b in respuesta.content if getattr(b, 'type', None) == 'text'
    ).strip()


def responder(pregunta, historial, permisos, es_admin):
    """Procesa una consulta del usuario.

    Args:
        pregunta: texto del usuario.
        historial: lista de mensajes previos [{'role': 'user'|'assistant', 'content': str}].
        permisos: lista de nombres de permisos del rol.
        es_admin: bool.

    Returns:
        dict con 'respuesta' (Markdown) y 'modulos_consultados' (list), o 'error'.
    """
    api_key = current_app.config.get('ANTHROPIC_API_KEY')
    if not api_key:
        return {'error': 'El asistente no está configurado (falta ANTHROPIC_API_KEY).'}

    permitidos = H.modulos_permitidos(permisos, es_admin)
    if not permitidos:
        return {'error': 'Tu rol no tiene permiso para consultar ningún módulo con el asistente.'}

    tools = H.herramientas_permitidas(permisos, es_admin)
    system = _system_prompt(permitidos, H.modulos_denegados(permisos, es_admin))

    # Construir historial de mensajes (solo texto de turnos anteriores)
    mensajes = []
    for m in (historial or [])[-10:]:
        if m.get('role') in ('user', 'assistant') and m.get('content'):
            mensajes.append({'role': m['role'], 'content': m['content']})
    mensajes.append({'role': 'user', 'content': pregunta})

    try:
        import anthropic
    except ImportError:
        return {'error': 'El paquete anthropic no está instalado en el servidor.'}

    client = anthropic.Anthropic(api_key=api_key)
    modelo = current_app.config.get('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001')
    modulos_consultados = set()

    try:
        for _ in range(MAX_ITERACIONES):
            respuesta = client.messages.create(
                model=modelo, max_tokens=MAX_TOKENS, system=system,
                tools=tools, messages=mensajes,
            )

            if respuesta.stop_reason == 'tool_use':
                # Agregar el turno del asistente (con los bloques tool_use) al historial
                mensajes.append({'role': 'assistant', 'content': respuesta.content})
                resultados = []
                for bloque in respuesta.content:
                    if getattr(bloque, 'type', None) != 'tool_use':
                        continue
                    h = H._POR_NOMBRE.get(bloque.name)
                    if h:
                        modulos_consultados.add(h['modulo'])
                    salida = H.ejecutar(bloque.name, bloque.input, permisos, es_admin)
                    resultados.append({
                        'type': 'tool_result',
                        'tool_use_id': bloque.id,
                        'content': json.dumps(salida, ensure_ascii=False),
                    })
                mensajes.append({'role': 'user', 'content': resultados})
                continue

            # Respuesta final de texto
            texto = _texto_de(respuesta)
            return {
                'respuesta': texto or 'No pude generar una respuesta. Reformulá tu pregunta.',
                'modulos_consultados': sorted(modulos_consultados),
            }

        return {
            'respuesta': 'La consulta resultó demasiado compleja. Probá dividirla en partes '
                         'más simples.',
            'modulos_consultados': sorted(modulos_consultados),
        }
    except Exception as exc:  # noqa: BLE001
        current_app.logger.warning(f'Error en el agente del chatbot: {exc}')
        return {'error': 'No se pudo procesar la consulta. Intentá nuevamente.'}
