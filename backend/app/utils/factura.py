"""Generación automática de factura PDF para cualquier método de pago (CU42)."""
import os
import uuid
from datetime import date


def generar_y_guardar_factura(pago, id_usuario_registro, upload_folder):
    """Genera el PDF de factura y crea el registro Documento en la BD.

    Se llama desde dentro del contexto de request, por lo que no necesita
    crear un app_context propio.
    """
    from ..extensions import db
    from ..models.proyectos.proyecto import Proyecto
    from ..models.entidades.entidad import Entidad
    from ..models.bitacoras.bitacora_doc import Documento
    from ..models.catalogo.catalogo import TipoDocumento

    proyecto = db.session.get(Proyecto, pago.id_proyecto)
    if not proyecto:
        return None

    cliente = db.session.get(Entidad, proyecto.id_entidad) if proyecto.id_entidad else None

    # Obtener o crear tipo de documento "Factura"
    tipo = TipoDocumento.query.filter_by(nombre='Factura').first()
    if not tipo:
        tipo = TipoDocumento(
            nombre='Factura',
            descripcion='Factura de pago generada automaticamente por el sistema',
        )
        db.session.add(tipo)
        db.session.flush()

    # Generar el archivo PDF
    nombre_archivo = _generar_pdf(pago, proyecto, cliente, upload_folder)

    # Número de factura legible
    numero = f"FAC-{pago.id:05d}"

    doc = Documento(
        id_proyecto=pago.id_proyecto,
        id_usuario=id_usuario_registro,
        id_tipo_documento=tipo.id,
        nombre=f"Factura {numero} - {proyecto.codigo}",
        ruta=nombre_archivo,
        descripcion=f"Pago {pago.metodo} | {pago.tipo_pago}",
    )
    db.session.add(doc)
    db.session.commit()
    return doc


def _generar_pdf(pago, proyecto, cliente, upload_folder):
    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_margins(15, 15, 15)

    # ── Encabezado ──────────────────────────────────────────────────
    pdf.set_font('Helvetica', 'B', 22)
    pdf.set_text_color(30, 64, 175)
    pdf.cell(0, 12, 'SERVICONTROL', ln=True, align='C')

    pdf.set_font('Helvetica', 'B', 13)
    pdf.set_text_color(50, 50, 50)
    pdf.cell(0, 8, 'FACTURA DE PAGO', ln=True, align='C')

    pdf.ln(2)
    pdf.set_draw_color(180, 180, 180)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(6)

    # ── Numero y fecha ──────────────────────────────────────────────
    numero = f"FAC-{pago.id:05d}"
    fecha_str = pago.fecha_pago.strftime('%d/%m/%Y') if pago.fecha_pago else '---'

    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(90, 6, f"No. de Factura: {numero}")
    pdf.cell(90, 6, f"Fecha: {fecha_str}", ln=True)
    pdf.ln(8)

    # ── Datos del proyecto ──────────────────────────────────────────
    pdf.set_fill_color(239, 246, 255)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(0, 8, '  Proyecto', ln=True, fill=True)

    pdf.set_font('Helvetica', '', 10)
    pdf.set_x(20)
    pdf.cell(35, 7, 'Codigo:')
    pdf.cell(0, 7, proyecto.codigo or '---', ln=True)

    pdf.set_x(20)
    pdf.cell(35, 7, 'Nombre:')
    nombre_proy = _safe(proyecto.titulo)
    pdf.cell(0, 7, nombre_proy, ln=True)

    if cliente:
        pdf.set_x(20)
        pdf.cell(35, 7, 'Cliente:')
        pdf.cell(0, 7, _safe(cliente.nombre), ln=True)

    pdf.ln(8)

    # ── Tabla de detalle ────────────────────────────────────────────
    tipo_labels = {
        'anticipo': 'Anticipo',
        'pago_parcial': 'Pago Parcial',
        'pago_final': 'Pago Final',
        'otro': 'Otro',
    }
    metodo_labels = {
        'efectivo': 'Efectivo',
        'transferencia': 'Transferencia',
        'QR': 'QR',
        'stripe': 'Stripe',
        'otro': 'Otro',
    }
    tipo_str   = tipo_labels.get(pago.tipo_pago, pago.tipo_pago)
    metodo_str = metodo_labels.get(pago.metodo, pago.metodo)
    monto_str  = f"Bs {float(pago.monto):.2f}"

    col = [100, 40, 40]   # widths: concepto, metodo, monto

    # Header de tabla
    pdf.set_fill_color(30, 64, 175)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(col[0], 9, '  Concepto', border=0, fill=True)
    pdf.cell(col[1], 9, 'Metodo', border=0, fill=True, align='C')
    pdf.cell(col[2], 9, 'Monto', border=0, fill=True, align='R', ln=True)

    # Fila de datos
    pdf.set_fill_color(248, 250, 252)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(col[0], 9, f"  {tipo_str}", border='B', fill=True)
    pdf.cell(col[1], 9, metodo_str, border='B', fill=True, align='C')
    pdf.cell(col[2], 9, monto_str, border='B', fill=True, align='R', ln=True)

    # Fila de total
    pdf.set_fill_color(239, 246, 255)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(col[0] + col[1], 10, '  TOTAL', border=0, fill=True)
    pdf.cell(col[2], 10, monto_str, border=0, fill=True, align='R', ln=True)

    pdf.ln(8)

    # ── Referencia y observacion ────────────────────────────────────
    pdf.set_font('Helvetica', '', 8)
    pdf.set_text_color(100, 100, 100)
    if getattr(pago, 'stripe_payment_intent_id', None):
        pdf.cell(0, 5, f"Referencia Stripe: {pago.stripe_payment_intent_id}", ln=True)
    if pago.observacion:
        pdf.cell(0, 5, f"Observacion: {_safe(pago.observacion)}", ln=True)

    # ── Pie de pagina ───────────────────────────────────────────────
    pdf.ln(12)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(4)
    pdf.set_font('Helvetica', 'I', 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 5, 'Documento generado automaticamente por ServiControl', ln=True, align='C')
    pdf.cell(0, 5, f"Generado el {date.today().strftime('%d/%m/%Y')}", ln=True, align='C')

    # ── Guardar ─────────────────────────────────────────────────────
    nombre_archivo = f"{uuid.uuid4().hex}_factura_{pago.id}.pdf"
    os.makedirs(upload_folder, exist_ok=True)
    pdf.output(os.path.join(upload_folder, nombre_archivo))
    return nombre_archivo


def _safe(texto):
    """Reemplaza caracteres fuera de Latin-1 para compatibilidad con fuentes core de FPDF."""
    if not texto:
        return ''
    reemplazos = {
        '–': '-', '—': '-', '‘': "'", '’': "'",
        '“': '"', '”': '"', '…': '...',
    }
    for k, v in reemplazos.items():
        texto = texto.replace(k, v)
    try:
        texto.encode('latin-1')
        return texto
    except UnicodeEncodeError:
        return texto.encode('latin-1', errors='replace').decode('latin-1')
