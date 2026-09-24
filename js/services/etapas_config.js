/**
 * Configuración oficial de Etapas para Control de Asistencia - Buk
 * Regla estricta: Solo utilizar las etapas autorizadas en este listado.
 */

export const ETAPAS_ASISTENCIA = [
  {
    key: 'estructura',
    name: 'Estructura',
    mondayLabel: 'Estructura',
    description: 'Creamos la empresa, áreas, cargos y colaboradores en la plataforma Buk',
    keywords: [
      'estructura organizacional', 'estructura de la empresa', 'crear empresa', 'creación de empresa',
      'creacion de empresa', 'áreas y cargos', 'areas y cargos', 'crear áreas', 'crear areas',
      'crear cargos', 'creación de áreas', 'creacion de areas', 'creación de cargos', 'creacion de cargos',
      'carga de colaboradores', 'crear colaboradores', 'organigrama', 'módulo de estructura', 'modulo de estructura'
    ]
  },
  {
    key: 'creacion_recintos',
    name: 'Creación de recintos',
    mondayLabel: 'Creación de recintos',
    description: 'Se configuraron los recintos durante la sesión',
    keywords: [
      'creación de recintos', 'creacion de recintos', 'configuración de recintos',
      'configuracion de recintos', 'configurar recintos', 'crear recintos', 'recintos creados',
      'recintos y sucursales', 'recintos configurados', 'reloj control', 'dispositivos de marcaje',
      'recintos', 'recinto'
    ]
  },
  {
    key: 'planificacion_turnos',
    name: 'Planificación de turnos',
    mondayLabel: 'Planificación de turnos',
    description: 'Los turnos quedaron configurados y asignados',
    keywords: [
      'planificación de turnos', 'planificacion de turnos', 'configuración de turnos',
      'configuracion de turnos', 'asignación de turnos', 'asignacion de turnos', 'mallas de turno',
      'malla de turnos', 'turnos rotativos', 'asignar turnos', 'turnos configurados', 'turnos asignados',
      'horarios de turnos', 'creación de turnos', 'creacion de turnos', 'turnos', 'turno'
    ]
  },
  {
    key: 'marcha_blanca',
    name: 'Marcha Blanca',
    mondayLabel: 'Marcha Blanca',
    description: 'El cliente comienza a marcar asistencia',
    keywords: [
      'marcha blanca', 'comenzar a marcar', 'comienzan a marcar', 'inicio de marcaje',
      'primeras marcas', 'marcando asistencia', 'inicio de marcas', 'empezar a marcar'
    ]
  },
  {
    key: 'asistencia',
    name: 'Asistencia',
    mondayLabel: 'Asistencia',
    description: 'Vimos cómo gestionar la asistencia, crear marcas manuales',
    keywords: [
      'gestionar la asistencia', 'gestión de asistencia', 'gestion de asistencia',
      'marcas manuales', 'marca manual', 'crear marcas manuales', 'ajuste de marcas',
      'registro de asistencia', 'validación de marcas', 'validar marcas', 'módulo de asistencia', 'modulo de asistencia'
    ]
  },
  {
    key: 'inasistencia',
    name: 'Inasistencia',
    mondayLabel: 'Inasistencia',
    description: 'Vimos cómo justificar inasistencias',
    keywords: [
      'inasistencia', 'inasistencias', 'justificar inasistencias', 'justificación de inasistencias',
      'justificacion de inasistencias', 'justificar faltas', 'licencias médicas', 'licencias medicas',
      'licencia médica', 'licencia medica', 'permisos con goce', 'permisos sin goce', 'ausencias'
    ]
  },
  {
    key: 'vacaciones',
    name: 'Vacaciones',
    mondayLabel: 'Vacaciones',
    description: 'Configuramos las vacaciones',
    keywords: [
      'vacaciones', 'configurar vacaciones', 'configuración de vacaciones', 'configuracion de vacaciones',
      'solicitud de vacaciones', 'saldos de vacaciones', 'días progresivos', 'dias progresivos'
    ]
  },
  {
    key: 'firma_documental',
    name: 'Firma y Gestión Documental',
    mondayLabel: 'Firma y Gestión Documental',
    description: 'Vimos cómo subir, generar y firmar documentos',
    keywords: [
      'firma y gestión documental', 'firma y gestion documental', 'gestión documental',
      'gestion documental', 'firma electrónica', 'firma electronica', 'firma digital',
      'subir documentos', 'generar documentos', 'firmar documentos', 'plantillas de documentos', 'firmar contratos'
    ]
  },
  {
    key: 'reporteria',
    name: 'Reportería',
    mondayLabel: 'Reportería',
    description: 'Revisamos los distintos reportes',
    keywords: [
      'reportería', 'reporteria', 'reportes de asistencia', 'distintos reportes',
      'revisión de reportes', 'revision de reportes', 'reporte de atrasos', 'reporte de horas extras',
      'descargar reportes', 'reportes'
    ]
  },
  {
    key: 'sincronizacion',
    name: 'Sincronización',
    mondayLabel: 'Sincronización',
    description: 'Aprendimos cómo tomar la información de la asistencia y enviarla a las liquidaciones',
    keywords: [
      'sincronización', 'sincronizacion', 'enviar a liquidaciones', 'enviar a las liquidaciones',
      'traspaso a liquidaciones', 'traspaso a remuneraciones', 'cierre de asistencia para nómina',
      'cierre de asistencia para nomina', 'liquidaciones'
    ]
  },
  {
    key: 'coordinando_kickoff',
    name: 'Coordinando Kick Off',
    mondayLabel: 'Coordinando KickOffr',
    description: 'En proceso de contacto y coordinación de la reunión inicial de Kick Off',
    keywords: [
      'coordinando kickoff', 'coordinando kick off', 'coordinación de kick off',
      'coordinacion de kick off', 'agendamiento de kickoff', 'primer contacto', 'bienvenida'
    ]
  },
  {
    key: 'precierre',
    name: 'Precierre',
    mondayLabel: 'Precierre / Pendientes',
    description: 'La siguiente sesión será el Cierre',
    keywords: [
      'precierre', 'pre-cierre', 'próxima sesión de cierre', 'proxima sesion de cierre',
      'siguiente sesión será el cierre', 'siguiente sesion sera el cierre',
      'siguiente reunión será el cierre', 'siguiente reunion sera el cierre',
      'próxima sesión será el cierre', 'proxima sesion sera el cierre',
      'últimos pendientes antes del cierre', 'ultimos pendientes antes del cierre',
      'preparación para el cierre', 'preparacion para el cierre', 'sesion de precierre', 'sesión de precierre'
    ]
  }
];

export const MONDAY_ETAPA_COLUMN_ID = 'dup__of_criticidad4';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detecta la etapa correspondiente a partir del texto de la minuta o notas de la sesión.
 * Regla de negocio: Último tema tratado en la sesión.
 */
export function detectStageFromNotes(text) {
  if (!text || typeof text !== 'string') return null;

  let targetSearchText = text;
  const notasMatch = text.match(/(?:Notas de la Sesión|Resumen de la Sesión|1\.\s*Notas de la Sesión):?([\s\S]*?)(?=(?:2\.\s*Temas|Temas que se revisaran|Próxima sesión|Proxima sesion|Próxima reunión|Proxima reunion|Tareas del Cliente|Tareas del PM|$))/i);
  if (notasMatch && notasMatch[1] && notasMatch[1].trim().length > 5) {
    targetSearchText = notasMatch[1].trim();
  }

  const isPrecierre = /siguiente (?:sesión|reunión) ser[aá] el cierre/i.test(text) || 
                      /pr[oó]xima (?:sesión|reunión) ser[aá] el cierre/i.test(text) ||
                      /sesi[oó]n de precierre/i.test(text);

  let latestMatch = null;
  let maxPosition = -1;

  for (const etapa of ETAPAS_ASISTENCIA) {
    for (const kw of etapa.keywords) {
      const pattern = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'gi');
      let match;
      while ((match = pattern.exec(targetSearchText)) !== null) {
        if (match.index >= maxPosition) {
          maxPosition = match.index;
          latestMatch = {
            etapa: etapa.name,
            mondayLabel: etapa.mondayLabel,
            description: etapa.description,
            matchedKeyword: kw,
            position: match.index,
            reason: `Detectado como último tema tratado en la sesión: "${kw}" (${etapa.description})`
          };
        }
      }
    }
  }

  if (isPrecierre && (!latestMatch || latestMatch.etapa !== 'Precierre')) {
    const precierreEtapa = ETAPAS_ASISTENCIA.find(e => e.key === 'precierre');
    return {
      etapa: precierreEtapa.name,
      mondayLabel: precierreEtapa.mondayLabel,
      description: precierreEtapa.description,
      matchedKeyword: 'siguiente sesión será el cierre',
      position: text.length,
      reason: 'Detectado: La siguiente sesión acordada será el Cierre (Precierre)'
    };
  }

  return latestMatch;
}
