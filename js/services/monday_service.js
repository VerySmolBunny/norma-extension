/**
 * Cliente de Integración con Monday.com GraphQL API para Chrome Extension
 */

import { getConfig } from '../core/config.js';
import { MONDAY_ETAPA_COLUMN_ID } from './etapas_config.js';

const MONDAY_API_URL = 'https://api.monday.com/v2';

async function queryMonday(query, variables = {}, customApiKey = null) {
  const config = await getConfig();
  const apiKey = customApiKey || config.mondayApiKey;
  if (!apiKey) {
    throw new Error('No se ha configurado la API Key de Monday.com en Ajustes.');
  }

  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
      'API-Version': '2024-01'
    },
    body: JSON.stringify({ query, variables })
  });

  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map(e => e.message).join(' | '));
  }
  return json.data;
}

export class MondayService {
  constructor(apiKey = null, boardId = null) {
    this.apiKey = apiKey;
    this.boardId = boardId;
  }

  /**
   * Publica un comentario (Update) en un item de Monday.com (Instancia)
   */
  async addUpdate(itemId, bodyText) {
    return MondayService.addUpdate(itemId, bodyText, this.apiKey);
  }

  /**
   * Actualiza la columna de Etapa (dup__of_criticidad4) de un cliente en Monday.com (Instancia)
   */
  async updateStage(itemId, stageLabel) {
    return MondayService.updateClientStage(itemId, stageLabel, this.boardId, this.apiKey);
  }

  async updateClientStage(itemId, stageLabel) {
    return MondayService.updateClientStage(itemId, stageLabel, this.boardId, this.apiKey);
  }

  /**
   * Publica un comentario (Update) en un item de Monday.com (Estático)
   */
  static async addUpdate(itemId, bodyText, customApiKey = null) {
    const query = `
      mutation ($itemId: ID!, $body: String!) {
        create_update (item_id: $itemId, body: $body) {
          id
          created_at
        }
      }
    `;
    const data = await queryMonday(query, {
      itemId: String(itemId),
      body: bodyText
    }, customApiKey);
    return data?.create_update;
  }

  /**
   * Actualiza la columna de Etapa (dup__of_criticidad4) de un cliente en Monday.com (Estático)
   */
  static async updateClientStage(itemId, stageLabel, customBoardId = null, customApiKey = null) {
    const config = await getConfig();
    const boardId = customBoardId || config.boardId || '1400120846';

    const query = `
      mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: String!) {
        change_simple_column_value (
          board_id: $boardId,
          item_id: $itemId,
          column_id: $columnId,
          value: $value
        ) {
          id
          name
        }
      }
    `;

    const data = await queryMonday(query, {
      boardId: String(boardId),
      itemId: String(itemId),
      columnId: MONDAY_ETAPA_COLUMN_ID,
      value: stageLabel
    }, customApiKey);

    return data?.change_simple_column_value;
  }

  static async updateStage(itemId, stageLabel, customBoardId = null, customApiKey = null) {
    return MondayService.updateClientStage(itemId, stageLabel, customBoardId, customApiKey);
  }

  /**
   * Finaliza un cliente en Monday actualizando simultáneamente Estado y Etapa a 'Finalizado'
   */
  async finalizeClient(itemId) {
    return MondayService.finalizeClient(itemId, this.boardId, this.apiKey);
  }

  /**
   * Actualiza la etapa de un cliente a 'Coordinando KickOffr'
   */
  static async updateClientStageToCoordinatingKO(itemId, customBoardId = null, customApiKey = null) {
    return MondayService.updateClientStage(itemId, 'Coordinando KickOffr', customBoardId, customApiKey);
  }

  /**
   * Finaliza un cliente en Monday actualizando atómicamente:
   * - Estado: 'Finalizado' (status)
   * - Etapa: 'Finalizado' (dup__of_criticidad4)
   */
  static async finalizeClient(itemId, customBoardId = null, customApiKey = null) {
    const config = await getConfig();
    const boardId = customBoardId || config.boardId || '1400120846';

    const colValues = JSON.stringify({
      "status": { "label": "Finalizado" },
      [MONDAY_ETAPA_COLUMN_ID]: { "label": "Finalizado" }
    });

    const query = `
      mutation FinalizeClient($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values (
          board_id: $boardId,
          item_id: $itemId,
          column_values: $columnValues
        ) {
          id
          name
        }
      }
    `;

    const data = await queryMonday(query, {
      boardId: String(boardId),
      itemId: String(itemId),
      columnValues: colValues
    }, customApiKey);

    return data?.change_multiple_column_values;
  }

  /**
   * Obtiene todos los clientes asignados al COE cuyo estado sea 'Por celebrar KO'
   */
  static async getKOPendingClients(customApiKey = null, customBoardId = null, customCoeName = null) {
    const config = await getConfig();
    const boardId = customBoardId || config.boardId || '1400120846';
    const coeName = (customCoeName !== null ? customCoeName : (config.coeName || '')).trim();

    let query;
    let variables;

    if (coeName) {
      query = `
        query GetKOClients($boardId: ID!, $personName: [String]!) {
          items_page_by_column_values(
            board_id: $boardId,
            columns: [{ column_id: "person", column_values: $personName }],
            limit: 150
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
        query GetKOClientsAll($boardId: ID!) {
          boards(ids: [$boardId]) {
            items_page(limit: 150) {
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

    const data = await queryMonday(query, variables, customApiKey);

    const items = data?.items_page_by_column_values?.items || data?.boards?.[0]?.items_page?.items || [];
    const koClients = [];

    items.forEach(it => {
      const colMap = {};
      it.column_values?.forEach(cv => {
        colMap[cv.id] = cv.text || '';
      });

      const statusVal = colMap['status'] || '';
      const etapaVal = colMap['dup__of_criticidad4'] || '';

      // Filtrar clientes en estado 'Por celebrar KO' o etapa 'Coordinando KickOffr'
      if (statusVal.toLowerCase().includes('por celebrar') || statusVal.toLowerCase().includes('celebrar ko') || etapaVal.toLowerCase().includes('coordinando kickoff')) {
        let urlBuk = colMap['dup__of_url_buk_reflejo6__1'] || colMap['lookup'] || '';
        urlBuk = urlBuk.replace(/^https?:\/\//i, '').replace(/\/$/, '').trim();

        koClients.push({
          id: it.id,
          name: it.name,
          group: it.group?.title || 'Vigente',
          status: statusVal || 'Por celebrar KO',
          etapa: etapaVal || 'Coordinando KickOffr',
          contraparte: colMap['texto7'] || '',
          correoContraparte: colMap['dup__of_contraparte_corp4'] || '',
          telefonoContraparte: colMap['dup__of_mail_contraparte_corp'] || '',
          urlBuk: urlBuk,
          dotacion: parseInt(colMap['registros_estimados'] || colMap['numeric'] || '0', 10) || 0,
          recintos: parseInt(colMap['recintos_a_implementar'] || '1', 10) || 1,
          tipoMarcaje: colMap['estado3'] || 'APPs Móviles / Web',
          comentariosSales: colMap['texto0'] || '',
          fechaAsignacion: colMap['fecha_Mjj44wY8'] || '',
          lider: colMap['multiple_person'] || colMap['multiple_person_mm511g3a'] || '',
          celula: colMap['c_lula__1'] || ''
        });
      }
    });

    return koClients;
  }
}
