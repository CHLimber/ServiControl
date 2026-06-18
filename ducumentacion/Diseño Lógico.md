## Diseño Lógico

### Diccionario de Datos

**Tabla: rol**

_Roles del sistema que agrupan permisos de acceso._

| **Campo**   | **Tipo**    | **Nulo** | **PK / FK** | **Descripción**               |
| ----------- | ----------- | -------- | ----------- | ----------------------------- |
| id          | Entero      | No       | PK          | Identificador único del rol   |
| nombre      | Texto (50)  | No       | —           | Nombre único del rol          |
| descripcion | Texto largo | Sí       | —           | Descripción detallada del rol |

**Tabla: permiso**

_Permisos individuales que pueden asignarse a roles._

| **Campo**   | **Tipo**    | **Nulo** | **PK / FK** | **Descripción**                     |
| ----------- | ----------- | -------- | ----------- | ----------------------------------- |
| id          | Entero      | No       | PK          | Identificador único del permiso     |
| nombre      | Texto (100) | No       | —           | Nombre único del permiso            |
| descripcion | Texto largo | Sí       | —           | Descripción de la acción habilitada |

**Tabla: rol_permiso**

_Tabla pivote que asocia roles con permisos (relación N:M)._

| **Campo**  | **Tipo** | **Nulo** | **PK / FK**      | **Descripción**       |
| ---------- | -------- | -------- | ---------------- | --------------------- |
| id_rol     | Entero   | No       | PK, FK → rol     | Referencia al rol     |
| id_permiso | Entero   | No       | PK, FK → permiso | Referencia al permiso |

**Tabla: usuario**

_Cuentas de acceso al sistema, vinculadas a un empleado y un rol._

| **Campo**           | **Tipo**       | **Nulo** | **PK / FK**   | **Descripción**                                   |
| ------------------- | -------------- | -------- | ------------- | ------------------------------------------------- |
| id                  | Entero         | No       | PK            | Identificador único del usuario                   |
| id_rol              | Entero         | No       | FK → rol      | Rol asignado al usuario                           |
| id_empleado         | Entero         | No       | FK → empleado | Empleado al que pertenece la cuenta               |
| username            | Texto (50)     | No       | —             | Nombre de usuario único para login                |
| password            | Texto (255)    | No       | —             | Contraseña cifrada con bcrypt                     |
| email               | Texto (100)    | Sí       | —             | Correo electrónico del usuario                    |
| estado              | Booleano       | Sí       | —             | Indica si la cuenta está activa                   |
| ultimo_acceso       | Fecha y hora   | Sí       | —             | Fecha y hora del último inicio de sesión          |
| ultima_salida       | Fecha y hora   | Sí       | —             | Fecha y hora del último cierre de sesión          |
| fecha_creacion      | Fecha y hora   | Sí       | —             | Fecha de creación de la cuenta                    |
| fecha_actualizacion | Fecha y hora   | Sí       | —             | Fecha de última modificación                      |
| intentos_fallidos   | Entero pequeño | No       | —             | Contador de intentos de login fallidos            |
| bloqueado_hasta     | Fecha y hora   | Sí       | —             | Fecha hasta la que la cuenta permanece bloqueada  |
| veces_bloqueado     | Entero pequeño | No       | —             | Número total de veces que fue bloqueada la cuenta |

**Tabla: entidad**

_Representa personas naturales o jurídicas (clientes, empleados, proveedores)._

| **Campo**      | **Tipo**     | **Nulo** | **PK / FK** | **Descripción**                                |
| -------------- | ------------ | -------- | ----------- | ---------------------------------------------- |
| id             | Entero       | No       | PK          | Identificador único de la entidad              |
| nombre         | Texto (150)  | No       | —           | Nombre completo o razón social                 |
| tipo           | Enumerado    | No       | —           | Tipo de entidad: natural o juridica            |
| email          | Texto (100)  | Sí       | —           | Correo electrónico de contacto                 |
| cliente        | Booleano     | Sí       | —           | Indica si la entidad actúa como cliente        |
| empleado       | Booleano     | Sí       | —           | Indica si la entidad actúa como empleado       |
| fecha_registro | Fecha y hora | Sí       | —           | Fecha en que se registró la entidad            |
| estado         | Booleano     | Sí       | —           | Indica si la entidad está activa en el sistema |

**Tabla: entidad_natural**

_Datos específicos de personas naturales (extensión de entidad)._

| **Campo**        | **Tipo**   | **Nulo** | **PK / FK**      | **Descripción**               |
| ---------------- | ---------- | -------- | ---------------- | ----------------------------- |
| id_entidad       | Entero     | No       | PK, FK → entidad | Referencia a la entidad base  |
| ci               | Texto (20) | No       | —                | Número de cédula de identidad |
| sexo             | Texto (1)  | Sí       | —                | Sexo: M o F                   |
| fecha_nacimiento | Fecha      | Sí       | —                | Fecha de nacimiento           |

**Tabla: entidad_juridica**

_Datos específicos de personas jurídicas (extensión de entidad)._

| **Campo**        | **Tipo**    | **Nulo** | **PK / FK**      | **Descripción**                     |
| ---------------- | ----------- | -------- | ---------------- | ----------------------------------- |
| id_entidad       | Entero      | No       | PK, FK → entidad | Referencia a la entidad base        |
| nit              | Texto (20)  | Sí       | —                | Número de identificación tributaria |
| nombre_comercial | Texto (150) | Sí       | —                | Nombre comercial de la empresa      |
| razon_social     | Texto (200) | No       | —                | Razón social oficial                |

**Tabla: empleado**

_Empleados de la empresa, vinculados a una entidad y un cargo._

| **Campo**      | **Tipo**     | **Nulo** | **PK / FK**  | **Descripción**                   |
| -------------- | ------------ | -------- | ------------ | --------------------------------- |
| id             | Entero       | No       | PK           | Identificador único del empleado  |
| id_entidad     | Entero       | No       | FK → entidad | Datos personales del empleado     |
| id_cargo       | Entero       | Sí       | FK → cargo   | Cargo o puesto que ocupa          |
| estado         | Booleano     | Sí       | —            | Indica si el empleado está activo |
| fecha_creacion | Fecha y hora | Sí       | —            | Fecha de registro del empleado    |

**Tabla: establecimiento**

_Ubicaciones físicas de los clientes donde se instalan sistemas._

| **Campo**               | **Tipo**     | **Nulo** | **PK / FK**               | **Descripción**                          |
| ----------------------- | ------------ | -------- | ------------------------- | ---------------------------------------- |
| id                      | Entero       | No       | PK                        | Identificador único del establecimiento  |
| id_entidad              | Entero       | Sí       | FK → entidad              | Cliente dueño del establecimiento        |
| id_municipio            | Entero       | Sí       | FK → municipio            | Municipio donde se ubica                 |
| id_tipo_establecimiento | Entero       | Sí       | FK → tipo_establecimiento | Tipo de establecimiento                  |
| direccion               | Texto (255)  | Sí       | —                         | Dirección física del establecimiento     |
| estado                  | Booleano     | Sí       | —                         | Indica si el establecimiento está activo |
| fecha_creacion          | Fecha y hora | Sí       | —                         | Fecha de registro                        |

**Tabla: sistema**

_Sistemas de seguridad electrónica instalados en establecimientos._

| **Campo**           | **Tipo**     | **Nulo** | **PK / FK**          | **Descripción**                             |
| ------------------- | ------------ | -------- | -------------------- | ------------------------------------------- |
| id                  | Entero       | No       | PK                   | Identificador único del sistema             |
| id_establecimiento  | Entero       | No       | FK → establecimiento | Establecimiento donde se instaló el sistema |
| id_tipo_sistema     | Entero       | No       | FK → tipo_sistema    | Tipo de sistema de seguridad                |
| nombre              | Texto (150)  | Sí       | —                    | Nombre descriptivo del sistema              |
| tiene_mantenimiento | Booleano     | Sí       | —                    | Indica si requiere mantenimiento periódico  |
| periodicidad_dias   | Entero       | Sí       | —                    | Días de intervalo entre mantenimientos      |
| estado              | Booleano     | Sí       | —                    | Indica si el sistema está activo            |
| fecha_creacion      | Fecha y hora | Sí       | —                    | Fecha de registro del sistema               |

**Tabla: producto**

_Catálogo de productos e insumos utilizados en proyectos y órdenes._

| **Campo**     | **Tipo**    | **Nulo** | **PK / FK**    | **Descripción**                        |
| ------------- | ----------- | -------- | -------------- | -------------------------------------- |
| id            | Entero      | No       | PK             | Identificador único del producto       |
| id_categoria  | Entero      | No       | FK → categoria | Categoría a la que pertenece           |
| codigo        | Texto (20)  | No       | —              | Código único de identificación         |
| nombre        | Texto (150) | No       | —              | Nombre del producto                    |
| unidad_medida | Texto (30)  | No       | —              | Unidad de medida (unidad, metro, etc.) |
| descripcion   | Texto largo | Sí       | —              | Descripción detallada del producto     |
| estado        | Booleano    | Sí       | —              | Indica si el producto está disponible  |

**Tabla: proveedor**

_Proveedores de productos e insumos para la empresa._

| **Campo**      | **Tipo**     | **Nulo** | **PK / FK** | **Descripción**                     |
| -------------- | ------------ | -------- | ----------- | ----------------------------------- |
| id             | Entero       | No       | PK          | Identificador único del proveedor   |
| nombre         | Texto (150)  | No       | —           | Nombre o razón social del proveedor |
| email          | Texto (100)  | Sí       | —           | Correo electrónico de contacto      |
| direccion      | Texto (255)  | Sí       | —           | Dirección física                    |
| departamento   | Enumerado    | Sí       | —           | Departamento donde opera            |
| estado         | Booleano     | Sí       | —           | Indica si el proveedor está activo  |
| fecha_registro | Fecha y hora | Sí       | —           | Fecha de registro del proveedor     |

**Tabla: cotizacion**

_Presupuestos elaborados para clientes antes de iniciar un proyecto._

| **Campo**           | **Tipo**       | **Nulo** | **PK / FK**   | **Descripción**                                      |
| ------------------- | -------------- | -------- | ------------- | ---------------------------------------------------- |
| id                  | Entero         | No       | PK            | Identificador único de la cotización                 |
| codigo              | Texto (20)     | No       | —             | Código único de la cotización                        |
| id_entidad          | Entero         | No       | FK → entidad  | Cliente al que se dirige la cotización               |
| id_servicio         | Entero         | No       | FK → servicio | Servicio cotizado                                    |
| id_usuario          | Entero         | No       | FK → usuario  | Usuario que elaboró la cotización                    |
| id_sistema          | Entero         | No       | FK → sistema  | Sistema de seguridad involucrado                     |
| estado              | Enumerado      | Sí       | —             | Estado: borrador, enviada, aprobada, rechazada, etc. |
| subtotal_productos  | Decimal (12,2) | Sí       | —             | Subtotal del costo de productos                      |
| mano_de_obra        | Decimal (12,2) | Sí       | —             | Costo de mano de obra                                |
| vigencia_dias       | Entero         | Sí       | —             | Días de validez de la cotización                     |
| observacion         | Texto largo    | Sí       | —             | Observaciones adicionales                            |
| fecha_creacion      | Fecha y hora   | Sí       | —             | Fecha de creación                                    |
| fecha_actualizacion | Fecha y hora   | Sí       | —             | Fecha de última modificación                         |

**Tabla: cotizacion_detalle**

_Líneas de detalle de productos incluidos en una cotización._

| **Campo**       | **Tipo**       | **Nulo** | **PK / FK**     | **Descripción**                        |
| --------------- | -------------- | -------- | --------------- | -------------------------------------- |
| id              | Entero         | No       | PK              | Identificador único del detalle        |
| id_cotizacion   | Entero         | No       | FK → cotizacion | Cotización a la que pertenece          |
| id_producto     | Entero         | No       | FK → producto   | Producto incluido en la cotización     |
| id_proveedor    | Entero         | No       | FK → proveedor  | Proveedor del producto                 |
| cantidad        | Decimal (10,2) | No       | —               | Cantidad solicitada                    |
| precio_unitario | Decimal (12,2) | No       | —               | Precio por unidad                      |
| subtotal        | Decimal (12,2) | No       | —               | Subtotal calculado (cantidad × precio) |
| observacion     | Texto largo    | Sí       | —               | Observación sobre el ítem              |

**Tabla: proyecto**

_Proyectos de instalación de sistemas de seguridad._

| **Campo**           | **Tipo**     | **Nulo** | **PK / FK**          | **Descripción**                      |
| ------------------- | ------------ | -------- | -------------------- | ------------------------------------ |
| id                  | Entero       | No       | PK                   | Identificador único del proyecto     |
| codigo              | Texto (20)   | No       | —                    | Código único del proyecto            |
| id_entidad          | Entero       | No       | FK → entidad         | Cliente del proyecto                 |
| id_establecimiento  | Entero       | No       | FK → establecimiento | Establecimiento donde se ejecuta     |
| id_servicio         | Entero       | No       | FK → servicio        | Tipo de servicio del proyecto        |
| id_estado_proyecto  | Entero       | No       | FK → estado_proyecto | Estado actual del proyecto           |
| id_usuario          | Entero       | No       | FK → usuario         | Usuario responsable del proyecto     |
| id_cotizacion       | Entero       | Sí       | FK → cotizacion      | Cotización origen del proyecto       |
| id_sistema          | Entero       | No       | FK → sistema         | Sistema de seguridad vinculado       |
| titulo              | Texto (200)  | No       | —                    | Título descriptivo del proyecto      |
| descripcion         | Texto largo  | Sí       | —                    | Descripción del alcance del proyecto |
| fecha_inicio        | Fecha        | Sí       | —                    | Fecha de inicio del proyecto         |
| fecha_fin           | Fecha        | Sí       | —                    | Fecha estimada de finalización       |
| fecha_creacion      | Fecha y hora | Sí       | —                    | Fecha de creación del registro       |
| fecha_actualizacion | Fecha y hora | Sí       | —                    | Fecha de última actualización        |

**Tabla: proyecto_historial**

_Registro de cambios de estado de los proyectos._

| **Campo**          | **Tipo**     | **Nulo** | **PK / FK**          | **Descripción**                         |
| ------------------ | ------------ | -------- | -------------------- | --------------------------------------- |
| id                 | Entero       | No       | PK                   | Identificador único del registro        |
| id_proyecto        | Entero       | No       | FK → proyecto        | Proyecto al que corresponde el cambio   |
| id_estado_anterior | Entero       | Sí       | FK → estado_proyecto | Estado previo al cambio                 |
| id_estado_nuevo    | Entero       | No       | FK → estado_proyecto | Nuevo estado asignado                   |
| id_usuario         | Entero       | No       | FK → usuario         | Usuario que realizó el cambio de estado |
| fecha_cambio       | Fecha y hora | Sí       | —                    | Fecha y hora del cambio                 |
| observacion        | Texto largo  | Sí       | —                    | Observación o motivo del cambio         |

**Tabla: orden_trabajo**

_Órdenes de trabajo asignadas a técnicos para ejecutar en un proyecto._

| **Campo**           | **Tipo**     | **Nulo** | **PK / FK**       | **Descripción**                       |
| ------------------- | ------------ | -------- | ----------------- | ------------------------------------- |
| id                  | Entero       | No       | PK                | Identificador único de la orden       |
| codigo              | Texto (20)   | No       | —                 | Código único de la orden de trabajo   |
| id_proyecto         | Entero       | No       | FK → proyecto     | Proyecto al que pertenece la orden    |
| id_servicio         | Entero       | No       | FK → servicio     | Tipo de servicio a ejecutar           |
| id_estado_orden     | Entero       | No       | FK → estado_orden | Estado actual de la orden             |
| id_usuario          | Entero       | No       | FK → usuario      | Usuario que creó la orden             |
| descripcion         | Texto largo  | Sí       | —                 | Descripción del trabajo a realizar    |
| fecha_ejecucion     | Fecha        | Sí       | —                 | Fecha programada de ejecución         |
| tiempo_estimado     | Entero       | Sí       | —                 | Tiempo estimado de ejecución en horas |
| observaciones       | Texto largo  | Sí       | —                 | Observaciones adicionales             |
| fecha_creacion      | Fecha y hora | Sí       | —                 | Fecha de creación de la orden         |
| fecha_actualizacion | Fecha y hora | Sí       | —                 | Fecha de última modificación          |

**Tabla: orden_empleado**

_Tabla pivote que asigna empleados a órdenes de trabajo (N:M)._

| **Campo**        | **Tipo** | **Nulo** | **PK / FK**            | **Descripción**                               |
| ---------------- | -------- | -------- | ---------------------- | --------------------------------------------- |
| id_orden_trabajo | Entero   | No       | PK, FK → orden_trabajo | Orden de trabajo asignada                     |
| id_empleado      | Entero   | No       | PK, FK → empleado      | Empleado asignado                             |
| es_responsable   | Booleano | Sí       | —                      | Indica si el empleado es el responsable líder |

**Tabla: orden_producto**

_Tabla pivote que registra productos asignados a órdenes de trabajo._

| **Campo**         | **Tipo**       | **Nulo** | **PK / FK**            | **Descripción**                       |
| ----------------- | -------------- | -------- | ---------------------- | ------------------------------------- |
| id_orden_trabajo  | Entero         | No       | PK, FK → orden_trabajo | Orden de trabajo asociada             |
| id_producto       | Entero         | No       | PK, FK → producto      | Producto asignado                     |
| cantidad_asignada | Decimal (10,2) | No       | —                      | Cantidad de producto asignada         |
| cantidad_usada    | Decimal (10,2) | Sí       | —                      | Cantidad realmente utilizada          |
| observacion       | Texto largo    | Sí       | —                      | Observación sobre el uso del producto |

**Tabla: mantenimiento**

_Registros de mantenimientos preventivos y correctivos de sistemas._

| **Campo**              | **Tipo**     | **Nulo** | **PK / FK**        | **Descripción**                                   |
| ---------------------- | ------------ | -------- | ------------------ | ------------------------------------------------- |
| id                     | Entero       | No       | PK                 | Identificador único del mantenimiento             |
| id_sistema             | Entero       | No       | FK → sistema       | Sistema al que corresponde el mantenimiento       |
| id_orden_trabajo       | Entero       | Sí       | FK → orden_trabajo | Orden de trabajo asociada al mantenimiento        |
| id_usuario             | Entero       | Sí       | FK → usuario       | Usuario responsable del mantenimiento             |
| tipo                   | Enumerado    | No       | —                  | Tipo: preventivo o correctivo                     |
| fecha_programada       | Fecha        | No       | —                  | Fecha programada para el mantenimiento            |
| periodicidad_dias      | Entero       | Sí       | —                  | Intervalo en días para el siguiente mantenimiento |
| estado                 | Enumerado    | Sí       | —                  | Estado: pendiente, confirmado, completado, etc.   |
| creado_automaticamente | Booleano     | Sí       | —                  | Indica si fue generado por el sistema             |
| fecha_creacion         | Fecha y hora | Sí       | —                  | Fecha de registro                                 |

**Tabla: alerta_mantenimiento**

_Alertas generadas para notificar mantenimientos próximos._

| **Campo**          | **Tipo**     | **Nulo** | **PK / FK**          | **Descripción**                               |
| ------------------ | ------------ | -------- | -------------------- | --------------------------------------------- |
| id                 | Entero       | No       | PK                   | Identificador único de la alerta              |
| id_mantenimiento   | Entero       | No       | FK → mantenimiento   | Mantenimiento al que corresponde la alerta    |
| id_usuario         | Entero       | No       | FK → usuario         | Usuario destinatario de la alerta             |
| id_establecimiento | Entero       | No       | FK → establecimiento | Establecimiento relacionado                   |
| fecha              | Fecha y hora | Sí       | —                    | Fecha y hora de generación de la alerta       |
| estado             | Enumerado    | Sí       | —                    | Estado: pendiente, enviada, leída, completada |
| observacion        | Texto largo  | Sí       | —                    | Observación sobre la alerta                   |

**Tabla: pago**

_Pagos registrados contra proyectos._

| **Campo**                | **Tipo**       | **Nulo** | **PK / FK**   | **Descripción**                                   |
| ------------------------ | -------------- | -------- | ------------- | ------------------------------------------------- |
| id                       | Entero         | No       | PK            | Identificador único del pago                      |
| id_proyecto              | Entero         | No       | FK → proyecto | Proyecto al que corresponde el pago               |
| id_usuario               | Entero         | No       | FK → usuario  | Usuario que registró el pago                      |
| tipo_pago                | Enumerado      | No       | —             | Tipo: anticipo, pago_parcial, pago_final, otro    |
| monto                    | Decimal (12,2) | No       | —             | Monto del pago                                    |
| fecha_pago               | Fecha          | No       | —             | Fecha en que se realizó el pago                   |
| metodo                   | Enumerado      | No       | —             | Método: efectivo, transferencia, QR, stripe, otro |
| observacion              | Texto largo    | Sí       | —             | Observaciones sobre el pago                       |
| stripe_payment_intent_id | Texto (100)    | Sí       | —             | ID del intent de pago en Stripe                   |
| stripe_status            | Texto (50)     | Sí       | —             | Estado del pago en Stripe                         |
| fecha_registro           | Fecha y hora   | Sí       | —             | Fecha de registro en el sistema                   |

**Tabla: gasto_orden**

_Gastos operativos asociados a órdenes de trabajo._

| **Campo**      | **Tipo**       | **Nulo** | **PK / FK**        | **Descripción**                            |
| -------------- | -------------- | -------- | ------------------ | ------------------------------------------ |
| id             | Entero         | No       | PK                 | Identificador único del gasto              |
| id_orden       | Entero         | No       | FK → orden_trabajo | Orden de trabajo que origina el gasto      |
| id_usuario     | Entero         | No       | FK → usuario       | Usuario que registró el gasto              |
| concepto       | Enumerado      | No       | —                  | Concepto: materiales, viáticos, transporte |
| descripcion    | Texto largo    | Sí       | —                  | Descripción del gasto                      |
| monto          | Decimal (12,2) | No       | —                  | Monto del gasto                            |
| fecha_gasto    | Fecha          | No       | —                  | Fecha en que ocurrió el gasto              |
| fecha_registro | Fecha y hora   | Sí       | —                  | Fecha de registro en el sistema            |

**Tabla: notificacion**

_Notificaciones internas del sistema para los usuarios._

| **Campo**      | **Tipo**     | **Nulo** | **PK / FK**  | **Descripción**                                     |
| -------------- | ------------ | -------- | ------------ | --------------------------------------------------- |
| id             | Entero       | No       | PK           | Identificador único de la notificación              |
| id_usuario     | Entero       | No       | FK → usuario | Usuario destinatario de la notificación             |
| titulo         | Texto (200)  | No       | —            | Título de la notificación                           |
| mensaje        | Texto largo  | No       | —            | Contenido del mensaje                               |
| tipo           | Enumerado    | No       | —            | Tipo: alerta_mant., orden_asignada, pago_reg., etc. |
| leida          | Booleano     | Sí       | —            | Indica si el usuario ya leyó la notificación        |
| url            | Texto (300)  | Sí       | —            | Enlace de navegación asociado a la notificación     |
| fecha_creacion | Fecha y hora | Sí       | —            | Fecha de creación de la notificación                |

**Tabla: bitacora**

_Registro de auditoría de todas las acciones realizadas en el sistema._

| **Campo**   | **Tipo**     | **Nulo** | **PK / FK**  | **Descripción**                                 |
| ----------- | ------------ | -------- | ------------ | ----------------------------------------------- |
| id          | Entero       | No       | PK           | Identificador único del registro de auditoría   |
| id_usuario  | Entero       | Sí       | FK → usuario | Usuario que realizó la acción (null si sistema) |
| accion      | Texto (50)   | No       | —            | Tipo de acción: LOGIN, CREATE, UPDATE, DELETE   |
| modulo      | Texto (50)   | Sí       | —            | Módulo del sistema donde ocurrió la acción      |
| descripcion | Texto largo  | Sí       | —            | Descripción detallada de la acción              |
| ip          | Texto (45)   | Sí       | —            | Dirección IP desde donde se realizó la acción   |
| fecha       | Fecha y hora | No       | —            | Fecha y hora exacta de la acción                |

**Tabla: bitacora_detalle**

_Detalle de cambios campo a campo para registros de auditoría._

| **Campo**      | **Tipo**    | **Nulo** | **PK / FK**   | **Descripción**                        |
| -------------- | ----------- | -------- | ------------- | -------------------------------------- |
| id             | Entero      | No       | PK            | Identificador único del detalle        |
| id_bitacora    | Entero      | No       | FK → bitacora | Registro de auditoría al que pertenece |
| campo          | Texto (100) | No       | —             | Nombre del campo que fue modificado    |
| valor_anterior | Texto largo | Sí       | —             | Valor del campo antes del cambio       |
| valor_nuevo    | Texto largo | Sí       | —             | Valor del campo después del cambio     |

### Descripción de Relaciones

| **Entidad A**       | **Cardinalidad** | **Entidad B**       | **Descripción**                                                                |
| ------------------- | ---------------- | ------------------- | ------------------------------------------------------------------------------ |
| Rol                 | 1 : N            | Usuario             | Un rol puede estar asignado a múltiples usuarios                               |
| Rol                 | N : M            | Permiso             | Un rol puede tener muchos permisos; un permiso puede pertenecer a varios roles |
| Entidad             | 1 : 1            | EntidadNatural      | Una entidad de tipo natural extiende sus datos en entidad_natural              |
| Entidad             | 1 : 1            | EntidadJuridica     | Una entidad de tipo jurídico extiende sus datos en entidad_juridica            |
| Entidad             | 1 : 1            | Empleado            | Una entidad puede ser también un empleado de la empresa                        |
| Entidad             | 1 : N            | Establecimiento     | Una entidad (cliente) puede tener varios establecimientos                      |
| Entidad             | 1 : N            | Cotizacion          | Un cliente puede recibir múltiples cotizaciones                                |
| Entidad             | 1 : N            | Proyecto            | Un cliente puede tener varios proyectos activos                                |
| Empleado            | 1 : 1            | Usuario             | Cada empleado tiene una cuenta de usuario en el sistema                        |
| Empleado            | N : M            | OrdenTrabajo        | Un empleado puede estar asignado a muchas órdenes y viceversa                  |
| Cargo               | 1 : N            | Empleado            | Un cargo puede ser ocupado por varios empleados                                |
| Municipio           | 1 : N            | Establecimiento     | Un municipio puede contener varios establecimientos                            |
| TipoEstablecimiento | 1 : N            | Establecimiento     | Un tipo puede clasificar varios establecimientos                               |
| TipoSistema         | 1 : N            | Sistema             | Un tipo de sistema puede aplicarse a varios sistemas                           |
| Establecimiento     | 1 : N            | Sistema             | Un establecimiento puede tener múltiples sistemas instalados                   |
| Establecimiento     | 1 : N            | AlertaMantenimiento | Un establecimiento puede generar múltiples alertas de mantenimiento            |
| Sistema             | 1 : N            | Cotizacion          | Un sistema puede estar referenciado en varias cotizaciones                     |
| Sistema             | 1 : N            | Proyecto            | Un sistema puede estar vinculado a varios proyectos                            |
| Sistema             | 1 : N            | Mantenimiento       | Un sistema puede tener múltiples registros de mantenimiento                    |
| Servicio            | 1 : N            | Cotizacion          | Un servicio puede aparecer en varias cotizaciones                              |
| Servicio            | 1 : N            | Proyecto            | Un servicio puede estar asociado a varios proyectos                            |
| Servicio            | 1 : N            | OrdenTrabajo        | Un servicio puede estar vinculado a varias órdenes de trabajo                  |
| Categoria           | 1 : N            | Producto            | Una categoría puede agrupar varios productos                                   |
| Proveedor           | 1 : N            | CotizacionDetalle   | Un proveedor puede aparecer en varios detalles de cotización                   |
| Producto            | N : M            | Cotizacion          | Un producto puede estar en varias cotizaciones; una cotización tiene varios    |
| Producto            | N : M            | OrdenTrabajo        | Un producto puede asignarse a muchas órdenes; una orden usa varios productos   |
| Cotizacion          | 1 : N            | CotizacionDetalle   | Una cotización tiene uno o más ítems de detalle                                |
| Cotizacion          | 1 : 1            | Proyecto            | Una cotización aprobada puede originar un proyecto                             |
| EstadoProyecto      | 1 : N            | Proyecto            | Un estado puede aplicarse a varios proyectos                                   |
| EstadoProyecto      | 1 : N            | ProyectoHistorial   | Un estado puede aparecer como anterior o nuevo en múltiples cambios            |
| Proyecto            | 1 : N            | ProyectoHistorial   | Un proyecto acumula múltiples registros de cambio de estado                    |
| Proyecto            | 1 : N            | OrdenTrabajo        | Un proyecto puede generar varias órdenes de trabajo                            |
| Proyecto            | 1 : N            | Pago                | Un proyecto puede tener múltiples pagos registrados                            |
| EstadoOrden         | 1 : N            | OrdenTrabajo        | Un estado puede aplicarse a varias órdenes                                     |
| EstadoOrden         | 1 : N            | OrdenHistorial      | Un estado puede aparecer en múltiples cambios de historial                     |
| OrdenTrabajo        | 1 : N            | OrdenHistorial      | Una orden acumula varios registros de cambio de estado                         |
| OrdenTrabajo        | 1 : N            | GastoOrden          | Una orden puede tener múltiples gastos asociados                               |
| OrdenTrabajo        | 1 : N            | Mantenimiento       | Una orden puede estar vinculada a varios mantenimientos                        |
| Mantenimiento       | 1 : N            | AlertaMantenimiento | Un mantenimiento puede generar varias alertas hacia distintos usuarios         |
| Usuario             | 1 : N            | Cotizacion          | Un usuario puede elaborar varias cotizaciones                                  |
| Usuario             | 1 : N            | Proyecto            | Un usuario puede gestionar varios proyectos                                    |
| Usuario             | 1 : N            | OrdenTrabajo        | Un usuario puede crear varias órdenes de trabajo                               |
| Usuario             | 1 : N            | ProyectoHistorial   | Un usuario puede registrar múltiples cambios de estado en proyectos            |
| Usuario             | 1 : N            | OrdenHistorial      | Un usuario puede registrar múltiples cambios de estado en órdenes              |
| Usuario             | 1 : N            | Mantenimiento       | Un usuario puede ser responsable de varios mantenimientos                      |
| Usuario             | 1 : N            | AlertaMantenimiento | Un usuario puede recibir múltiples alertas de mantenimiento                    |
| Usuario             | 1 : N            | Pago                | Un usuario puede registrar varios pagos                                        |
| Usuario             | 1 : N            | GastoOrden          | Un usuario puede registrar varios gastos                                       |
| Usuario             | 1 : N            | Notificacion        | Un usuario puede recibir múltiples notificaciones del sistema                  |
| Usuario             | 1 : N            | Bitacora            | Un usuario puede generar múltiples registros de auditoría                      |
| Bitacora            | 1 : N            | BitacoraDetalle     | Un registro de auditoría puede tener múltiples cambios de campo                |

### Diagrama de clases

Diseño actualizado

### Mapeo de clase

El mapeo describe cómo cada clase del diseño lógico se convierte en una o más tablas en la base de datos relacional. Las decisiones de mapeo más relevantes son las siguientes.

La herencia de Entidad se implementa con el patrón tabla por subclase: existe una tabla entidad con los atributos comunes y dos tablas hijas entidad_natural y entidad_juridica, cada una con su propia PK que referencia a entidad.id mediante FK. Esta estrategia evita columnas nulas masivas que produciría el patrón de tabla única, y mantiene la integridad diferenciando claramente los atributos de cada tipo.

La relación muchos a muchos entre Empleado y Especialidad se resuelve con la tabla intermedia empleado_especialidad. Del mismo modo, Rol y Permiso se relacionan mediante rol_permiso, y Telefono con Entidad y Proveedor mediante las tablas telefono_entidad y telefono_proveedor respectivamente.

|                         |                                                                |                                                    |
| ----------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| **Clase**               | **Tabla(s) en BD**                                             | **Estrategia**                                     |
| Entidad                 | entidad, entidad_natural, entidad_juridica                     | Herencia tabla por subclase                        |
| Empleado                | empleado                                                       | Tabla directa, FK a entidad                        |
| Empleado ↔ Especialidad | empleado_especialidad                                          | Tabla intermedia N:M                               |
| Rol ↔ Permiso           | rol_permiso                                                    | Tabla intermedia N:M                               |
| Telefono ↔ Entidad      | telefono_entidad                                               | Tabla intermedia N:M                               |
| Telefono ↔ Proveedor    | telefono_proveedor                                             | Tabla intermedia N:M                               |
| Cotizacion              | cotizacion, cotizacion_detalle                                 | Clase + tabla de líneas de detalle                 |
| Proyecto                | proyecto, proyecto_historial                                   | Clase + tabla de auditoría de estados              |
| OrdenTrabajo            | orden_trabajo, orden_historial, orden_empleado, orden_producto | Clase + 3 tablas asociadas                         |
| Mantenimiento           | mantenimiento, alerta_mantenimiento                            | Clase + tabla de alertas                           |
| Sistema                 | sistema                                                        | Tabla directa, FK a establecimiento y tipo_sistema |
| Producto                | producto, producto_proveedor                                   | Clase + tabla de precios por proveedor             |

### Normalización

El proceso de normalización garantiza que la base de datos esté libre de redundancias y anomalías de inserción, actualización y eliminación. Se aplican las tres primeras formas normales.

#### Primera Forma Normal (1FN)

Una tabla está en 1FN cuando todos sus atributos contienen valores atómicos (no multivaluados ni compuestos), existe una clave primaria y no hay grupos repetitivos.

ServiControl cumple con 1FN en todas sus tablas porque cada campo almacena un único valor indivisible. Los casos que podrían violar esta forma y cómo se resolvieron son los siguientes. Los teléfonos, que naturalmente son multivaluados (una entidad puede tener varios), no se almacenan como un campo de texto separado por comas ni como columnas telefono1, telefono2. En cambio, se extraen a la tabla telefono con una tabla de asociación telefono_entidad, garantizando atomicidad. Las especialidades de un empleado se resuelven de la misma manera con empleado_especialidad. Todas las tablas tienen PK definida: simples en los catálogos (id INT AUTO_INCREMENT) y compuestas en las tablas intermedias (por ejemplo, PRIMARY KEY (id_empleado, id_especialidad)).

#### Segunda Forma Normal (2FN)

Una tabla está en 2FN cuando está en 1FN y todos los atributos no clave dependen funcionalmente de la clave primaria completa, no de una parte de ella. Esta forma solo es relevante en tablas con claves primarias compuestas.

Las tablas intermedias de ServiControl con PK compuesta cumplen con 2FN porque sus atributos adicionales dependen de la combinación completa de la clave. Por ejemplo, producto_proveedor tiene la PK (id_producto, id_proveedor) y sus atributos precio_unitario y es_principal dependen de esa combinación específica, no solo de id_producto ni solo de id_proveedor. De forma similar, orden_producto registra cantidad_asignada y cantidad_usada que son propias del par orden-producto, no de ninguno por separado.

#### Tercera Forma Normal (3FN)

Una tabla está en 3FN cuando está en 2FN y no existen dependencias transitivas: ningún atributo no clave depende de otro atributo no clave.

Los catálogos separados son la evidencia más clara de cumplimiento con 3FN. Por ejemplo, el nombre del municipio no se almacena directamente en establecimiento (lo cual crearía una dependencia transitiva id_establecimiento → id_municipio → nombre_municipio), sino que se referencia mediante FK a la tabla municipio. El mismo principio aplica a tipo_sistema, tipo_establecimiento, tipo_documento, categoria, servicio, estado_proyecto y estado_orden, todos separados en tablas catálogo propias. El campo periodicidad_dias en la tabla mantenimiento merece mención especial: aunque también existe en sistema, su copia en mantenimiento es intencional y no viola 3FN porque se trata de un valor histórico que preserva la periodicidad vigente al momento de crear el registro, independientemente de cambios futuros en el sistema.


