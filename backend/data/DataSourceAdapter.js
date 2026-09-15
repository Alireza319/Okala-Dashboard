/**
 * DataSourceAdapter (Section 3, 44)
 * ----------------------------------
 * Abstract interface every data source must implement. The rest of the
 * application (calculation engine, API routes, admin panel) depends ONLY on
 * this interface — never on GoogleSheetsAdapter directly — so that swapping
 * Google Sheets for a future data-center API means writing one new adapter
 * class, nothing else.
 */

'use strict';

class DataSourceAdapter {
  /**
   * @returns {Promise<{ sheetName: string, headers: string[] }[]>}
   * Used by the schema inspector / DATA_MAPPING validation step.
   */
  async listSchemas() {
    throw new Error('listSchemas() not implemented');
  }

  /**
   * Fetch raw rows for one logical sheet/table by name, as an array of
   * objects keyed by header name (NOT by column letter/index — Section 4
   * requires header-based mapping so column reordering doesn't silently
   * break calculations).
   * @param {string} sheetName
   * @returns {Promise<Record<string, any>[]>}
   */
  async fetchSheet(sheetName) {
    throw new Error('fetchSheet() not implemented');
  }

  /**
   * @returns {Promise<{ healthy: boolean, message?: string }>}
   */
  async healthCheck() {
    throw new Error('healthCheck() not implemented');
  }
}

module.exports = DataSourceAdapter;
