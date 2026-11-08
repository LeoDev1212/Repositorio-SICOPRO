export type Role =
  | "dependencia"
  | "residente"
  | "superintendente"
  | "supervision"
  | "finanzas";

export interface Persona {
  id: number;
  nombre: string;
  rfc: string;
  telefono: string;
  correo: string;
  empresa_contratista: number | null;
  empresa_supervision: number | null;
}

export interface Contratista {
  id: number;
  nombre: string;
  rfc: string;
  representante: string;
  telefono: string;
  correo: string;
  inhabilitado: boolean;
  fecha_fin_inhabilitacion: string | null;
  motivo_inhabilitacion: string;
  inhabilitado_vigente: boolean;
}

export interface EmpresaSupervision {
  id: number;
  nombre: string;
  rfc: string;
  representante: string;
  telefono: string;
  correo: string;
}

export type AssignablePersonaRole = "residente" | "superintendente" | "supervision";

export interface PersonaCreatePayload {
  nombre: string;
  rfc: string;
  telefono: string;
  correo: string;
  empresa_contratista?: number;
  empresa_supervision?: number;
  crear_usuario?: boolean;
  role?: AssignablePersonaRole;
}

export interface PersonaCreateResponse extends Persona {
  user: number | null;
  temp_password?: string | null;
}

export interface Me {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  initials: string;
  persona: Persona | null;
}

export type ContractStatus = "registrado" | "activo" | "en_cierre" | "cerrado";

export interface Contract {
  id: number;
  no_contrato: string;
  monto: string;
  objeto: string;
  descripcion: string;
  plazo_dias: number;
  fecha_inicio: string;
  fecha_termino: string;
  ubicacion: string;
  es_retroactivo: boolean;
  status: ContractStatus;
  contratista: number;
  contratista_detalle: Contratista;
  empresa_supervision: number | null;
  empresa_supervision_detalle: EmpresaSupervision | null;
  residente: number;
  residente_detalle: Persona;
  supervisor: number | null;
  supervisor_detalle: Persona | null;
  superintendente: number | null;
  superintendente_detalle: Persona | null;
  creado_por: number;
  fecha_creacion: string;
  fecha_activacion: string | null;
  monto_vigente: string;
  plazo_vigente_dias: number;
  fecha_termino_vigente: string;
  fondo_garantia_acumulado: string;
}

export interface ConceptoCatalogo {
  id: number;
  contrato: number;
  clave: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  precio_unitario: string;
  importe: string;
  no_sujeto_ajuste_costos: boolean;
  numero_generador: string;
  cantidad_vigente: string;
}

export type ConvenioTipo =
  | "ampliacion_cantidad"
  | "ampliacion_monto"
  | "ampliacion_plazo"
  | "mixto";

export type ConvenioStatus = "borrador" | "aprobado" | "rechazado";

export interface ConvenioModificatorioConcepto {
  id: number;
  convenio: number;
  concepto: number;
  cantidad_delta: string;
}

export interface ConvenioModificatorio {
  id: number;
  contrato: number;
  contrato_no: string;
  numero: number;
  tipo: ConvenioTipo;
  justificacion: string;
  monto_delta: string;
  dias_delta: number;
  documento: string | null;
  formato: string;
  tamano: number;
  hash_sha256: string;
  status: ConvenioStatus;
  motivo_rechazo: string;
  creado_por: number;
  aprobado_por: number | null;
  fecha_aprobacion: string | null;
  fecha_creacion: string;
  conceptos: ConvenioModificatorioConcepto[];
}

export interface BulkUploadResult {
  creados: number;
  suma_importes: string;
  monto_contrato: string;
  coincide_monto: boolean;
}

export interface ProgramaConceptoMes {
  id: number;
  concepto: number;
  mes: number;
  cantidad_programada: string;
}

export type GarantiaTipo = "cumplimiento" | "anticipo" | "vicios_ocultos";
export type GarantiaEstado = "vigente" | "por_vencer" | "vencida";

export interface Garantia {
  id: number;
  contrato: number;
  tipo: GarantiaTipo;
  numero_fianza: string;
  institucion_afianzadora: string;
  monto: string;
  porcentaje_cobertura: string;
  fecha_emision: string;
  fecha_vigencia: string;
  dias_alerta: number[];
  estado: GarantiaEstado;
}

export interface Anticipo {
  id: number;
  contrato: number;
  monto_otorgado: string;
  porcentaje_retencion_por_estimacion: string;
  monto_amortizado: string;
  saldo_pendiente: string;
}

export type DocumentBloque =
  | "catalogo"
  | "programa"
  | "garantias"
  | "amortizacion"
  | "juridico"
  | "contrato";

export type DocumentEstado = "vigente" | "sustituido";

export interface ContractDocument {
  id: number;
  contrato: number;
  bloque: DocumentBloque;
  nombre: string;
  archivo: string;
  formato: string;
  tamano: number;
  hash_sha256: string;
  estado: DocumentEstado;
  version_anterior: number | null;
  subido_por: number;
  ip_origen: string | null;
  fecha_carga: string;
}

export type EstimacionStatus =
  | "borrador"
  | "en_revision_residente"
  | "rechazada_residente"
  | "aprobada_residente"
  | "pendiente_firma"
  | "firmada";

export interface Firma {
  id: number;
  firmante: number;
  firmante_nombre: string;
  rol: string;
  fecha_firma: string;
}

export interface Estimacion {
  id: number;
  contrato: number;
  numero: number;
  mes_programa: number;
  periodo_inicio: string;
  periodo_fin: string;
  status: EstimacionStatus;
  pagada: boolean;
  iva_tasa: string;
  porcentaje_fondo_garantia: string;
  porcentaje_cinco_al_millar: string;
  penalizaciones: string;
  motivo_penalizacion: string;
  otras_deducciones: string;
  motivo_otras_deducciones: string;
  motivo_rechazo: string;
  creado_por: number;
  fecha_presentacion: string | null;
  fecha_decision_residente: string | null;
  fecha_notificacion_dependencia: string | null;
  fecha_firma_completa: string | null;
  fecha_creacion: string;
  subtotal: string;
  iva: string;
  importe_bruto: string;
  amortizacion_anticipo: string;
  fondo_garantia: string;
  retencion_cinco_al_millar: string;
  importe_neto: string;
  firmas: Firma[];
}

export type EstimacionEventoTipo =
  | "presentada"
  | "aprobada_residente"
  | "rechazada_residente"
  | "firmada";

export interface EstimacionEvento {
  id: number;
  tipo: EstimacionEventoTipo;
  actor: number;
  actor_nombre: string;
  comentario: string;
  fecha: string;
}

export interface EstimacionConcepto {
  id: number;
  estimacion: number;
  concepto: number;
  cantidad_acumulada_anterior: string;
  cantidad_ejecutada: string;
  precio_unitario: string;
  importe: string;
  cantidad_acumulada: string;
  cantidad_pendiente: string;
}

export interface GeneradorElemento {
  id: number;
  estimacion_concepto: number;
  elemento: string;
  cantidad_n: string;
  largo: string | null;
  ancho: string | null;
  alto: string | null;
  parcial: string;
  observaciones: string;
  orden: number;
}

export type EvidenciaMomento = "antes" | "durante" | "despues" | "";

export interface EvidenciaFotografica {
  id: number;
  estimacion_concepto: number;
  imagen: string;
  formato: string;
  tamano: number;
  hash_sha256: string;
  momento: EvidenciaMomento;
  subido_por: number;
  ip_origen: string | null;
  fecha_carga: string;
}

export type BitacoraEstado = "abierta" | "cerrada";

export interface Bitacora {
  id: number;
  contrato: number;
  contrato_no: string;
  estado: BitacoraEstado;
  fecha_apertura: string;
  fecha_cierre: string | null;
  abierta_por: number;
  abierta_por_nombre: string;
  cerrada_por: number | null;
  cerrada_por_nombre: string | null;
  fecha_creacion: string;
}

export type NotaClasificacion =
  | "apertura"
  | "avance"
  | "modificacion"
  | "incidencia"
  | "calidad"
  | "seguridad"
  | "comunicacion"
  | "cierre";

export interface NotaBitacora {
  id: number;
  bitacora: number;
  numero: number;
  clasificacion: NotaClasificacion;
  descripcion: string;
  ubicacion: string;
  causa: string;
  solucion: string;
  prevencion: string;
  consecuencia_economica: string | null;
  responsable: string;
  fecha_atencion: string | null;
  nota_referencia: number | null;
  estimacion: number | null;
  cierre: number | null;
  autor: number;
  autor_nombre: string;
  fecha: string;
}

export type NotificacionTipo =
  | "estimacion_aprobada"
  | "estimacion_rechazada"
  | "estimacion_firmada"
  | "estimacion_pago"
  | "convenio_aprobado"
  | "convenio_rechazado"
  | "cierre_propuesta"
  | "cierre_iniciado"
  | "cierre_resolucion_rescision"
  | "cierre_finiquitado"
  | "suspension_registrada"
  | "suspension_resuelta"
  | "contratista_inhabilitado";

export interface Notificacion {
  id: number;
  tipo: NotificacionTipo;
  mensaje: string;
  enlace: string;
  leida: boolean;
  fecha_creacion: string;
}

export type SuspensionCausal = "interes_general" | "causa_justificada" | "caso_fortuito";

export interface Suspension {
  id: number;
  contrato: number;
  contrato_no: string;
  causal: SuspensionCausal;
  motivo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  es_indeterminada: boolean;
  monto_gastos_no_recuperables: string;
  registrada_por: number;
  fecha_registro: string;
  resuelta_por: number | null;
  fecha_resolucion: string | null;
  dias_suspendidos: number;
  activa: boolean;
}

export type CierreTipo =
  | "terminacion_cumplimiento"
  | "terminacion_anticipada"
  | "rescision_administrativa"
  | "rescision_judicial";

export type CierreStatus = "propuesta" | "en_proceso" | "finiquitado" | "descartado";

export interface Cierre {
  id: number;
  contrato: number;
  contrato_no: string;
  tipo: CierreTipo;
  status: CierreStatus;
  motivo: string;
  suspension_origen: number | null;
  iniciado_por: number;
  fecha_inicio: string;
  notificado_por: number | null;
  fecha_notificacion_inicio: string | null;
  estimacion_liquidacion: number | null;
  fecha_acta_entrega_recepcion: string | null;
  documento_acta_entrega: string | null;
  acta_entrega_formato: string;
  acta_entrega_tamano: number;
  acta_entrega_hash_sha256: string;
  fecha_notificacion_incumplimiento: string | null;
  alegatos_contratista: string;
  fecha_alegatos: string | null;
  se_rescinde: boolean | null;
  fecha_resolucion: string | null;
  documento_acta_circunstanciada: string | null;
  acta_circunstanciada_formato: string;
  acta_circunstanciada_tamano: number;
  acta_circunstanciada_hash_sha256: string;
  fecha_resolucion_judicial: string | null;
  monto_resolucion_judicial: string | null;
  monto_trabajos_ejecutados: string;
  monto_penas_convencionales: string;
  monto_gastos_no_recuperables: string;
  fecha_finiquito: string | null;
  documento_finiquito: string | null;
  finiquito_formato: string;
  finiquito_tamano: number;
  finiquito_hash_sha256: string;
  finiquitado_por: number | null;
  fecha_creacion: string;
  fecha_limite_alegatos: string | null;
  fecha_limite_resolucion_rescision: string | null;
  aceptada_tacitamente: boolean;
  anticipo_no_amortizado: string;
  importe_neto_finiquito: string;
}

export type CierreEventoTipo =
  | "propuesto"
  | "notificado_inicio"
  | "iniciado"
  | "acta_entrega_recepcion"
  | "liquidacion_vinculada"
  | "alegatos_recibidos"
  | "resolucion_rescision"
  | "resolucion_terminacion"
  | "resolucion_judicial_registrada"
  | "acta_circunstanciada"
  | "descartado"
  | "finiquitado";

export interface CierreEvento {
  id: number;
  tipo: CierreEventoTipo;
  actor: number;
  actor_nombre: string;
  comentario: string;
  fecha: string;
}

export interface BloqueResumen {
  label: string;
  completo: boolean;
}

export interface DocumentacionResumen {
  bloques: Record<DocumentBloque, BloqueResumen>;
  catalogo_cargado: boolean;
  garantias_registradas: boolean;
  anticipo_configurado: boolean;
  documentacion_completa: boolean;
}

export interface CurvaSPunto {
  mes: number;
  programado_acumulado: string;
  real_acumulado: string;
}

export interface SeguimientoResumen {
  meses_totales: number;
  mes_actual: number;
  resumen: {
    monto_vigente: string;
    monto_ejecutado: string;
    saldo_por_ejercer: string;
    avance_financiero_porcentaje: number;
    anticipo_otorgado: string;
    anticipo_amortizado: string;
    anticipo_pendiente: string;
    fondo_garantia_acumulado: string;
  };
  curva_s: CurvaSPunto[];
  conteo_por_estatus: Record<EstimacionStatus, number>;
}

export interface AuditoriaEvento {
  id: number;
  actor: number | null;
  actor_nombre: string;
  metodo: "POST" | "PUT" | "PATCH" | "DELETE";
  accion: string;
  modulo: string;
  recurso: string;
  objeto_id: number | null;
  ruta: string;
  status_code: number;
  exitosa: boolean;
  ip: string | null;
  fecha: string;
}
