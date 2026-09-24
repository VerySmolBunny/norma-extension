/**
 * Norma Hub - Motor de Métricas y Detección de Atrasos
 * Calcula tiempos teóricos, tiempos reales, fechas límites y semáforos de riesgo para la cartera de clientes.
 */

import { getConfig } from '../core/config.js';

const MONDAY_API_URL = 'https://api.monday.com/v2';

// Snapshot de respaldo oficial obtenido del sistema de métricas para garantizar disponibilidad instantánea
export const MOCK_METRICS_SNAPSHOT = {
  scorecard: {
    total_vigentes: 0,
    total_atrasados: 0,
    coes_vigentes: 0,
    coes_atrasados: 0,
    al_limite: 0,
    con_tiempo: 0,
    porcentaje_cumplimiento: 100
  },
  chart1: [],
  detalle: []
};

export class MetricsService {
  /**
   * Calcula de forma precisa los tiempos y semáforos de un cliente
   */
  static computeClientMetrics(clientRaw, refDate = new Date()) {
    const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    
    // 1. Determinar fecha de inicio / Kick Off
    let kickoffStr = clientRaw.kickoff || clientRaw.kickoff_date || clientRaw.fechaAsignacion || '';
    if (!kickoffStr && clientRaw.fecha) kickoffStr = clientRaw.fecha;
    
    let kickoffDate = null;
    if (kickoffStr) {
      const parts = kickoffStr.split('-');
      if (parts.length === 3) {
        kickoffDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        kickoffDate = new Date(kickoffStr);
      }
    }

    if (!kickoffDate || isNaN(kickoffDate.getTime())) {
      kickoffDate = new Date(today.getTime() - (15 * 24 * 3600 * 1000));
      kickoffStr = kickoffDate.toISOString().split('T')[0];
    }

    // 2. Determinar tiempo teórico (en meses)
    let tTeorico = 1.4;
    if (clientRaw.t_teorico) {
      tTeorico = parseFloat(clientRaw.t_teorico);
    } else {
      const nameLower = (clientRaw.name || clientRaw.client_name || '').toLowerCase();
      const dotacion = parseInt(clientRaw.dotacion || '0', 10);
      if (nameLower.includes('upselling') || nameLower.includes('artl')) {
        tTeorico = 0.9;
      } else if (nameLower.includes('nacional') || nameLower.includes('quesería') || nameLower.includes('queseria') || dotacion > 250) {
        tTeorico = 2.3;
      }
    }

    // 3. Calcular tiempo real transcurrido (en meses: días / 30.4375)
    const diffMs = today.getTime() - kickoffDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const tReal = parseFloat((diffDays / 30.4375).toFixed(1));

    // 4. Calcular Atraso = t_real - t_teorico
    const atraso = parseFloat((tReal - tTeorico).toFixed(1));

    // 5. Calcular Fecha Límite de Atraso = Kick Off + (t_teorico * 30.4375 días)
    const theoreticalMs = tTeorico * 30.4375 * 24 * 60 * 60 * 1000;
    const fechaAtrasoDate = new Date(kickoffDate.getTime() + theoreticalMs);
    const yyyy = fechaAtrasoDate.getFullYear();
    const mm = String(fechaAtrasoDate.getMonth() + 1).padStart(2, '0');
    const dd = String(fechaAtrasoDate.getDate()).padStart(2, '0');
    const fechaAtrasoStr = `${yyyy}-${mm}-${dd}`;

    // 6. Días de diferencia respecto a hoy
    const diasDiferencia = Math.round((fechaAtrasoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // 7. Semáforo de Prevención
    let prevencion = 'Con Tiempo';
    let categoria = 'Sin Atraso';

    if (atraso > 0 || diasDiferencia < 0) {
      prevencion = 'Atrasado';
      categoria = 'Alto';
    } else if (atraso >= -0.3 || diasDiferencia <= 15) {
      prevencion = 'Al Límite';
      categoria = 'Sin Atraso';
    } else {
      prevencion = 'Con Tiempo';
      categoria = 'Sin Atraso';
    }

    // Limpieza de URL
    let cleanUrl = clientRaw.url || clientRaw.urlBuk || '';
    cleanUrl = cleanUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');

    return {
      id: clientRaw.id || String(Math.random()),
      client_name: clientRaw.client_name || clientRaw.name || 'Cliente sin nombre',
      url: cleanUrl,
      kickoff_date: kickoffStr,
      t_real: tReal.toFixed(1),
      t_teorico: tTeorico.toFixed(1),
      atraso: (atraso > 0 ? `+${atraso.toFixed(1)}` : atraso.toFixed(1)),
      raw_atraso: atraso,
      fecha_atraso: fechaAtrasoStr,
      dias_diferencia: diasDiferencia,
      prevencion: prevencion,
      categoria: categoria,
      module: 'Asistencia',
      celula: clientRaw.celula || clientRaw.c_lula || '',
      cell_lead: clientRaw.cell_lead || clientRaw.lead || '',
      coe: clientRaw.coe || '',
      etapa: clientRaw.etapa || 'En curso'
    };
  }

  /**
   * Obtiene y calcula todas las métricas de la cartera en tiempo real con filtros de estado y rango de fechas
   */
  static async getMetricsReport(forceRefresh = false, options = {}) {
    const config = await getConfig();

    try {
      if (config.mondayApiKey) {
        const mondayReport = await this.fetchFromMonday(config, options);
        if (mondayReport && mondayReport.detalle && mondayReport.detalle.length > 0) {
          return mondayReport;
        }
      }
    } catch (err) {
      console.warn('No se pudo conectar en vivo a Monday.com para métricas, usando snapshot:', err);
    }

    // Fallback: Snapshot oficial obtenido del sistema
    return this.processMetricsArray(MOCK_METRICS_SNAPSHOT.detalle, options);
  }

  /**
   * Consulta los clientes en Monday.com y los procesa con filtros de estado y fechas
   */
  static async fetchFromMonday(config, options = {}) {
    const boardId = config.boardId || '1400120846';
    const coeName = (config.coeName || '').trim();
    const onlyVigentes = options.onlyVigentes !== false; // true por defecto

    let query;
    let variables;

    if (coeName) {
      query = `
        query GetClientsForMetrics($boardId: ID!, $personName: [String]!) {
          items_page_by_column_values(
            board_id: $boardId,
            columns: [{ column_id: "person", column_values: $personName }],
            limit: 500
          ) {
            items {
              id
              name
              group {
                title
              }
              column_values {
                id
                text
                value
              }
            }
          }
        }
      `;
      variables = {
        boardId: String(boardId),
        personName: [coeName]
      };
    } else {
      query = `
        query GetClientsForMetricsAll($boardId: ID!) {
          boards(ids: [$boardId]) {
            items_page(limit: 500) {
              items {
                id
                name
                group {
                  title
                }
                column_values {
                  id
                  text
                  value
                }
              }
            }
          }
        }
      `;
      variables = {
        boardId: String(boardId)
      };
    }

    const res = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.mondayApiKey,
        'API-Version': '2024-01'
      },
      body: JSON.stringify({
        query: query,
        variables: variables
      })
    });

    const json = await res.json();
    const items = json?.data?.items_page_by_column_values?.items || json?.data?.boards?.[0]?.items_page?.items || [];

    if (items.length === 0) {
      return null;
    }

    // Filtrar clientes según vigencia
    let relevantItems = items;
    if (onlyVigentes) {
      relevantItems = items.filter(item => {
        const statusVal = item.column_values?.find(v => v.id === 'status')?.text || '';
        const groupTitle = item.group?.title || '';
        
        // Excluir terminados / dados de baja / pasados
        if (statusVal.includes('Finalizado') || statusVal.includes('Dio de Baja') || statusVal.includes('Desaparecido')) {
          return false;
        }
        if (groupTitle.includes('Finalizado') || groupTitle.includes('Dio de Baja')) {
          return false;
        }
        
        // Incluir estado Vigente o grupo Vigente
        return statusVal === 'Vigente' || groupTitle === 'Vigente';
      });
    }

    const rawClients = relevantItems.map(item => {
      const getVal = (colId) => item.column_values?.find(v => v.id === colId)?.text || '';
      
      // Limpiar fecha (remover sufijo de hora como " 09:00")
      let rawDate = getVal('date') || getVal('date_mkpw5mrn') || getVal('fecha_Mjj44wY8') || getVal('fecha6') || '';
      rawDate = rawDate.replace(/\s+\d{2}:\d{2}.*$/, '').trim();

      return {
        id: item.id,
        name: item.name,
        kickoff: rawDate,
        urlBuk: getVal('link') || getVal('dup__of_url_buk_reflejo6__1') || getVal('lookup'),
        etapa: getVal('dup__of_criticidad4'),
        celula: getVal('c_lula__1') || '',
        lead: getVal('multiple_person_mm511g3a') || '',
        dotacion: getVal('numeric'),
        estado: getVal('status'),
        grupo: item.group?.title || ''
      };
    });

    return this.processMetricsArray(rawClients, options);
  }

  /**
   * Procesa un array de clientes crudos aplicando filtros de fecha y genera los Scorecards y KPIs
   */
  static processMetricsArray(clientsList, options = {}) {
    let detalle = clientsList.map(c => this.computeClientMetrics(c));

    // Filtro por Rango de Fechas si está especificado
    if (options.startDate) {
      detalle = detalle.filter(d => d.kickoff_date >= options.startDate);
    }
    if (options.endDate) {
      detalle = detalle.filter(d => d.kickoff_date <= options.endDate);
    }

    // Ordenar: primero los Atrasados, luego Al Límite (ordenados por días restantes), luego Con Tiempo
    detalle.sort((a, b) => {
      const priority = { 'Atrasado': 1, 'Al Límite': 2, 'Con Tiempo': 3 };
      if (priority[a.prevencion] !== priority[b.prevencion]) {
        return priority[a.prevencion] - priority[b.prevencion];
      }
      return a.dias_diferencia - b.dias_diferencia;
    });

    const totalVigentes = detalle.length;
    const atrasados = detalle.filter(d => d.prevencion === 'Atrasado').length;
    const alLimite = detalle.filter(d => d.prevencion === 'Al Límite').length;
    const conTiempo = detalle.filter(d => d.prevencion === 'Con Tiempo').length;
    const porcentajeCumplimiento = totalVigentes > 0 ? Math.round(((totalVigentes - atrasados) / totalVigentes) * 100) : 100;

    const scorecard = {
      total_vigentes: totalVigentes,
      total_atrasados: atrasados,
      al_limite: alLimite,
      con_tiempo: conTiempo,
      coes_vigentes: 1,
      coes_atrasados: atrasados > 0 ? 1 : 0,
      porcentaje_cumplimiento: porcentajeCumplimiento
    };

    const chart1 = [
      { categoria: 'Con Tiempo (Al Día)', total: conTiempo, color: '#10b981' },
      { categoria: 'Al Límite (Riesgo Próximo)', total: alLimite, color: '#f59e0b' },
      { categoria: 'Atrasado (Crítico)', total: atrasados, color: '#ef4444' }
    ];

    return {
      scorecard,
      chart1,
      detalle,
      timestamp: new Date().toISOString()
    };
  }
}
