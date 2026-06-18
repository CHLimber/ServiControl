# Datos estructurados para Diagramas de Comunicación UML — ServiControl

## Contexto

Extracción de datos de rutas Flask, modelos SQLAlchemy y API frontend para 21 casos de uso de ServiControl. El usuario los usará para construir diagramas de comunicación UML en herramienta externa (no se genera PlantUML). Convención de colores: Negro=flujo principal, Rojo=error/validación fallida, Azul=escritura entidad principal, Naranja=escritura entidad secundaria, Verde=eliminación/desactivación, Negro final=Confirmacion().

---

### CU01 — Iniciar Sesión

**Actores:** Administrador, Técnico Superior, Atención Cliente, Técnico de Campo
**Actor iniciador:** Cualquier usuario del sistema
**Tipo de CU:** Escritura (actualiza intentos, bloqueo, ultimo_acceso en Usuario)

**Entidades involucradas:**

- Entidad principal: Usuario
- Entidad secundaria: Bitacora (log transversal)

**Mensajes del diagrama:**

1. Actor → Vista: ingresarCredenciales(username, password)
2. Vista → Control: POST /auth/login
3. Control → Usuario: buscarPorUsername(username, estado=True)
4. Control → Vista: [Rojo] usuarioInexistente() → 401
5. Control → Vista: [Rojo] cuentaBloqueada(bloqueado_hasta) → 423
6. Control → Usuario: verificarPassword(hash)
7. Control → Vista: [Rojo] credencialesInvalidas(intentosRestantes) → 401
8. Control → Usuario: [Azul] actualizarAcceso(ultimo_acceso, resetear_intentos)
9. Control → Vista: Confirmacion(access_token, refresh_token, usuario) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo #1: usuario no existe → log LOGIN_FALLIDO → 401 "Credenciales inválidas"
- Rojo #2: `bloqueado_hasta > now()` → log LOGIN_BLOQUEADO → 423 con tiempo restante
- Rojo #3: password incorrecto, intentos < máximo → incrementa `intentos_fallidos`, envía email `notificar_intento_fallido` → 401 con intentos_restantes
- Rojo #4: password incorrecto, alcanza máximo → calcula bloqueo escalado, setea `bloqueado_hasta`, envía email `notificar_cuenta_bloqueada` → 423

**Notas especiales:** El endpoint es público (sin JWT). La progresión de bloqueo es escalada: después de cada bloqueo, el tiempo aumenta según `LOGIN_TIEMPOS_BLOQUEO`. El log se registra incluso en intentos fallidos con usuario inexistente.

---

### CU02 — Cerrar Sesión

**Actores:** Cualquier usuario autenticado
**Actor iniciador:** Usuario autenticado
**Tipo de CU:** Escritura (actualiza ultima_salida)

**Entidades involucradas:**

- Entidad principal: Usuario
- Entidad secundaria: Bitacora (log transversal)

**Mensajes del diagrama:**

1. Actor → Vista: cerrarSesion()
2. Vista → Control: POST /auth/logout [JWT en header]
3. Control → Vista: [Rojo] tokenInvalido() → 401
4. Control → Usuario: [Azul] actualizarUltimaSalida(now())
5. Control → Bitacora: [Naranja] registrarEvento(LOGOUT)
6. Control → Vista: Confirmacion('Sesión cerrada') → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: JWT inválido o expirado → manejado por Flask-JWT-Extended → 401

**Notas especiales:** El frontend elimina los tokens de localStorage al recibir la confirmación, independientemente de la respuesta del servidor.

---

### CU03 — Gestionar Usuarios

**Actores:** Administrador
**Actor iniciador:** Administrador
**Tipo de CU:** Mixto (consulta + escritura)

**Entidades involucradas:**

- Entidad principal: Usuario
- Entidad secundaria: Rol, Empleado

**Mensajes del diagrama:**

1. Actor → Vista: abrirGestionUsuarios()
2. Vista → Control: GET /usuarios/
3. Control → Usuario: obtenerTodos()
4. Control → Vista: Confirmacion(listaUsuarios) → 200
5. Actor → Vista: crearUsuario(username, password, id_rol, id_empleado)
6. Vista → Control: POST /usuarios/
7. Control → Vista: [Rojo] campoObligatorioFaltante() → 400
8. Control → Vista: [Rojo] usernameOEmpleadoDuplicado() → 409
9. Control → Rol: verificarExistencia(id_rol)
10. Control → Vista: [Rojo] rolInexistente() → 400
11. Control → Empleado: verificarEmpleadoActivo(id_empleado)
12. Control → Vista: [Rojo] empleadoInvalidoOConUsuario() → 400/409
13. Control → Usuario: [Azul] insertarUsuario(datos_hasheados)
14. Control → Bitacora: [Naranja] registrarEvento(CREAR_USUARIO)
15. Control → Vista: Confirmacion(usuarioCreado) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: campos `username`, `password`, `id_rol`, `id_empleado` faltantes → 400
- Rojo: `username` ya existe → 409
- Rojo: `id_rol` no existe → 400
- Rojo: `id_empleado` inactivo o ya tiene usuario activo → 400/409
- Rojo: `password` < 6 caracteres → 400
- Verde (PATCH /estado): alterna `estado=not estado` → log ACTIVAR/DESACTIVAR_USUARIO
- Verde (PATCH /desbloquear): resetea intentos y bloqueo → envía email desbloqueado

**Notas especiales:** Incluye también `PATCH /usuarios/{id}/estado` y `PATCH /usuarios/{id}/desbloquear` como flujos secundarios del mismo CU. El PATCH /estado tiene validación adicional: el usuario no puede desactivar su propia cuenta (→ 400).

---

### CU05 — Gestionar Entidad

**Actores:** Usuario con permisos ver_clientes / crear_clientes / editar_clientes
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Mixto (consulta + escritura)

**Entidades involucradas:**

- Entidad principal: Entidad
- Entidad secundaria: EntidadNatural o EntidadJuridica, Telefono, telefono_entidad

**Mensajes del diagrama:**

1. Actor → Vista: abrirGestionEntidades()
2. Vista → Control: GET /entidades/
3. Control → Entidad: obtenerActivas(estado=True)
4. Control → Vista: Confirmacion(listaEntidades) → 200
5. Actor → Vista: editarEntidad(id, datos)
6. Vista → Control: PUT /entidades/{id}
7. Control → Vista: [Rojo] entidadNoEncontrada() → 404
8. Control → Vista: [Rojo] ciONitDuplicado() → 409
9. Control → Entidad: [Azul] actualizarDatos()
10. Control → EntidadNatural/EntidadJuridica: [Naranja] actualizarSubtabla()
11. Control → Telefono/telefono_entidad: [Naranja] reemplazarTelefonos()
12. Control → Vista: Confirmacion(entidadActualizada) → 200
13. Actor → Vista: desactivarEntidad(id)
14. Vista → Control: DELETE /entidades/{id}
15. Control → Entidad: [Verde] softDelete(estado=False)
16. Control → Vista: Confirmacion('Entidad desactivada') → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: CI o NIT ya pertenece a otra entidad → 409
- Rojo: entidad no encontrada → 404 automático (get_or_404)

**Notas especiales:** include → CU06 (Registrar Persona Natural) y CU07 (Registrar Persona Jurídica). El DELETE es soft-delete (estado=False), no eliminación física. Los teléfonos se gestionan reemplazando todos al actualizar (`_set_telefonos_entidad`).

---

### CU06 — Registrar Persona Natural

**Actores:** Usuario con permiso crear_clientes
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: Entidad
- Entidad secundaria: EntidadNatural, Telefono, telefono_entidad

**Mensajes del diagrama:**

1. Actor → Vista: registrarPersonaNatural(nombre, ci, datos...)
2. Vista → Control: POST /entidades/ {tipo: 'natural'}
3. Control → Vista: [Rojo] tipoInvalido() → 400
4. Control → Vista: [Rojo] camposObligatoriosFaltantes(nombre, ci) → 400
5. Control → EntidadNatural: verificarCI(ci)
6. Control → Vista: [Rojo] ciDuplicado() → 409
7. Control → Entidad: [Azul] insertarEntidad(tipo='natural', flush)
8. Control → EntidadNatural: [Naranja] insertarSubtabla(id_entidad, ci)
9. Control → Telefono: [Naranja] insertarTelefonos() (si se proveen)
10. Control → Bitacora: [Naranja] registrarEvento(CREAR_ENTIDAD)
11. Control → Vista: Confirmacion(entidadCreada) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `nombre` o `ci` faltantes → 400
- Rojo: `ci` ya existe en EntidadNatural → 409
- Naranja: teléfonos son opcionales, se insertan en tabla pivote `telefono_entidad`

**Notas especiales:** Usa `db.session.flush()` después de crear `Entidad` para obtener el `id` antes de crear `EntidadNatural`. Esto es dentro de una sola transacción con `commit()` al final.

---

### CU07 — Registrar Persona Jurídica

**Actores:** Usuario con permiso crear_clientes
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: Entidad
- Entidad secundaria: EntidadJuridica, Telefono, telefono_entidad

**Mensajes del diagrama:**

1. Actor → Vista: registrarPersonaJuridica(razon_social, nit, datos...)
2. Vista → Control: POST /entidades/ {tipo: 'juridica'}
3. Control → Vista: [Rojo] tipoInvalido() → 400
4. Control → Vista: [Rojo] razonSocialFaltante() → 400
5. Control → EntidadJuridica: verificarNIT(nit)
6. Control → Vista: [Rojo] nitDuplicado() → 409
7. Control → Entidad: [Azul] insertarEntidad(tipo='juridica', flush)
8. Control → EntidadJuridica: [Naranja] insertarSubtabla(id_entidad, nit, razon_social)
9. Control → Telefono: [Naranja] insertarTelefonos() (si se proveen)
10. Control → Bitacora: [Naranja] registrarEvento(CREAR_ENTIDAD)
11. Control → Vista: Confirmacion(entidadCreada) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `razon_social` faltante → 400
- Rojo: `nit` ya existe en EntidadJuridica → 409 (solo si se provee NIT)

**Notas especiales:** El `nit` es opcional en persona jurídica (solo se valida unicidad si viene en el payload). `nombre_comercial` también es opcional.

---

### CU09 — Gestionar Establecimiento y Sistema

**Actores:** Usuario con permiso crear_clientes / editar_clientes
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: Sistema
- Entidad secundaria: Establecimiento (creado automáticamente si no existe para la entidad)

**Mensajes del diagrama:**

1. Actor → Vista: agregarSistema(id_entidad, id_tipo_sistema, nombre)
2. Vista → Control: POST /entidades/{id}/sistemas
3. Control → Vista: [Rojo] camposObligatoriosFaltantes() → 400
4. Control → Establecimiento: verificarEstablecimientoActivo(id_entidad)
5. Control → Vista: [Rojo] sinDireccionParaEstablecimientoNuevo() → 400
6. Control → Establecimiento: [Naranja] crearEstablecimientoAutomatico() (si no existe)
7. Control → Sistema: [Azul] insertarSistema(id_establecimiento)
8. Control → Bitacora: [Naranja] registrarEvento(CREAR_SISTEMA)
9. Control → Vista: Confirmacion(sistemaCreado) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `id_tipo_sistema` o `nombre` faltantes → 400
- Rojo: no hay establecimiento activo Y tampoco se provee `direccion` → 400
- Naranja: si no hay establecimiento activo para la entidad, se crea uno automáticamente con la `direccion` provista

**Notas especiales:** La lógica de creación automática de Establecimiento es una invariante de negocio importante: todo Sistema debe pertenecer a un Establecimiento, y si la entidad no tiene uno activo, se crea en la misma transacción.

---

### CU12 — Gestionar Catálogo de Productos

**Actores:** Usuario con permiso gestionar_catalogo
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Mixto (consulta + escritura)

**Entidades involucradas:**

- Entidad principal: Producto
- Entidad secundaria: Categoria (solo lectura para validación)

**Mensajes del diagrama:**

1. Actor → Vista: abrirCatalogoProductos()
2. Vista → Control: GET /productos/
3. Control → Producto: obtenerActivos(estado=True)
4. Control → Vista: Confirmacion(listaProductos) → 200
5. Actor → Vista: crearProducto(codigo, nombre, unidad_medida, id_categoria)
6. Vista → Control: POST /productos/
7. Control → Vista: [Rojo] camposObligatoriosFaltantes() → 400
8. Control → Producto: verificarCodigoUnico(codigo)
9. Control → Vista: [Rojo] codigoDuplicado() → 409
10. Control → Categoria: verificarCategoriaActiva(id_categoria)
11. Control → Vista: [Rojo] categoriaInvalidaOInactiva() → 400
12. Control → Producto: [Azul] insertarProducto(codigo.upper())
13. Control → Bitacora: [Naranja] registrarEvento(CREAR_PRODUCTO)
14. Control → Vista: Confirmacion(productoCreado) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `codigo`, `nombre`, `unidad_medida`, `id_categoria` faltantes → 400
- Rojo: `codigo` ya existe → 409
- Rojo: `id_categoria` inexistente o inactiva → 400
- Verde (DELETE): soft-delete `estado=False` → log DESACTIVAR_PRODUCTO

**Notas especiales:** El código se normaliza automáticamente a `.strip().upper()` antes de guardar. El PUT acepta payload parcial (solo campos presentes se actualizan).

---

### CU15 — Elaborar Cotización

**Actores:** Usuario con permiso crear_cotizaciones
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: Cotizacion
- Entidad secundaria: CotizacionDetalle

**Mensajes del diagrama:**

1. Actor → Vista: elaborarCotizacion(id_entidad, id_servicio, id_sistema, detalles[], mano_de_obra, vigencia_dias)
2. Vista → Control: POST /cotizaciones/
3. Control → Vista: [Rojo] camposObligatoriosFaltantes() → 400
4. Control → Vista: [Rojo] listaDetallesVacia() → 400
5. Control → Vista: [Rojo] detalleConDatosInvalidos(cantidad, precio) → 400
6. Control → Cotizacion: [Azul] calcularSubtotal() + generarCodigo('COT-YYYYMM-XXXX') + insertar(flush)
7. Control → CotizacionDetalle: [Naranja] insertarDetallesEnBucle(id_cotizacion)
8. Control → Bitacora: [Naranja] registrarEvento(CREAR_COTIZACION)
9. Control → Vista: Confirmacion(cotizacionConDetalles) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `id_entidad`, `id_servicio`, `id_sistema`, `detalles` faltantes → 400
- Rojo: `detalles` es lista vacía → 400
- Rojo: algún detalle sin `id_producto`, `id_proveedor`, `cantidad` o `precio_unitario` → 400
- Rojo: `cantidad` o `precio_unitario` no numéricos → 400

**Notas especiales:** Usa `db.session.flush()` en Cotizacion para obtener el ID antes de insertar los CotizacionDetalle. El código se genera consultando el último secuencial del mes. El subtotal se calcula sumando `cantidad × precio` de cada detalle.

---

### CU16 — Agregar Detalle de Cotización

**Actores:** Usuario con permiso crear_cotizaciones
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: CotizacionDetalle
- Entidad secundaria: Cotizacion (actualiza subtotal_productos)

**Mensajes del diagrama:**

1. Actor → Vista: actualizarDetalles(id_cotizacion, nuevosDetalles[])
2. Vista → Control: PUT /cotizaciones/{id}/detalles
3. Control → Cotizacion: verificarExistencia(id)
4. Control → Vista: [Rojo] cotizacionNoEncontrada() → 404
5. Control → Vista: [Rojo] cotizacionNoEnBorrador() → 400
6. Control → Vista: [Rojo] listaDetallesVaciaOInvalida() → 400
7. Control → CotizacionDetalle: [Verde] eliminarTodosLosDetalles(DELETE masivo)
8. Control → CotizacionDetalle: [Naranja] insertarNuevosDetallesEnBucle()
9. Control → Cotizacion: [Azul] recalcularSubtotalProductos()
10. Control → Bitacora: [Naranja] registrarEvento(ACTUALIZAR_DETALLES_COTIZACION)
11. Control → Vista: Confirmacion(cotizacionActualizada) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: cotización no existe → 404
- Rojo: cotización no está en estado 'borrador' → 400 "Solo se pueden editar cotizaciones en borrador"
- Rojo: lista vacía o detalle sin campos requeridos → 400

**Notas especiales:** Esta operación hace REEMPLAZO TOTAL de los detalles (DELETE masivo de los anteriores + INSERT de los nuevos). No es un update incremental. Solo funciona sobre cotizaciones en estado 'borrador'.

---

### CU17 — Cambiar Estado de Cotización

**Actores:** Usuario con permiso crear_cotizaciones
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: Cotizacion
- Entidad secundaria: ninguna

**Mensajes del diagrama:**

1. Actor → Vista: cambiarEstado(id_cotizacion, nuevo_estado)
2. Vista → Control: POST /cotizaciones/{id}/cambiar-estado
3. Control → Cotizacion: verificarExistencia(id)
4. Control → Vista: [Rojo] cotizacionNoEncontrada() → 404
5. Control → Vista: [Rojo] estadoInvalido(nuevo_estado) → 400
6. Control → Cotizacion: [Azul] actualizarEstado(nuevo_estado)
7. Control → Bitacora: [Naranja] registrarEvento(CAMBIAR_ESTADO_COTIZACION)
8. Control → Vista: Confirmacion(cotizacionActualizada) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `nuevo_estado` no está en ('borrador','enviada','aprobada','rechazada','vencida','convertida') → 400
- Rojo: cotización no encontrada → 404

**Notas especiales:** Este endpoint no valida transiciones de estado (cualquier estado puede ir a cualquier otro). La validación de flujo de negocio (ej. solo 'aprobada' puede convertirse) se aplica en el endpoint de convertir, no aquí.

---

### CU18 — Convertir Cotización en Proyecto

**Actores:** Usuario con permiso crear_proyectos
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: Proyecto
- Entidad secundaria: ProyectoHistorial, Cotizacion (actualiza estado a 'convertida'), EstadoProyecto (consulta), Sistema (consulta)

**Mensajes del diagrama:**

1. Actor → Vista: convertirEnProyecto(id_cotizacion, titulo, descripcion, fecha_inicio, fecha_fin)
2. Vista → Control: POST /cotizaciones/{id}/convertir-proyecto
3. Control → Cotizacion: verificarExistencia(id)
4. Control → Vista: [Rojo] cotizacionNoEncontrada() → 404
5. Control → Vista: [Rojo] estadoNoAprobada() → 400
6. Control → EstadoProyecto: obtenerPrimerEstado(order_by=orden)
7. Control → Vista: [Rojo] sinEstadosConfigurados() → 500
8. Control → Sistema: verificarEstablecimiento(id_sistema)
9. Control → Vista: [Rojo] sistemaSinEstablecimiento() → 400
10. Control → Proyecto: [Azul] generarCodigo('PROY-YYYYMM-XXXX') + insertar(flush)
11. Control → ProyectoHistorial: [Naranja] insertarHistorial(estado_anterior=null, observacion='Creado desde COT-XXXX')
12. Control → Cotizacion: [Naranja] actualizarEstado('convertida')
13. Control → Bitacora: [Naranja] registrarEvento(CONVERTIR_COTIZACION)
14. Control → Vista: Confirmacion(id, codigo, titulo, id_cotizacion, estado_nombre) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: cotización no existe → 404
- Rojo: cotización no está en estado 'aprobada' → 400
- Rojo: no hay EstadoProyecto configurados → 500
- Rojo: Sistema no tiene Establecimiento asignado → 400

**Notas especiales:** En una sola transacción: INSERT Proyecto (flush), INSERT ProyectoHistorial con estado_anterior=null, UPDATE Cotizacion.estado='convertida', COMMIT. Esta es la operación más compleja del módulo de cotizaciones.

---

### CU19 — Apertura Manual de Proyecto

**Actores:** Usuario con permiso crear_proyectos
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: Proyecto
- Entidad secundaria: ProyectoHistorial, Sistema (consulta)

**Mensajes del diagrama:**

1. Actor → Vista: abrirProyecto(id_entidad, id_servicio, id_sistema, titulo, id_estado_proyecto)
2. Vista → Control: POST /proyectos/
3. Control → Vista: [Rojo] camposObligatoriosFaltantes() → 400
4. Control → Sistema: obtenerEstablecimiento(id_sistema)
5. Control → Proyecto: [Azul] generarCodigo('PROY-YYYYMM-XXXX') + insertar(flush)
6. Control → ProyectoHistorial: [Naranja] insertarHistorial(estado_anterior=null, observacion='Proyecto creado')
7. Control → Bitacora: [Naranja] registrarEvento(CREAR_PROYECTO)
8. Control → Vista: Confirmacion(proyectoConHistorial) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `id_entidad`, `id_servicio`, `id_sistema`, `titulo`, `id_estado_proyecto` faltantes → 400
- Rojo: Sistema no encontrado → 404

**Notas especiales:** A diferencia de CU18, aquí no hay cotización asociada (`id_cotizacion = null`). El `id_establecimiento` se obtiene automáticamente del Sistema si no viene en el body.

---

### CU20 — Actualizar Estado de Proyecto

**Actores:** Usuario con permiso editar_proyectos
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: Proyecto
- Entidad secundaria: ProyectoHistorial (INSERT condicional si cambia el estado)

**Mensajes del diagrama:**

1. Actor → Vista: actualizarProyecto(id, datos...)
2. Vista → Control: PUT /proyectos/{id}
3. Control → Proyecto: verificarExistencia(id)
4. Control → Vista: [Rojo] proyectoNoEncontrado() → 404
5. Control → Proyecto: capturarEstadoAnterior(id_estado_proyecto)
6. Control → Proyecto: [Azul] actualizarCampos(titulo, descripcion, fechas, id_estado_proyecto)
7. Control → ProyectoHistorial: [Naranja] insertarHistorial(estado_anterior, estado_nuevo) (SOLO si estado cambia)
8. Control → Bitacora: [Naranja] registrarEvento(ACTUALIZAR_PROYECTO, lista_cambios)
9. Control → Vista: Confirmacion(proyectoConHistorial) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: proyecto no encontrado → 404
- Naranja condicional: ProyectoHistorial solo se inserta si `id_estado_proyecto` efectivamente cambia de valor

**Notas especiales:** El PUT acepta payload parcial. La bitácora registra solo los campos que realmente cambiaron. El historial del estado (ProyectoHistorial) es el mecanismo de auditoría de estado; no confundir con Bitacora (auditoría general del sistema).

---

### CU22 — Generar Orden de Trabajo

**Actores:** Usuario con permiso crear_ordenes
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: OrdenTrabajo
- Entidad secundaria: OrdenEmpleado, OrdenProducto, OrdenHistorial

**Mensajes del diagrama:**

1. Actor → Vista: generarOrden(id_proyecto, id_servicio, id_estado_orden, empleados[], productos[])
2. Vista → Control: POST /ordenes/
3. Control → Vista: [Rojo] campoRequeridoFaltante() → 400
4. Control → OrdenTrabajo: [Azul] generarCodigo('OT-YYYYMM-NNNN') + insertar(flush)
5. Control → OrdenEmpleado: [Naranja] insertarEmpleadosEnBucle(empleados[])
6. Control → OrdenProducto: [Naranja] insertarProductosEnBucle(productos[])
7. Control → OrdenHistorial: [Naranja] insertarHistorial(estado_anterior=null, observacion='Orden creada')
8. Control → Bitacora: [Naranja] registrarEvento(CREAR_ORDEN)
9. Control → Vista: Confirmacion(ordenConDetalle) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `id_proyecto`, `id_servicio`, `id_estado_orden` faltantes → 400
- Naranja: `empleados[]` y `productos[]` son opcionales; si vacíos, sus tablas pivote no se tocan

**Notas especiales:** Usa `db.session.flush()` en OrdenTrabajo para obtener ID antes de insertar en OrdenEmpleado, OrdenProducto y OrdenHistorial. Los tres inserts secundarios ocurren en la misma transacción.

---

### CU23 — Asignar Personal a OT

**Actores:** Usuario con permiso editar_ordenes
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: OrdenEmpleado
- Entidad secundaria: OrdenTrabajo (solo lectura)

**Mensajes del diagrama:**

1. Actor → Vista: asignarEmpleados(id_orden, empleados[])
2. Vista → Control: PUT /ordenes/{id}/empleados
3. Control → OrdenTrabajo: verificarExistencia(id)
4. Control → Vista: [Rojo] ordenNoEncontrada() → 404
5. Control → OrdenEmpleado: [Verde] eliminarTodosLosEmpleados(DELETE filter_by id_orden)
6. Control → OrdenEmpleado: [Naranja] insertarNuevosEmpleados(empleados[])
7. Control → Bitacora: [Naranja] registrarEvento(ACTUALIZAR_EMPLEADOS_OT)
8. Control → Vista: Confirmacion(ordenActualizada) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: orden no encontrada → 404
- Verde: DELETE masivo de todos los registros anteriores de OrdenEmpleado (siempre ocurre antes del INSERT)

**Notas especiales:** Reemplazo total (DELETE + INSERT), no merge. Si `empleados[]` viene vacío, la orden queda sin personal asignado.

---

### CU24 — Asignar Materiales a OT

**Actores:** Usuario con permiso editar_ordenes
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: OrdenProducto
- Entidad secundaria: OrdenTrabajo (solo lectura)

**Mensajes del diagrama:**

1. Actor → Vista: asignarMateriales(id_orden, productos[])
2. Vista → Control: PUT /ordenes/{id}/materiales
3. Control → OrdenTrabajo: verificarExistencia(id)
4. Control → Vista: [Rojo] ordenNoEncontrada() → 404
5. Control → OrdenProducto: leerConsumosPrevios(cantidad_usada, observacion)
6. Control → OrdenProducto: [Verde] eliminarTodosLosMateriales(DELETE filter_by id_orden)
7. Control → OrdenProducto: [Naranja] insertarNuevosMateriales(preservando_consumo_previo)
8. Control → Bitacora: [Naranja] registrarEvento(ACTUALIZAR_MATERIALES_OT)
9. Control → Vista: Confirmacion(ordenActualizada) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: orden no encontrada → 404
- Verde: DELETE masivo previo siempre ocurre
- Naranja especial: antes del DELETE se guarda en memoria el `cantidad_usada` y `observacion` de cada producto para restaurarlo en el nuevo INSERT

**Notas especiales:** Lógica de preservación de consumo: si un producto ya tenía `cantidad_usada` registrada, ese valor se restaura al re-insertar el registro. Esto evita perder datos de consumo real al reasignar materiales.

---

### CU31 — Programar Mantenimiento Preventivo

**Actores:** Usuario con permiso gestionar_mantenimientos
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: Mantenimiento
- Entidad secundaria: AlertaMantenimiento (opcional, por POST separado)

**Mensajes del diagrama:**

1. Actor → Vista: programarMantenimiento(id_sistema, tipo, fecha_programada, periodicidad_dias)
2. Vista → Control: POST /mantenimiento/
3. Control → Vista: [Rojo] camposObligatoriosFaltantes() → 400
4. Control → Vista: [Rojo] tipoInvalido(tipo) → 400
5. Control → Mantenimiento: [Azul] insertarMantenimiento(tipo='preventivo', creado_automaticamente=False)
6. Control → Bitacora: [Naranja] registrarEvento(CREAR_MANTENIMIENTO)
7. Control → Vista: Confirmacion(mantenimientoCreado) → 201
8. [Opcional] Actor → Vista: crearAlerta(id_mantenimiento, id_establecimiento)
9. [Opcional] Vista → Control: POST /mantenimiento/alertas
10. [Opcional] Control → AlertaMantenimiento: [Naranja] insertarAlerta()
11. [Opcional] Control → Vista: Confirmacion(alertaCreada) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `id_sistema`, `tipo`, `fecha_programada` faltantes → 400
- Rojo: `tipo` no está en ('preventivo', 'correctivo') → 400
- Naranja opcional: La alerta se crea en un request separado (POST /mantenimiento/alertas)

**Notas especiales:** El campo `creado_automaticamente=False` distingue mantenimientos programados manualmente de los generados por el sistema. Los estados válidos son: pendiente, confirmado, reprogramado, completado, vencido.

---

### CU33 — Visualizar Centro de Notificaciones

**Actores:** Cualquier usuario autenticado
**Actor iniciador:** Usuario autenticado
**Tipo de CU:** Mixto (consulta + escritura al marcar leídas)

**Entidades involucradas:**

- Entidad principal: Notificacion
- Entidad secundaria: ninguna

**Mensajes del diagrama:**

1. Actor → Vista: abrirCentroNotificaciones()
2. Vista → Control: GET /notificaciones/no-leidas
3. Control → Notificacion: obtenerNoLeidas(id_usuario, leida=False)
4. Control → Vista: Confirmacion(listaNoLeidas) → 200
5. Actor → Vista: marcarTodasLeidas()
6. Vista → Control: PUT /notificaciones/leer-todas
7. Control → Notificacion: [Azul] actualizarMasivoLeida(True) donde id_usuario y leida=False
8. Control → Bitacora: [Naranja] registrarEvento(NOTIFICACIONES_LEER_TODAS) (solo si cantidad > 0)
9. Control → Vista: Confirmacion('Todas las notificaciones marcadas como leídas') → 200
10. Actor → Vista: marcarUnaLeida(id)
11. Vista → Control: PUT /notificaciones/{id}/leer
12. Control → Notificacion: verificarPropietario(id_usuario del token)
13. Control → Vista: [Rojo] noEsPropietario() → 403
14. Control → Notificacion: [Azul] actualizarLeida(True)
15. Control → Vista: Confirmacion('Notificación marcada como leída') → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: intentar marcar leída una notificación de otro usuario → 403
- Rojo: notificación no encontrada → 404
- Verde (DELETE /notificaciones/{id}): elimina físicamente la notificación (también verifica propiedad → 403)

**Notas especiales:** Las notificaciones son por usuario (filtradas por `id_usuario` del JWT). No hay endpoint para crear notificaciones desde el frontend; se crean internamente desde otros módulos. El log de "leer todas" solo se registra si realmente había notificaciones no leídas (cantidad > 0).

---

### CU34 — Consultar Auditoría del Sistema

**Actores:** Administrador (permiso gestionar_usuarios)
**Actor iniciador:** Administrador
**Tipo de CU:** Consulta

**Entidades involucradas:**

- Entidad principal: Bitacora
- Entidad secundaria: BitacoraDetalle

**Mensajes del diagrama:**

1. Actor → Vista: abrirAuditoria(filtros: q, usuario, accion, modulo, fecha_desde, fecha_hasta)
2. Vista → Control: GET /auditoria/?page=1&per_page=50&[filtros]
3. Control → Bitacora: consultarConFiltros(JOIN Usuario, paginado)
4. Control → Vista: Confirmacion({items[], total, page, pages, per_page}) → 200
5. Actor → Vista: verDetalleRegistro(id)
6. Vista → Control: GET /auditoria/{id}
7. Control → Bitacora: verificarExistencia(id)
8. Control → Vista: [Rojo] registroNoEncontrado() → 404
9. Control → BitacoraDetalle: obtenerDetalles(b.detalles via relacion ORM)
10. Control → Vista: Confirmacion(registroConDetalles[{campo, valor_anterior, valor_nuevo}]) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: registro de bitácora no existe → 404
- Nota: los filtros son todos opcionales; sin filtros devuelve todos los registros paginados

**Notas especiales:** Este módulo es 100% de solo lectura. Los registros en Bitacora se crean desde otros módulos vía la función utilitaria `log()`. El `per_page` tiene un máximo de 200. La paginación es server-side. GET /auditoria/acciones y GET /auditoria/modulos devuelven los valores DISTINCT disponibles para los filtros del formulario de búsqueda.

---

### CU35 — Registrar Pago de Cliente

**Actores:** Usuario con permiso gestionar_finanzas
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: Pago
- Entidad secundaria: (generación de factura PDF como efecto secundario — no es una entidad BD)

**Mensajes del diagrama:**

1. Actor → Vista: registrarPago(id_proyecto, tipo_pago, monto, fecha_pago, metodo, observacion)
2. Vista → Control: POST /finanzas/pagos
3. Control → Vista: [Rojo] camposObligatoriosFaltantes() → 400
4. Control → Vista: [Rojo] tipoPagoInvalido() → 400
5. Control → Vista: [Rojo] metodoPagoInvalido() → 400
6. Control → Vista: [Rojo] montoInvalidoOMenorACero() → 400
7. Control → Pago: [Azul] insertarPago(id_usuario del JWT)
8. Control → UtilFactura: [Naranja] generarYGuardarFacturaPDF() (efecto secundario, error silenciado)
9. Control → Bitacora: [Naranja] registrarEvento(REGISTRAR_PAGO)
10. Control → Vista: Confirmacion(pagoRegistrado) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `id_proyecto`, `tipo_pago`, `monto`, `fecha_pago`, `metodo` faltantes → 400
- Rojo: `tipo_pago` no está en ('anticipo','pago_parcial','pago_final','otro') → 400
- Rojo: `metodo` no está en ('efectivo','transferencia','QR','otro') → 400
- Rojo: `monto` no numérico o ≤ 0 → 400
- Naranja: generación de PDF puede fallar silenciosamente (error capturado con warning, no afecta la respuesta)

**Notas especiales:** La generación de factura PDF es un efecto secundario no bloqueante (el error se silencia con un warning para no afectar el registro del pago). El campo `stripe_payment_intent_id` existe en el modelo pero solo se usa vía el módulo de Stripe (`stripe_routes.py`), no en este endpoint manual.

---

### CU04 — Gestionar Roles y Permisos

**Actores:** Administrador
**Actor iniciador:** Administrador
**Tipo de CU:** Mixto (consulta + escritura)

**Entidades involucradas:**

- Entidad principal: Rol
- Entidad secundaria: Permiso, RolPermiso (tabla de unión)

**Mensajes del diagrama:**
Flujo principal (Crear rol):

1. Actor → Vista: abrirGestionRoles()
2. Vista → Control: GET /roles/
3. Control → Rol: obtenerTodos(ordenados_por_nombre)
4. Control → Vista: Confirmacion(listaRoles) → 200
5. Vista → Control: GET /roles/permisos
6. Control → Permiso: obtenerTodos()
7. Control → Vista: Confirmacion(catalogoPermisos) → 200
8. Actor → Vista: crearRol(nombre, descripcion)
9. Vista → Control: POST /roles/
10. Control → Vista: [Rojo] nombreFaltante() → 400
11. Control → Vista: [Rojo] nombreDuplicado() → 409
12. Control → Rol: [Azul] insertar(nombre, descripcion)
13. Control → Bitacora: [Naranja] registrarEvento(CREAR_ROL)
14. Control → Vista: Confirmacion(rolCreado) → 201

Flujo de asignar permisos:
15. Actor → Vista: asignarPermisos(id_rol, permiso_ids[])
16. Vista → Control: PUT /roles/{id}/permisos
17. Control → Rol: verificarExistencia(id)
18. Control → Vista: [Rojo] rolNoEncontrado() → 404
19. Control → Vista: [Rojo] rolAdminSinPermisos() → 409 (si es Admin y se intenta vaciar)
20. Control → Permiso: verificarExistencia(cada permiso_id)
21. Control → Vista: [Rojo] permisoInexistente() → 400
22. Control → RolPermiso: [Verde] eliminarTodos(DELETE donde id_rol=id)
23. Control → RolPermiso: [Naranja] insertarNuevos(bucle per permiso_id)
24. Control → Bitacora: [Naranja] registrarEvento(ACTUALIZAR_PERMISOS_ROL)
25. Control → Vista: Confirmacion(rolesActualizado) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `nombre` vacío → 400
- Rojo: `nombre` ya existe en otro rol → 409
- Rojo: intenta quitar todos los permisos del rol "Administrador" sin forzar → 409 (requiere `"forzar": true`)
- Rojo: algún permiso_id no existe en catálogo → 400
- Verde (DELETE /roles/{id}): soft-delete de rol (validar que no sea Administrador y no tenga usuarios) → log ELIMINAR_ROL

**Notas especiales:** El rol "Administrador" está protegido de eliminación total. La asignación de permisos es reemplazo total (DELETE + INSERT en RolPermiso). El endpoint PUT /roles/{id}/permisos tiene validación especial: si es rol Admin y se intenta dejar sin permisos, retorna 409 pidiendo confirmación con `"forzar": true`.

---

### CU21 — Consultar Historial de Estados de Proyecto

**Actores:** Usuario con permiso ver_proyectos
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Consulta

**Entidades involucradas:**

- Entidad principal: Proyecto
- Entidad secundaria: ProyectoHistorial, EstadoProyecto

**Mensajes del diagrama:**

1. Actor → Vista: abrirDetalleProyecto(id_proyecto)
2. Vista → Control: GET /proyectos/{id}
3. Control → Proyecto: verificarExistencia(id)
4. Control → Vista: [Rojo] proyectoNoEncontrado() → 404
5. Control → Proyecto: obtenerConHistorial(con eager load de relaciones)
6. Control → ProyectoHistorial: cargarTodos(ordenados por fecha_cambio)
7. Control → EstadoProyecto: enriquecer(nombres de estados)
8. Control → Vista: Confirmacion(proyectoConHistorial[]) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: proyecto no existe → 404
- Narrativo: historial ordenado por fecha_cambio (cambios más recientes al final)
- Nota: primer registro siempre tiene id_estado_anterior=null (creación)

**Notas especiales:** El historial es automáticamente creado y mantenido por los endpoints de actualización (CU20). Cada cambio de estado genera un registro en ProyectoHistorial con estado anterior, nuevo, usuario que hizo el cambio y observación. Este endpoint es de solo lectura; el historial no se puede editar.

---

### CU25 — Reportar Consumo Real de Materiales

**Actores:** Usuario con permiso editar_ordenes (típicamente técnico en campo)
**Actor iniciador:** Usuario del sistema (técnico después de completar trabajo)
**Tipo de CU:** Escritura (actualiza cantidad_usada en OrdenProducto)

**Entidades involucradas:**

- Entidad principal: OrdenProducto
- Entidad secundaria: OrdenTrabajo (solo lectura), Producto (enriquecimiento)

**Mensajes del diagrama:**

1. Actor → Vista: abrirReporteConsumo(id_orden)
2. Vista → Control: GET /ordenes/{id}
3. Control → OrdenTrabajo: cargarConProductos()
4. Control → Vista: Confirmacion(ordenConProductosAsignados) → 200
5. Actor → Vista: reportarConsumo(id_orden, materiales[{id_producto, cantidad_usada, observacion}])
6. Vista → Control: PUT /ordenes/{id}/consumo
7. Control → OrdenTrabajo: verificarExistencia(id)
8. Control → Vista: [Rojo] ordenNoEncontrada() → 404
9. Control → OrdenProducto: procesarConsumosPorProducto(bucle sobre materiales[])
10. Control → OrdenProducto: [Azul] actualizarCantidadUsada(cantidad_usada)
11. Control → OrdenProducto: [Azul] actualizarObservacion(observacion)
12. Control → Bitacora: [Naranja] registrarEvento(REPORTAR_CONSUMO)
13. Control → Vista: Confirmacion(ordenConConsumoActualizado) → 200

**Flujos alternativos relevantes para el diagrama:**

- Naranja: ignorar silenciosamente productos en el array que no existan en la orden
- Azul condicional: solo actualizar campos que vienen en el payload (id_producto es requerido para match)
- Narrativo: cantidad_usada puede ser null (para limpiar valor anterior)

**Notas especiales:** El flujo es diseñado para ser tolerante: si alguien reporta consumo de un producto que no está en la OT, se ignora sin error. Los campos no presentes en el payload se dejan sin cambios (PATCH semántico). El consumo se registra "a posteriori", después de que el técnico completa el trabajo en campo.

---

### CU27 — Consultar Historial de Estados de OT

**Actores:** Usuario con permiso ver_ordenes
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Consulta

**Entidades involucradas:**

- Entidad principal: OrdenTrabajo
- Entidad secundaria: OrdenHistorial, EstadoOrden, OrdenEmpleado, OrdenProducto

**Mensajes del diagrama:**

1. Actor → Vista: abrirDetalleOT(id_orden)
2. Vista → Control: GET /ordenes/{id}
3. Control → OrdenTrabajo: verificarExistencia(id)
4. Control → Vista: [Rojo] ordenNoEncontrada() → 404
5. Control → OrdenTrabajo: cargarConDetalles(eager load)
6. Control → OrdenHistorial: cargarTodos(ordenados por fecha_cambio)
7. Control → OrdenEmpleado: cargarAsignados()
8. Control → OrdenProducto: cargarAsignados(con consumo)
9. Control → EstadoOrden: enriquecer(nombres de estados)
10. Control → Vista: Confirmacion(ordenConHistorialYDetalles) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: orden no existe → 404
- Narrativo: historial muestra toda la trazabilidad de cambios de estado
- Detalle: incluye empleados asignados y productos con cantidad asignada/usada

**Notas especiales:** Similar a CU21 pero para órdenes. El historial es automático. Cada cambio de estado (vía PUT /ordenes/{id}) genera un registro en OrdenHistorial. Este endpoint agrega también los empleados y productos asociados, dando una visión 360 de la orden.

---

### CU28 — Registrar Nota en Bitácora de Cliente

**Actores:** Usuario con permiso ver_clientes (cualquier rol que pueda ver clientes)
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Mixto (consulta + escritura)

**Entidades involucradas:**

- Entidad principal: BitacoraCliente
- Entidad secundaria: Entidad (solo lectura), Usuario (enriquecimiento)

**Mensajes del diagrama:**

1. Actor → Vista: abrirBitacoraCliente(id_entidad)
2. Vista → Control: GET /entidades/{id}/bitacora
3. Control → Entidad: verificarExistencia(id)
4. Control → Vista: [Rojo] entidadNoEncontrada() → 404
5. Control → BitacoraCliente: obtenerTodos(WHERE id_entidad=id, ORDER BY fecha_creacion DESC)
6. Control → Usuario: enriquecer(username de cada nota)
7. Control → Vista: Confirmacion(listaNotas) → 200
8. Actor → Vista: registrarNota(id_entidad, texto_nota)
9. Vista → Control: POST /entidades/{id}/bitacora
10. Control → Vista: [Rojo] notaVacia() → 400
11. Control → BitacoraCliente: [Azul] insertar(id_entidad, id_usuario del JWT, nota)
12. Control → Bitacora: [Naranja] registrarEvento(NOTA_BITACORA_CLIENTE)
13. Control → Vista: Confirmacion(notaCreada) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: entidad no encontrada → 404
- Rojo: nota vacía después de trim() → 400
- Verde: las notas se ordenan DESC por fecha (más recientes primero)

**Notas especiales:** Es una bitácora específica de cliente/entidad, independiente de la Bitacora general del sistema (que es para auditoría de operaciones). Las notas son texto libre para contextualizar la relación con el cliente. Se limpia espacios automáticamente.

---

### CU36 — Consultar Cuentas por Cobrar

**Actores:** Usuario con permiso ver_finanzas
**Actor iniciador:** Usuario del sistema (Administrador, Jefe de Finanzas)
**Tipo de CU:** Consulta

**Entidades involucradas:**

- Entidad principal: Proyecto
- Entidad secundaria: Cotizacion, CotizacionDetalle, Pago, Entidad

**Mensajes del diagrama:**

1. Actor → Vista: abrirCuentasPorCobrar()
2. Vista → Control: GET /finanzas/cuentas-por-cobrar
3. Control → Proyecto: obtenerConCotizaciones(JOIN Cotizacion WHERE estado IN aprobada/convertida)
4. Control → CotizacionDetalle: calcularTotalPorCotizacion(SUM de subtotales)
5. Control → Pago: calcularTotalPagadoPorProyecto(SUM de montos)
6. Control → Vista: [Narrativo] calcularSaldoPendiente(monto_total - total_pagado)
7. Control → Vista: [Narrativo] filtrarPositivos(solo donde saldo > 0)
8. Control → Entidad: enriquecer(nombre cliente)
9. Control → Bitacora: [Naranja] registrarEvento(VER_REPORTE_FINANCIERO)
10. Control → Vista: Confirmacion(cuentasPorCobrarOrdenadas DESC por saldo) → 200

**Flujos alternativos relevantes para el diagrama:**

- Narrativo: solo retorna cotizaciones en estado 'aprobada' o 'convertida'
- Narrativo: solo retorna proyectos con saldo > 0 (excluye pagados)
- Verde: resultado ordenado DESC por saldo_pendiente (mayor deuda primero)
- Caso vacío: retorna [] si no hay cuentas por cobrar

**Notas especiales:** Este es un reporte de solo lectura que agrega datos de múltiples tablas (Proyecto, Cotizacion, CotizacionDetalle, Pago, Entidad). La lógica de negocio es: solo proyectos con cotizaciones aprobadas/convertidas forman parte de cuentas por cobrar. Los proyectos sin cotización o con cotizaciones pendientes no aparecen. Es una vista de crédito del cliente, útil para seguimiento de cobranzas.

---

### CU08 — Gestionar Teléfonos de Entidad

**Actores:** Usuario con permiso editar_clientes
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura (gestiona tabla pivote telefono_entidad)

**Entidades involucradas:**

- Entidad principal: Telefono
- Entidad secundaria: Entidad (solo lectura), tabla pivote telefono_entidad

**Mensajes del diagrama:**

1. Actor → Vista: abrirTelefonosEntidad(id_entidad)
2. Vista → Control: GET /entidades/{id}/telefonos
3. Control → Entidad: verificarExistencia(id)
4. Control → Vista: [Rojo] entidadNoEncontrada() → 404
5. Control → Telefono: obtenerPorEntidad(SQL JOIN telefono_entidad)
6. Control → Vista: Confirmacion(listaTelefonos) → 200
7. Actor → Vista: agregarTelefono(id_entidad, numero)
8. Vista → Control: POST /entidades/{id}/telefonos
9. Control → Vista: [Rojo] numeroVacio() → 400
10. Control → Telefono: [Azul] insertar(numero, flush)
11. Control → telefono_entidad: [Naranja] insertar(id_telefono, id_entidad)
12. Control → Bitacora: [Naranja] registrarEvento(AGREGAR_TELEFONO_ENTIDAD)
13. Control → Vista: Confirmacion(telefonoCreado) → 201
14. Actor → Vista: eliminarTelefono(id_entidad, id_telefono)
15. Vista → Control: DELETE /entidades/{id}/telefonos/{id_tel}
16. Control → telefono_entidad: [Verde] eliminarRelacion()
17. Control → telefono_entidad/telefono_proveedor: [Verde] verificarOtrosUsos()
18. Control → Telefono: [Verde] eliminarSiNoSirve()
19. Control → Vista: Confirmacion('Teléfono eliminado') → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: entidad no encontrada → 404
- Rojo: número vacío o solo espacios → 400
- Verde: limpieza de huérfanos (si teléfono no está en otra entidad ni proveedor, se elimina)

**Notas especiales:** Usa tabla intermediaria `telefono_entidad` (N:M). El sistema implementa garbage collection: si un teléfono ya no está asociado a ninguna entidad ni proveedor, se elimina de la BD automáticamente. El número se trim() antes de insertar/validar.

---

### CU10 — Asignar Cargo a Empleado

**Actores:** Administrador, Jefe de Personal
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura (actualiza id_cargo en Empleado)

**Entidades involucradas:**

- Entidad principal: Empleado
- Entidad secundaria: Cargo (solo lectura para validación)

**Mensajes del diagrama:**

1. Actor → Vista: abrirAsignacionCargo(id_empleado)
2. Vista → Control: GET /empleados/{id}
3. Control → Empleado: cargarConRelaciones()
4. Control → Vista: Confirmacion(empleadoConCargoActual) → 200
5. Actor → Vista: cambiarCargo(id_empleado, id_cargo)
6. Vista → Control: PUT /empleados/{id}/cargo
7. Control → Empleado: verificarExistencia(id)
8. Control → Vista: [Rojo] empleadoNoEncontrado() → 404
9. Control → Cargo: verificarExistencia(id_cargo) (si no es null)
10. Control → Vista: [Rojo] cargoNoEncontrado() → 404
11. Control → Empleado: [Azul] actualizarCargo(id_cargo_nuevo)
12. Control → Bitacora: [Naranja] registrarEvento(ASIGNAR_CARGO_EMPLEADO, detalleAnteriorNuevo)
13. Control → Vista: Confirmacion(empleadoActualizado) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: empleado no existe → 404
- Rojo: cargo no existe (si se envía id_cargo no null) → 404
- Azul: permite pasar `id_cargo: null` para quitar cargo (es nullable)

**Notas especiales:** Relación simple N:1 (muchos empleados pueden tener el mismo cargo). El campo `id_cargo` es nullable (ON DELETE SET NULL en FK), permitiendo desasignar cargo. La bitácora registra el cambio: "Cargo anterior → Cargo nuevo" incluyendo casos "Sin cargo → Cargo X" y "Cargo X → Sin cargo".

---

### CU11 — Acreditar Especialidad a Empleado

**Actores:** Administrador, Jefe de Personal
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura (gestiona tabla pivote empleado_especialidad)

**Entidades involucradas:**

- Entidad principal: Especialidad
- Entidad secundaria: Empleado (solo lectura), tabla pivote empleado_especialidad

**Mensajes del diagrama:**

1. Actor → Vista: abrirEspecialidadesEmpleado(id_empleado)
2. Vista → Control: GET /empleados/{id}/especialidades
3. Control → Empleado: verificarExistencia(id)
4. Control → Vista: [Rojo] empleadoNoEncontrado() → 404
5. Control → Especialidad: obtenerDelEmpleado(SQL JOIN empleado_especialidad)
6. Control → Vista: Confirmacion(listaEspecialidades) → 200
7. Actor → Vista: agregarEspecialidad(id_empleado, id_especialidad)
8. Vista → Control: POST /empleados/{id}/especialidades
9. Control → Vista: [Rojo] idEspecialidadFaltante() → 400
10. Control → Especialidad: verificarExistencia(id_especialidad)
11. Control → Vista: [Rojo] especialidadNoEncontrada() → 404
12. Control → empleado_especialidad: verificarDuplicado(COUNT WHERE id_emp=id AND id_esp=id)
13. Control → Vista: [Rojo] yaExiste() → 409
14. Control → empleado_especialidad: [Naranja] insertar(id_empleado, id_especialidad)
15. Control → Bitacora: [Naranja] registrarEvento(AGREGAR_ESPECIALIDAD)
16. Control → Vista: Confirmacion(especialidadCreada) → 201
17. Actor → Vista: quitarEspecialidad(id_empleado, id_especialidad)
18. Vista → Control: DELETE /empleados/{id}/especialidades/{id_esp}
19. Control → empleado_especialidad: [Verde] eliminar(WHERE id_emp=id AND id_esp=id)
20. Control → Vista: [Rojo] relaciónNoExiste(rowcount==0) → 404
21. Control → Vista: Confirmacion('Especialidad removida') → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: empleado no existe → 404
- Rojo: especialidad no existe → 404
- Rojo: empleado ya tiene esa especialidad → 409
- Rojo: relación no existe en DELETE → 404 (si rowcount==0)
- Verde: no hay limpieza de huérfanos (especialidad permanece en BD aunque sin empleados)

**Notas especiales:** Tabla intermediaria `empleado_especialidad` (N:M). A diferencia de teléfonos (CU08), NO hay limpieza de huérfanos: una Especialidad permanece en BD incluso si ningún empleado la tiene. La prevención de duplicados es explícita (COUNT + error 409), no implícita en PK. En PUT /empleados/{id} se usa `INSERT IGNORE` para actualizar listas sin riesgo de duplicados.

---

### CU13 — Gestionar Proveedores

**Actores:** Usuario con permiso gestionar_catalogo
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Mixto (consulta + escritura)

**Entidades involucradas:**

- Entidad principal: Proveedor
- Entidad secundaria: Telefono, telefono_proveedor, Departamento (enum)

**Mensajes del diagrama:**

1. Actor → Vista: abrirCatalogProveedores()
2. Vista → Control: GET /proveedores/
3. Control → Proveedor: obtenerActivos(estado=True)
4. Control → Vista: Confirmacion(listaProveedores) → 200
5. Actor → Vista: crearProveedor(nombre, email, direccion, departamento, telefonos[])
6. Vista → Control: POST /proveedores/
7. Control → Vista: [Rojo] nombreVacio() → 400
8. Control → Proveedor: verificarNombreUnico(nombre case-insensitive)
9. Control → Vista: [Rojo] nombreDuplicado() → 409
10. Control → Vista: [Rojo] departamentoInvalido() → 400
11. Control → Proveedor: [Azul] insertar(nombre, email, direccion, departamento)
12. Control → Telefono: [Naranja] agregarTelefonos(bucle telefonos[])
13. Control → Bitacora: [Naranja] registrarEvento(CREAR_PROVEEDOR)
14. Control → Vista: Confirmacion(proveedorCreado) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: nombre vacío → 400
- Rojo: nombre ya existe (case-insensitive) → 409
- Rojo: departamento no está en lista de 9 departamentos bolivianos → 400
- Naranja: teléfonos son opcionales; se agregan en bucle si vienen en payload
- Verde (DELETE /proveedores/{id}): soft-delete (estado=False)

**Notas especiales:** Los 9 departamentos válidos son: Santa Cruz, La Paz, Cochabamba, Potosí, Chuquisaca, Tarija, Beni, Pando, Oruro. La búsqueda de nombre duplicado ignora mayúsculas/minúsculas. Los teléfonos se vinculan mediante tabla `telefono_proveedor` (relación N:M independiente de entidades).

---

### CU14 — Asociar Producto a Proveedor

**Actores:** Usuario con permiso gestionar_catalogo
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura (gestiona tabla pivote producto_proveedor)

**Entidades involucradas:**

- Entidad principal: ProductoProveedor (relación N:M)
- Entidad secundaria: Producto (validación), Proveedor (validación)

**Mensajes del diagrama:**

1. Actor → Vista: asociarProductoAProveedor(id_proveedor, id_producto, precio_unitario, es_principal)
2. Vista → Control: POST /proveedores/{id}/productos
3. Control → Proveedor: verificarExistencia(id)
4. Control → Vista: [Rojo] proveedorNoEncontrado() → 404
5. Control → Vista: [Rojo] idProductoFaltante() → 400
6. Control → Producto: verificarExistenciaYActivo(id_producto)
7. Control → Vista: [Rojo] productoInexistenteOInactivo() → 404
8. Control → producto_proveedor: verificarDuplicado()
9. Control → Vista: [Rojo] yaAsociado() → 409
10. Control → Vista: [Rojo] precioInvalido() → 400
11. Control → producto_proveedor: [Naranja] insertar(id_producto, id_proveedor, precio_unitario, es_principal)
12. Control → Bitacora: [Naranja] registrarEvento(ASOCIAR_PRODUCTO_PROVEEDOR)
13. Control → Vista: Confirmacion(asociacionCreada) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: proveedor no existe → 404
- Rojo: id_producto faltante → 400
- Rojo: producto no existe o está inactivo → 404
- Rojo: producto ya está asociado a ese proveedor → 409
- Rojo: precio no positivo → 400
- Naranja: `es_principal` es boolean opcional (indica si es proveedor principal del producto)

**Notas especiales:** Tabla pivote `producto_proveedor` con campos adicionales: `precio_unitario` (requerido, > 0) y `es_principal` (boolean, default False). Un producto puede tener múltiples proveedores, cada uno con precio diferente.

---

### CU26 — Registrar Gasto de Orden

**Actores:** Usuario con permiso gestionar_finanzas
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: GastoOrden
- Entidad secundaria: OrdenTrabajo (validación)

**Mensajes del diagrama:**

1. Actor → Vista: registrarGasto(id_orden, concepto, monto, fecha_gasto, descripcion)
2. Vista → Control: POST /finanzas/gastos
3. Control → Vista: [Rojo] camposObligatoriosFaltantes() → 400
4. Control → Vista: [Rojo] conceptoInvalido() → 400
5. Control → Vista: [Rojo] montoNegativoOInvalido() → 400
6. Control → GastoOrden: [Azul] insertar(id_orden, id_usuario, concepto, monto, fecha_gasto)
7. Control → Bitacora: [Naranja] registrarEvento(REGISTRAR_GASTO)
8. Control → Vista: Confirmacion(gastoRegistrado) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `id_orden`, `concepto`, `monto`, `fecha_gasto` faltantes → 400
- Rojo: `concepto` no está en ('materiales','viaticos','transporte','otro') → 400
- Rojo: `monto` ≤ 0 o no numérico → 400

**Notas especiales:** El `id_usuario` se extrae del JWT. Los conceptos válidos de gastos son: materiales, viaticos, transporte, otro. Es un registro simple sin validaciones complejas de orden (solo registra el gasto).

---

### CU29 — Registrar Nota en Bitácora de Proyecto

**Actores:** Usuario con permiso ver_proyectos
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Mixto (consulta + escritura)

**Entidades involucradas:**

- Entidad principal: BitacoraProyecto
- Entidad secundaria: Proyecto (validación)

**Mensajes del diagrama:**

1. Actor → Vista: abrirBitacoraProyecto(id_proyecto)
2. Vista → Control: GET /proyectos/{id}/bitacora
3. Control → Proyecto: verificarExistencia(id)
4. Control → Vista: [Rojo] proyectoNoEncontrado() → 404
5. Control → BitacoraProyecto: obtenerTodos(WHERE id_proyecto=id, ORDER BY fecha DESC)
6. Control → Vista: Confirmacion(listaNotas) → 200
7. Actor → Vista: registrarNota(id_proyecto, nota)
8. Vista → Control: POST /proyectos/{id}/bitacora
9. Control → Vista: [Rojo] notaVacia() → 400
10. Control → BitacoraProyecto: [Azul] insertar(id_proyecto, id_usuario, nota)
11. Control → Bitacora: [Naranja] registrarEvento(NOTA_BITACORA_PROYECTO)
12. Control → Vista: Confirmacion(notaCreada) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: proyecto no existe → 404
- Rojo: nota vacía después de trim() → 400

**Notas especiales:** Similar a CU28 (bitácora cliente) pero para proyectos. Es texto libre para contextualizar el progreso/situación del proyecto. Las notas se ordenan DESC por fecha (más recientes primero). El id_usuario se extrae del JWT.

---

### CU30 — Adjuntar Documento a Proyecto

**Actores:** Usuario con permiso ver_proyectos
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura (guarda archivo en disco + registro en BD)

**Entidades involucradas:**

- Entidad principal: Documento
- Entidad secundaria: Proyecto (validación), TipoDocumento (validación)

**Mensajes del diagrama:**

1. Actor → Vista: adjuntarDocumento(id_proyecto, nombre, id_tipo_documento, archivo)
2. Vista → Control: POST /proyectos/{id}/documentos (multipart/form-data)
3. Control → Proyecto: verificarExistencia(id)
4. Control → Vista: [Rojo] proyectoNoEncontrado() → 404
5. Control → Vista: [Rojo] nombreFaltante() → 400
6. Control → Vista: [Rojo] tipoDocumentoFaltante() → 400
7. Control → Vista: [Rojo] archivoFaltante() → 400
8. Control → Vista: [Rojo] extensionNoPermitida() → 400
9. Control → TipoDocumento: verificarExistencia(id_tipo_documento)
10. Control → Vista: [Rojo] tipoDocumentoInvalido() → 404
11. Control → Filesystem: [Naranja] generarNombreSeguro(uuid+nombre)
12. Control → Filesystem: [Naranja] crearCarpetaUpload()
13. Control → Filesystem: [Naranja] guardarArchivo(archivo)
14. Control → Documento: [Azul] insertar(id_proyecto, id_usuario, id_tipo_documento, nombre, ruta)
15. Control → Bitacora: [Naranja] registrarEvento(SUBIR_DOCUMENTO)
16. Control → Vista: Confirmacion(documentoCreado) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: proyecto no existe → 404
- Rojo: nombre, tipo_documento o archivo faltantes → 400
- Rojo: extensión no permitida (validar contra lista blanca) → 400
- Verde (DELETE /proyectos/{id}/documentos/{id_doc}): elimina archivo de disco + registro de BD

**Notas especiales:** Request es multipart/form-data, no JSON. El nombre del archivo en disco se genera como `{uuid}_{nombre_seguro}` para evitar colisiones. El archivo se guarda en carpeta de uploads configurada. La ruta almacenada en BD es solo el nombre de archivo (no ruta completa), facilitando migraciones de almacenamiento.

---

### CU31 — Programar Mantenimiento Preventivo

(Ya documentado anteriormente)

---

### CU32 — Gestionar Alertas Pendientes de Mantenimiento

**Actores:** Usuario con permiso gestionar_mantenimientos
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Mixto (consulta + escritura)

**Entidades involucradas:**

- Entidad principal: AlertaMantenimiento
- Entidad secundaria: Mantenimiento (validación), Establecimiento (validación)

**Mensajes del diagrama:**
Flujo de consulta con filtros:

1. Actor → Vista: consultarAlertas(estado, id_establecimiento)
2. Vista → Control: GET /mantenimiento/alertas?estado=pendiente&id_establecimiento=1
3. Control → AlertaMantenimiento: obtenerConFiltros(estado, id_establecimiento)
4. Control → Vista: Confirmacion(listaAlertas) → 200

Flujo de crear alerta:
5. Actor → Vista: crearAlerta(id_mantenimiento, id_establecimiento, observacion)
6. Vista → Control: POST /mantenimiento/alertas
7. Control → Vista: [Rojo] camposObligatoriosFaltantes() → 400
8. Control → Mantenimiento: verificarExistencia(id_mantenimiento)
9. Control → Vista: [Rojo] mantenimientoNoEncontrado() → 404
10. Control → Establecimiento: verificarExistencia(id_establecimiento)
11. Control → Vista: [Rojo] establecimientoNoEncontrado() → 404
12. Control → AlertaMantenimiento: [Azul] insertar(id_mantenimiento, id_establecimiento, estado='pendiente')
13. Control → Bitacora: [Naranja] registrarEvento(CREAR_ALERTA_MANTENIMIENTO)
14. Control → Vista: Confirmacion(alertaCreada) → 201

Flujo de actualizar alerta:
15. Actor → Vista: actualizarAlerta(id_alerta, nuevo_estado, observacion)
16. Vista → Control: PUT /mantenimiento/alertas/{id}
17. Control → AlertaMantenimiento: verificarExistencia(id)
18. Control → Vista: [Rojo] alertaNoEncontrada() → 404
19. Control → Vista: [Rojo] estadoInvalido() → 400
20. Control → AlertaMantenimiento: [Azul] actualizar(estado, observacion)
21. Control → Bitacora: [Naranja] registrarEvento(ACTUALIZAR_ALERTA_MANTENIMIENTO)
22. Control → Vista: Confirmacion(alertaActualizada) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: campos requeridos faltantes (id_mantenimiento, id_establecimiento) → 400
- Rojo: mantenimiento no existe → 404
- Rojo: establecimiento no existe → 404
- Rojo: estado no está en ('pendiente','enviada','leida','completada') → 400
- Narrativo: query params son opcionales; sin filtros retorna todas

**Notas especiales:** Los estados válidos de alerta son: pendiente, enviada, leida, completada. Diferente a estados de mantenimiento. Las query params (estado, id_establecimiento) son opcionales; sin ellos retorna todas las alertas paginadas. La fecha se genera automáticamente (server_default).

---

### CU37 — Gestionar Categorías

**Actores:** Usuario con permiso gestionar_catalogo
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Mixto (consulta + escritura)

**Entidades involucradas:**

- Entidad principal: Categoria
- Entidad secundaria: Producto (validación en DELETE)

**Mensajes del diagrama:**

1. Actor → Vista: abrirCategorias()
2. Vista → Control: GET /categorias/
3. Control → Categoria: obtenerActivas(estado=True)
4. Control → Vista: Confirmacion(listaCategorias) → 200
5. Actor → Vista: crearCategoria(nombre, descripcion)
6. Vista → Control: POST /categorias/
7. Control → Vista: [Rojo] nombreVacio() → 400
8. Control → Categoria: verificarNombreUnico(case-insensitive)
9. Control → Vista: [Rojo] nombreDuplicado() → 409
10. Control → Categoria: [Azul] insertar(nombre, descripcion)
11. Control → Bitacora: [Naranja] registrarEvento(CREAR_CATEGORIA)
12. Control → Vista: Confirmacion(categoriaCreada) → 201
13. Actor → Vista: eliminarCategoria(id_categoria)
14. Vista → Control: DELETE /categorias/{id}
15. Control → Producto: verificarProductosActivos(WHERE id_categoria=id)
16. Control → Vista: [Rojo] tieneProductosActivos() → 409
17. Control → Categoria: [Verde] softDelete(estado=False)
18. Control → Vista: Confirmacion('Categoría desactivada') → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: nombre vacío → 400
- Rojo: nombre duplicado → 409
- Rojo: categoría tiene productos activos, no puede desactivarse → 409
- Verde: soft-delete (solo si no tiene productos activos)

**Notas especiales:** No se puede desactivar una categoría si tiene productos activos asociados. La validación ocurre antes del DELETE. El nombre debe ser único (case-insensitive). Incluye contador de productos en GET.

---

### CU38 — Gestionar Servicios

**Actores:** Usuario con permiso gestionar_catalogo
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Mixto (consulta + escritura)

**Entidades involucradas:**

- Entidad principal: Servicio
- Entidad secundaria: ninguna (sin dependencias de otros CUs)

**Mensajes del diagrama:**

1. Actor → Vista: abrirServicios()
2. Vista → Control: GET /servicios/
3. Control → Servicio: obtenerActivos(estado=True)
4. Control → Vista: Confirmacion(listaServicios) → 200
5. Actor → Vista: crearServicio(nombre, precio, descripcion)
6. Vista → Control: POST /servicios/
7. Control → Vista: [Rojo] nombreVacio() → 400
8. Control → Vista: [Rojo] precioInvalido() → 400
9. Control → Servicio: verificarNombreUnico(case-insensitive)
10. Control → Vista: [Rojo] nombreDuplicado() → 409
11. Control → Servicio: [Azul] insertar(nombre, precio, descripcion)
12. Control → Bitacora: [Naranja] registrarEvento(CREAR_SERVICIO)
13. Control → Vista: Confirmacion(servicioCreado) → 201
14. Actor → Vista: editarServicio(id_servicio, nombre, precio, descripcion)
15. Vista → Control: PUT /servicios/{id}
16. Control → Servicio: verificarExistencia(id)
17. Control → Vista: [Rojo] servicioNoEncontrado() → 404
18. Control → Vista: [Rojo] nombreDuplicado() → 409
19. Control → Vista: [Rojo] precioInvalido() → 400
20. Control → Servicio: [Azul] actualizar(nombre, precio, descripcion)
21. Control → Vista: Confirmacion(servicioActualizado) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: nombre vacío → 400
- Rojo: nombre duplicado → 409
- Rojo: precio ≤ 0 o no numérico → 400
- Verde (DELETE): soft-delete (estado=False)

**Notas especiales:** El precio es Decimal(12,2) requerido y debe ser > 0. No hay dependencias de otros modelos, lo que hace este CU más simple. El nombre debe ser único (case-insensitive).

---

### CU40 — Registrar Mantenimiento Correctivo

**Actores:** Usuario con permiso gestionar_mantenimientos
**Actor iniciador:** Usuario del sistema
**Tipo de CU:** Escritura

**Entidades involucradas:**

- Entidad principal: Mantenimiento
- Entidad secundaria: Sistema (validación), OrdenTrabajo (opcional, validación)

**Mensajes del diagrama:**

1. Actor → Vista: registrarMantenimientoCorrectivo(id_sistema, fecha_programada, id_orden_trabajo, observacion)
2. Vista → Control: POST /mantenimiento/
3. Control → Vista: [Rojo] camposObligatoriosFaltantes() → 400
4. Control → Vista: [Rojo] tipoInvalido() → 400
5. Control → Sistema: verificarExistencia(id_sistema)
6. Control → Vista: [Rojo] sistemaNoEncontrado() → 404
7. Control → Mantenimiento: [Azul] insertar(id_sistema, tipo='correctivo', fecha_programada, id_orden_trabajo, creado_automaticamente=False)
8. Control → Bitacora: [Naranja] registrarEvento(CREAR_MANTENIMIENTO)
9. Control → Vista: Confirmacion(mantenimientoCreado) → 201

**Flujos alternativos relevantes para el diagrama:**

- Rojo: `id_sistema`, `tipo`, `fecha_programada` faltantes → 400
- Rojo: `tipo` no está en ('preventivo','correctivo') → 400
- Rojo: sistema no existe → 404
- Narrativo: `tipo` debe ser 'correctivo' para este CU (a diferencia de CU31 que es 'preventivo')

**Notas especiales:** Casi idéntico a CU31, solo con `tipo='correctivo'`. El campo `creado_automaticamente=False` diferencia manuales de automáticos. El `id_orden_trabajo` es opcional (puede ser null).

---

### CU42 — Procesar Pago por Pasarela (Stripe)

**Actores:** Usuario con permiso gestionar_finanzas, cliente (en frontend)
**Actor iniciador:** Usuario del sistema o cliente
**Tipo de CU:** Escritura (integración con servicio externo)

**Entidades involucradas:**

- Entidad principal: Pago
- Entidad secundaria: Proyecto (validación), API Stripe (servicio externo)

**Mensajes del diagrama:**
Flujo crear PaymentIntent:

1. Actor → Vista: abrirFormaPago(id_proyecto, monto, tipo_pago)
2. Vista → Control: POST /stripe/crear-intent
3. Control → Vista: [Rojo] camposObligatoriosFaltantes() → 400
4. Control → Vista: [Rojo] tipoPagoInvalido() → 400
5. Control → Vista: [Rojo] montoInvalido() → 400
6. Control → Stripe: [Naranja] crearPaymentIntent(monto_centavos, metadata)
7. Control → Vista: Confirmacion(client_secret, payment_intent_id) → 200
8. Vista → Stripe.js: procesar pago (frontend)
9. Stripe → Vista: confirmación (success o error)

Flujo completar pago:
10. Vista → Control: POST /stripe/completar (payment_intent_id, id_proyecto, tipo_pago, monto)
11. Control → Vista: [Rojo] camposObligatoriosFaltantes() → 400
12. Control → Stripe: [Naranja] verificarPaymentIntent(payment_intent_id)
13. Control → Vista: [Rojo] statusNoSucceeded() → 400
14. Control → Pago: verificarNoExistePrevio(stripe_payment_intent_id)
15. Control → Vista: [Rojo] yaRegistrado() → 409
16. Control → Pago: [Azul] insertar(id_proyecto, id_usuario, tipo_pago, monto, stripe_payment_intent_id, stripe_status='succeeded')
17. Control → UtilFactura: [Naranja] generarYGuardarFacturaPDF() (no bloqueante)
18. Control → Bitacora: [Naranja] registrarEvento(PAGO_STRIPE)
19. Control → Vista: Confirmacion(pagoRegistrado) → 201

Flujo webhook:
20. Stripe → Control: POST /stripe/webhook (event, signature)
21. Control → Vista: [Rojo] firmaInvalida() → 400
22. Control → Pago: verificarYActualizar(payment_intent_id, status)
23. Control → Vista: Confirmacion(ok) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: campos faltantes (monto, id_proyecto, tipo_pago) → 400
- Rojo: tipo_pago no válido → 400
- Rojo: monto ≤ 0 → 400
- Rojo: status de PaymentIntent no es 'succeeded' → 400
- Rojo: ya existe Pago con ese payment_intent_id → 409
- Rojo: firma de webhook inválida → 400
- Naranja: generación de PDF falla silenciosamente (no afecta registro)

**Notas especiales:** Integración con API Stripe. Requiere STRIPE_SECRET_KEY en .env. El client_secret se pasa al frontend para que Stripe.js procese el pago. El monto se convierte a centavos (×100) para Stripe. El webhook verifica firmas y actualiza status si cambia. El campo `stripe_payment_intent_id` es unique en tabla Pago, previene duplicados.

---

### CU43 — Generar Reporte Financiero

**Actores:** Usuario con permiso ver_finanzas
**Actor iniciador:** Usuario del sistema (Administrador, Jefe Finanzas)
**Tipo de CU:** Consulta (con múltiples JOINs agregados)

**Entidades involucradas:**

- Entidad principal: Reporte (virtual, agregado)
- Entidad secundaria: Pago, GastoOrden, Proyecto, OrdenTrabajo, Entidad

**Mensajes del diagrama:**

1. Actor → Vista: abrirReporteFinanciero(fecha_inicio, fecha_fin)
2. Vista → Control: GET /finanzas/reporte?fecha_inicio=2026-01-01&fecha_fin=2026-05-31
3. Control → Vista: [Rojo] formatoFechaInvalido() → 400
4. Control → Pago: [Narrativo] obtenerConFiltros(fecha_pago BETWEEN fecha_inicio y fecha_fin)
5. Control → GastoOrden: [Narrativo] obtenerConFiltros(fecha_gasto BETWEEN fecha_inicio y fecha_fin)
6. Control → Vista: [Narrativo] calcularResumen(SUM ingresos, SUM gastos, utilidad)
7. Control → Vista: [Narrativo] agruparPorTipoPago(GROUP BY tipo_pago, calcular porcentajes)
8. Control → Vista: [Narrativo] agruparPorConcepto(GROUP BY concepto, calcular porcentajes)
9. Control → Vista: [Narrativo] calcularEvolucionMensual(GROUP BY YEAR-MONTH, series mensual)
10. Control → Proyecto: [Narrativo] obtenerConPagosYGastos(JOIN complejo)
11. Control → Vista: [Narrativo] calcularPorProyecto(ingresos, gastos, utilidad por proyecto)
12. Control → Bitacora: [Naranja] registrarEvento(VER_REPORTE_FINANCIERO)
13. Control → Vista: Confirmacion(reporteCompleto) → 200

**Flujos alternativos relevantes para el diagrama:**

- Rojo: formato de fecha inválido (esperado YYYY-MM-DD) → 400
- Narrativo: sin fecha_inicio/fin retorna TODO (sin filtro temporal)
- Narrativo: sin pagos/gastos retorna [] con utilidad=0

**Notas especiales:** Reporte altamente agregado con múltiples desgloces. Calcula porcentajes sobre totales. Incluye evolución mensual (útil para análisis de tendencias). Desglose por proyecto mostrando ingresos/gastos/utilidad individual. Es una consulta de solo lectura muy compleja con múltiples JOINs y GROUP BY. No requiere parámetros obligatorios (los rangos de fecha son opcionales).

---

## RESUMEN FINAL: 41 CASOS DE USO DOCUMENTADOS

**Por tipo:**

- Escritura (CRUD/Create): 18 CUs
- Consulta (Read): 12 CUs
- Mixto (Read + Write): 11 CUs

**Por permiso más frecuente:**

- `gestionar_catalogo`: 6 CUs (CU04, CU12, CU13, CU14, CU37, CU38)
- `gestionar_mantenimientos`: 4 CUs (CU31, CU32, CU40, alertas)
- `ver_proyectos`: 3 CUs (CU21, CU29, CU30)
- `gestionar_finanzas`: 4 CUs (CU26, CU35, CU42, CU43)

**Por tipo de relación:**

- N:M con limpieza de huérfanos: CU08 (teléfonos), CU14 (producto-proveedor)
- N:M sin limpieza: CU11 (especialidades), CU23 (empleados), CU24 (productos)
- 1:N: CU10 (cargo-empleado)
- Simple insert: CU26, CU29, CU30, CU35, CU40

**Patrones repetitivos:**

- Soft delete (estado=False): CU02, CU05, CU12, CU24, CU37, CU38
- Reemplazo total (DELETE + INSERT): CU16, CU23, CU24, CU04
- Bitácora transversal: Todos los de escritura
- Validación de unicidad: CU03, CU05, CU06, CU07, CU12, CU13, CU37, CU38
- Protecciones especiales: CU04 (rol Admin), CU37 (productos activos)
