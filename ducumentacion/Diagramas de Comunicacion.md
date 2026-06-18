  CU01 — Iniciar sesión

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Usuario" as Actor #yellow
  boundary " Vista Iniciar Sesión " as Vista #FFFDE7
  control " AutenticarUsuario " as Control #FFFDE7
  entity "User" as User #FFFDE7
  Actor --> Vista : 1: ingresarCredenciales()
  Vista -[#black]-> Control : 2: __invoke(request)
  Control -[#blue]-> User : 3: buscarPorUsername()
  Control -[#red]-> Vista : 4: usuarioInexistente()
  Control -[#red]-> Vista : 5: cuentaBloqueada()
  Control -[#blue]-> User : 6: verificarPassword()
  Control -[#red]-> User : 7: incrementarIntentosFallidos()
  Control -[#orange]-> User : 8: bloquearCuenta()
  Control -[#red]-> Vista : 9: credencialesInvalidas()
  Control -[#blue]-> User : 10: resetearIntentos()
  Control -[#black]-> Vista : 11: redirigirDashboard()
  @enduml

  ---

  CU02 — Cerrar sesión

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Usuario" as Actor #yellow
  boundary " Vista Dashboard " as Vista #FFFDE7
  control " Control Sesión " as Control #FFFDE7
  entity "Bitacora" as Bitacora #FFFDE7
  Actor --> Vista : 1: solicitarCierreSesion()
  Vista -[#black]-> Control : 2: logout()
  Control -[#blue]-> Bitacora : 3: registrar(logout)
  Control -[#black]-> Vista : 4: redirigirLogin()
  @enduml

  ---

  CU03 — Crear gestión académica

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Gestiones " as Vista #FFFDE7
  control " GestionController " as Control #FFFDE7
  entity "Gestion" as Gestion #FFFDE7
  entity "CupoCarrera" as CupoCarrera #FFFDE7
  Actor --> Vista : 1: ingresarDatosGestion()
  Vista -[#black]-> Control : 2: store(request)
  Control -[#red]-> Vista : 3: errorValidacion()
  Control -[#blue]-> Gestion : 4: create()
  Control -[#blue]-> CupoCarrera : 5: crearCuposPorCarrera()
  Control -[#black]-> Vista : 6: gestionCreada()
  @enduml

  ---

  CU04 — Configurar parámetros de gestión

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Parámetros " as Vista #FFFDE7
  control " ParametroController " as Control #FFFDE7
  entity "Gestion" as Gestion #FFFDE7
  entity "Parametro" as Parametro #FFFDE7
  Actor --> Vista : 1: abrirFormulario()
  Vista -[#black]-> Control : 2: edit(gestion)
  Control -[#blue]-> Gestion : 3: obtenerGestion()
  Control -[#blue]-> Parametro : 4: obtenerParametros()
  Control -[#black]-> Vista : 5: mostrarFormulario()
  Actor --> Vista : 6: guardarCambios()
  Vista -[#black]-> Control : 7: update(request, gestion)
  Control -[#red]-> Vista : 8: errorValidacion()
  Control -[#blue]-> Parametro : 9: upsertParametros()
  Control -[#black]-> Vista : 10: parametrosActualizados()
  @enduml

  ---

  CU05 — Registrar postulante

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Candidato" as Actor #yellow
  boundary " Vista Registro " as Vista #FFFDE7
  control " RegistroController " as Control #FFFDE7
  entity "Persona" as Persona #FFFDE7
  entity "CandidatoEstudiante" as Candidato #FFFDE7
  Actor --> Vista : 1: completarFormulario()
  Vista -[#black]-> Control : 2: storeCandidatoEstudiante(request)
  Control -[#red]-> Vista : 3: errorValidacion()
  Control -[#blue]-> Persona : 4: firstOrCreate()
  Control -[#blue]-> Candidato : 5: create()
  Control -[#black]-> Control : 6: enviarSolicitudRecibida()
  Control -[#black]-> Vista : 7: registroExitoso()
  @enduml

  ---

  CU06 — Verificar documentación obligatoria

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Candidato" as Actor #yellow
  boundary " Portal Candidato " as Vista #FFFDE7
  control " PortalCandidatoController " as Control #FFFDE7
  entity "CandidatoEstudiante" as Candidato #FFFDE7
  entity "RequisitoEstudiante" as Requisito #FFFDE7
  Actor --> Vista : 1: accederConToken()
  Vista -[#black]-> Control : 2: show(token)
  Control -[#blue]-> Candidato : 3: buscarPorToken()
  Control -[#red]-> Vista : 4: tokenInvalido()
  Control -[#black]-> Vista : 5: mostrarPortal()
  Actor --> Vista : 6: subirDocumento()
  Vista -[#black]-> Control : 7: subir(token, codigo)
  Control -[#blue]-> Requisito : 8: guardarArchivoRequisito()
  Control -[#black]-> Vista : 9: documentoSubido()
  Actor --> Vista : 10: enviarSolicitud()
  Vista -[#black]-> Control : 11: enviar(token)
  Control -[#red]-> Vista : 12: documentosFaltantes()
  Control -[#blue]-> Candidato : 13: actualizarEstado(en_revision)
  Control -[#black]-> Vista : 14: solicitudEnviada()
  @enduml

  ---

  CU07 — Gestionar postulante

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Admisión " as Vista #FFFDE7
  control " AdmisionController " as Control #FFFDE7
  entity "CandidatoEstudiante" as Candidato #FFFDE7
  entity "RequisitoEstudiante" as Requisito #FFFDE7
  Actor --> Vista : 1: seleccionarCandidato()
  Vista -[#black]-> Control : 2: revisarCandidatoEstudiante(candidato)
  Control -[#blue]-> Candidato : 3: obtenerConRequisitos()
  Control -[#black]-> Vista : 4: mostrarRevision()
  Actor --> Vista : 5: revisarRequisito()
  Vista -[#black]-> Control : 6: aprobarRequisito() / rechazarRequisito()
  Control -[#blue]-> Requisito : 7: actualizarEstado()
  Actor --> Vista : 8: aprobarCandidato()
  Vista -[#black]-> Control : 9: aprobarCandidatoEstudiante(candidato)
  Control -[#blue]-> Candidato : 10: actualizarEstado(aprobado_pendiente_pago)
  Control -[#black]-> Vista : 11: candidatoAprobado()
  Actor --> Vista : 12: rechazarCandidato()
  Vista -[#black]-> Control : 13: rechazarCandidatoEstudiante(candidato)
  Control -[#blue]-> Candidato : 14: actualizarEstado(rechazado)
  Control -[#red]-> Vista : 15: candidatoRechazado()
  @enduml

  ---

  CU08 — Procesar pago de inscripción

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Candidato" as Actor #yellow
  boundary " Portal Pago " as Vista #FFFDE7
  control " PortalPagoController " as Control #FFFDE7
  entity "Pago" as Pago #FFFDE7
  entity "Postulacion" as Post #FFFDE7
  Actor --> Vista : 1: accederPortalPago(token)
  Vista -[#black]-> Control : 2: show(token)
  Control -[#blue]-> Post : 3: buscarPostulacion()
  Control -[#red]-> Vista : 4: pagoYaRealizado()
  Control -[#black]-> Vista : 5: mostrarFormularioPago()
  Actor --> Vista : 6: iniciarPago()
  Vista -[#black]-> Control : 7: crearPaymentIntent(token)
  Control -[#blue]-> Pago : 8: crearRegistroPendiente()
  Control -[#black]-> Vista : 9: retornarClientSecret()
  Actor --> Vista : 10: confirmarPago()
  Vista -[#black]-> Control : 11: confirmar(token, request)
  Control -[#blue]-> Pago : 12: actualizarEstado(completado)
  Control -[#blue]-> Post : 13: actualizarEstadoPago(pagado)
  Control -[#black]-> Vista : 14: pagoExitoso()
  @enduml

  ---

  CU09 — Generar comprobante de pago

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Candidato" as Actor #yellow
  boundary " Portal Pago " as Vista #FFFDE7
  control " PortalPagoController " as Control #FFFDE7
  entity "Pago" as Pago #FFFDE7
  entity "Postulacion" as Post #FFFDE7
  Actor --> Vista : 1: solicitarComprobante(token)
  Vista -[#black]-> Control : 2: comprobante(token)
  Control -[#blue]-> Post : 3: buscarPostulacionConPago()
  Control -[#red]-> Vista : 4: pagoNoProcesado()
  Control -[#blue]-> Pago : 5: obtenerDatosPago()
  Control -[#black]-> Vista : 6: generarPDF()
  @enduml

  ---

  CU10 — Calcular y generar grupos automáticamente

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Grupos " as Vista #FFFDE7
  control " GruposController " as Control #FFFDE7
  entity "Gestion" as Gestion #FFFDE7
  entity "Grupo" as Grupo #FFFDE7
  entity "Aula" as Aula #FFFDE7
  entity "Horario" as Horario #FFFDE7
  Actor --> Vista : 1: solicitarGeneracion(gestion)
  Vista -[#black]-> Control : 2: generar(gestion)
  Control -[#blue]-> Gestion : 3: contarPostulantesPagados()
  Control -[#red]-> Vista : 4: sinPostulantesPagados()
  Control -[#blue]-> Grupo : 5: crearGruposAlfabeticos()
  Control -[#blue]-> Aula : 6: buscarSlotLibre()
  Control -[#blue]-> Horario : 7: verificarConflictos()
  Control -[#blue]-> Grupo : 8: asignarAulaHorario()
  Control -[#black]-> Vista : 9: gruposGenerados()
  @enduml

  ---

  CU11 — Gestionar grupo

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Configurar Grupo " as Vista #FFFDE7
  control " GruposController " as Control #FFFDE7
  entity "Grupo" as Grupo #FFFDE7
  entity "Aula" as Aula #FFFDE7
  entity "Horario" as Horario #FFFDE7
  Actor --> Vista : 1: seleccionarGrupo()
  Vista -[#black]-> Control : 2: configurar(gestion, nombre)
  Control -[#blue]-> Grupo : 3: obtenerGrupo()
  Control -[#blue]-> Aula : 4: obtenerAulasDisponibles()
  Control -[#blue]-> Horario : 5: obtenerHorariosDisponibles()
  Control -[#black]-> Vista : 6: mostrarFormulario()
  Actor --> Vista : 7: guardarCambios()
  Vista -[#black]-> Control : 8: actualizar(request, gestion, nombre)
  Control -[#red]-> Vista : 9: conflictoAulaHorario()
  Control -[#blue]-> Grupo : 10: actualizarAulaHorario()
  Control -[#black]-> Vista : 11: grupoActualizado()
  @enduml

  ---

  CU12 — Gestionar docentes

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Docentes " as Vista #FFFDE7
  control " DocentesController " as Control #FFFDE7
  entity "Docente" as Docente #FFFDE7
  Actor --> Vista : 1: listarDocentes()
  Vista -[#black]-> Control : 2: index(request)
  Control -[#blue]-> Docente : 3: obtenerConFiltros()
  Control -[#black]-> Vista : 4: mostrarListado()
  Actor --> Vista : 5: editarDocente()
  Vista -[#black]-> Control : 6: update(request, user)
  Control -[#red]-> Vista : 7: errorValidacion()
  Control -[#blue]-> Docente : 8: actualizarDatos()
  Control -[#black]-> Vista : 9: docenteActualizado()
  Actor --> Vista : 10: cambiarEstado()
  Vista -[#black]-> Control : 11: toggleActivo(user)
  Control -[#blue]-> Docente : 12: actualizarActivo()
  Control -[#black]-> Vista : 13: estadoCambiado()
  @enduml

  ---

  CU13 — Asignar grupos a docente

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Asignación Docentes " as Vista #FFFDE7
  control " GruposController " as Control #FFFDE7
  entity "Grupo" as Grupo #FFFDE7
  entity "Docente" as Docente #FFFDE7
  Actor --> Vista : 1: abrirAsignacion(gestion)
  Vista -[#black]-> Control : 2: docentes(gestion)
  Control -[#blue]-> Grupo : 3: obtenerGrupos()
  Control -[#blue]-> Docente : 4: obtenerDocentes()
  Control -[#black]-> Vista : 5: mostrarFormulario()
  Actor --> Vista : 6: asignarManualmente()
  Vista -[#black]-> Control : 7: asignarDocentes(request, gestion)
  Control -[#red]-> Vista : 8: conflictoHorario()
  Control -[#blue]-> Grupo : 9: sincronizarDocentes()
  Control -[#black]-> Vista : 10: asignacionGuardada()
  Actor --> Vista : 11: autoAsignar()
  Vista -[#black]-> Control : 12: autoAsignarDocentes(gestion)
  Control -[#blue]-> Docente : 13: asignarPorEspecialidad()
  Control -[#black]-> Vista : 14: asignacionAutomatica()
  @enduml

  ---

  CU14 — Registrar calificaciones

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Calificaciones " as Vista #FFFDE7
  control " CalificacionesController " as Control #FFFDE7
  entity "Grupo" as Grupo #FFFDE7
  entity "Evaluacion" as Eval #FFFDE7
  Actor --> Vista : 1: seleccionarGrupo()
  Vista -[#black]-> Control : 2: calificar(grupo)
  Control -[#blue]-> Grupo : 3: obtenerEstudiantes()
  Control -[#blue]-> Eval : 4: obtenerEvaluaciones()
  Control -[#black]-> Vista : 5: mostrarPlanilla()
  Actor --> Vista : 6: ingresarNotas()
  Vista -[#black]-> Control : 7: guardar(request, grupo)
  Control -[#red]-> Vista : 8: errorValidacion()
  Control -[#blue]-> Eval : 9: upsertEvaluaciones()
  Control -[#black]-> Vista : 10: calificacionesGuardadas()

● CU15 — Calcular resultados del CUP

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Resultados CUP " as Vista #FFFDE7
  control " CalificacionesController " as Control #FFFDE7
  control " CalcularNotasPostulacion " as Accion #FFFDE7
  entity "Postulacion" as Post #FFFDE7
  entity "Evaluacion" as Eval #FFFDE7
  Actor --> Vista : 1: consultarResultados()
  Vista -[#black]-> Control : 2: ponderadas(request)
  Control -[#blue]-> Post : 3: obtenerPostulaciones()
  Control -[#blue]-> Accion : 4: __invoke(postulacion)
  Accion -[#blue]-> Eval : 5: obtenerEvaluaciones()
  Accion -[#blue]-> Post : 6: calcularPromedioPonderado()
  Control -[#orange]-> Post : 7: determinarEstado()
  Control -[#black]-> Vista : 8: mostrarResultados()
  @enduml

  ---

  CU16 — Ejecutar proceso de admisión

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Proceso Admisión " as Vista #FFFDE7
  control " ProcesoAdmisionController " as Control #FFFDE7
  control " EjecutarProcesoAdmision " as Accion #FFFDE7
  entity "Postulacion" as Post #FFFDE7
  entity "CupoCarrera" as Cupo #FFFDE7
  Actor --> Vista : 1: verRanking(gestion)
  Vista -[#black]-> Control : 2: show(request, gestion)
  Control -[#blue]-> Post : 3: obtenerRankingPorPromedio()
  Control -[#black]-> Vista : 4: mostrarRanking()
  Actor --> Vista : 5: ejecutarAdmision()
  Vista -[#black]-> Control : 6: ejecutar(gestion, accion)
  Control -[#blue]-> Accion : 7: __invoke(gestion)
  Accion -[#blue]-> Post : 8: calcularPromediosYValidarMinimo()
  Accion -[#blue]-> Cupo : 9: verificarCuposDisponibles()
  Accion -[#blue]-> Post : 10: asignarCarreras()
  Accion -[#orange]-> Post : 11: actualizarEstadoAdmision()
  Control -[#black]-> Vista : 12: admisionEjecutada()
  @enduml

  ---

  CU17 — Generar reporte con filtros dinámicos

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Reportes " as Vista #FFFDE7
  control " ReporteController " as Control #FFFDE7
  control " AbstractReport " as Reporte #FFFDE7
  Actor --> Vista : 1: seleccionarReporte()
  Vista -[#black]-> Control : 2: index(request)
  Control -[#blue]-> Control : 3: resolverDesdeRegistry()
  Control -[#red]-> Vista : 4: reporteNoEncontrado()
  Control -[#blue]-> Reporte : 5: run(params)
  Reporte -[#blue]-> Reporte : 6: aplicarFiltros()
  Control -[#black]-> Vista : 7: mostrarTablaResultados()
  @enduml

  ---

  CU18 — Exportar reporte

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Reportes " as Vista #FFFDE7
  control " ReporteController " as Control #FFFDE7
  control " AbstractReport " as Reporte #FFFDE7
  Actor --> Vista : 1: solicitarExportacion()
  Vista -[#black]-> Control : 2: exportarCsv(request)
  Control -[#blue]-> Reporte : 3: run(params)
  Control -[#red]-> Vista : 4: sinDatosParaExportar()
  Control -[#black]-> Vista : 5: descargarCSV()
  Vista -[#black]-> Control : 6: exportarPdf(request)
  Control -[#blue]-> Reporte : 7: run(params)
  Control -[#black]-> Vista : 8: generarPDF()
  @enduml

  ---

  CU19 — Consultar reporte por voz con IA

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Asistente IA " as Vista #FFFDE7
  control " ReporteIAController " as Control #FFFDE7
  control " AsistenteReportes " as Asistente #FFFDE7
  Actor --> Vista : 1: ingresarConsulta()
  Vista -[#black]-> Control : 2: consultar(request, asistente)
  Control -[#blue]-> Asistente : 3: __invoke(query)
  Asistente -[#blue]-> Asistente : 4: interpretarLenguajeNatural()
  Asistente -[#black]-> Control : 5: retornarResultados()
  Control -[#red]-> Vista : 6: consultaSinResultados()
  Control -[#black]-> Vista : 7: mostrarRespuestaIA()
  @enduml

  ---

  CU20 — Enviar notificaciones automáticas

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Evento de Estado " as Vista #FFFDE7
  control " AdmisionController " as Control #FFFDE7
  entity "CandidatoEstudiante" as Candidato #FFFDE7
  entity "Mailable" as Mail #FFFDE7
  Actor --> Vista : 1: registrarCandidato()
  Vista -[#black]-> Control : 2: storeCandidatoEstudiante()
  Control -[#black]-> Mail : 3: SolicitudEstudianteRecibida()
  Actor --> Vista : 4: aprobarCandidato()
  Vista -[#black]-> Control : 5: aprobarCandidatoEstudiante()
  Control -[#blue]-> Candidato : 6: actualizarEstado(aprobado_pendiente_pago)
  Control -[#black]-> Mail : 7: EstudianteAprobadoConPago()
  Actor --> Vista : 8: rechazarCandidato()
  Vista -[#black]-> Control : 9: rechazarCandidatoEstudiante()
  Control -[#red]-> Mail : 10: CandidatoRechazadoDefinitivamente()
  Actor --> Vista : 11: solicitarCorrecciones()
  Vista -[#black]-> Control : 12: solicitarCorreccionesEstudiante()
  Control -[#orange]-> Mail : 13: RequisitosRequierenCorreccion()
  @enduml

  ---

  CU21 — Gestionar roles y permisos

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Roles " as Vista #FFFDE7
  control " RolesController " as Control #FFFDE7
  entity "Rol" as Rol #FFFDE7
  entity "Permiso" as Permiso #FFFDE7
  Actor --> Vista : 1: listarRoles()
  Vista -[#black]-> Control : 2: index()
  Control -[#blue]-> Rol : 3: obtenerConPermisos()
  Control -[#black]-> Vista : 4: mostrarListado()
  Actor --> Vista : 5: crearOEditarRol()
  Vista -[#black]-> Control : 6: store(request) / update(request, rol)
  Control -[#red]-> Vista : 7: errorValidacion()
  Control -[#blue]-> Rol : 8: createOrUpdate()
  Control -[#blue]-> Permiso : 9: sincronizarPermisos()
  Control -[#black]-> Vista : 10: rolGuardado()
  Actor --> Vista : 11: eliminarRol()
  Vista -[#black]-> Control : 12: destroy(rol)
  Control -[#red]-> Vista : 13: esDeSistema()
  Control -[#blue]-> Rol : 14: delete()
  Control -[#black]-> Vista : 15: rolEliminado()
  @enduml

  ---

  CU22 — Consultar bitácora de auditoría

  @startuml
  left to right direction
  skinparam ArrowThickness 2
  actor "Administrador" as Actor #yellow
  boundary " Vista Bitácora " as Vista #FFFDE7
  control " BitacoraController " as Control #FFFDE7
  entity "Bitacora" as Bitacora #FFFDE7
  entity "BitacoraDetalle" as Detalle #FFFDE7
  Actor --> Vista : 1: abrirBitacora()
  Vista -[#black]-> Control : 2: index(request)
  Control -[#blue]-> Bitacora : 3: filtrarRegistros()
  Control -[#blue]-> Detalle : 4: cargarCambios()
  Control -[#black]-> Vista : 5: mostrarRegistros()
  Actor --> Vista : 6: aplicarFiltros()
  Vista -[#black]-> Control : 7: index(request)
  Control -[#blue]-> Bitacora : 8: filtrarPorAccion()
  Control -[#blue]-> Bitacora : 9: filtrarPorModulo()
  Control -[#blue]-> Bitacora : 10: filtrarPorUsuario()
  Control -[#blue]-> Bitacora : 11: filtrarPorFechas()
  Control -[#black]-> Vista : 12: actualizarListado()
  @enduml
