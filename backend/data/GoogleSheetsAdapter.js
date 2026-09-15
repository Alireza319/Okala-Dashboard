'use strict';

const DataSourceAdapter = require('./DataSourceAdapter');

class GoogleSheetsAdapter extends DataSourceAdapter {
  constructor({ endpoint, timeoutMs = 120000 }) {
    super();

    if (!endpoint) {
      throw new Error(
        'GoogleSheetsAdapter requires an endpoint (set GOOGLE_SHEETS_ENDPOINT in .env)'
      );
    }

    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }

  async _get(params) {
    const url = new URL(this.endpoint);

    Object.entries(params).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });

    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal
      });

      const body = await res.json().catch(() => null);

      if (!res.ok || (body && body.success === false)) {
        const detail =
          body?.message ||
          body?.error ||
          `HTTP ${res.status}`;

        throw new Error(
          `DATA SOURCE ERROR\n` +
          `Stage: Google Apps Script\n` +
          `Problem: ${detail}\n` +
          `Action: Check the Apps Script deployment and requested action.`
        );
      }

      return body;

    } catch (err) {

      if (err.name === 'AbortError') {
        throw new Error(
          `DATA SOURCE ERROR\n` +
          `Stage: Google Apps Script\n` +
          `Problem: Request timed out after ${this.timeoutMs / 1000} seconds.\n` +
          `Action: Check Apps Script response time and source sheet size.`
        );
      }

      throw err;

    } finally {
      clearTimeout(timer);
    }
  }

  async listSchemas() {
    const data = await this._get({
      action: 'listSheets'
    });

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.sheets)) {
      return data.sheets;
    }

    throw new Error(
      `DATA SOURCE ERROR\n` +
      `Stage: Google Apps Script → listSheets\n` +
      `Problem: Expected sheets array.\n` +
      `Action: Check Apps Script response.`
    );
  }

  async fetchSheet(sheetName) {

    const data = await this._get({
      action: 'getSheet',
      name: sheetName
    });

    /*
     * Your Apps Script returns:
     *
     * {
     *   success: true,
     *   sheet: "...",
     *   headers: [...],
     *   rows: [...]
     * }
     *
     * The dashboard needs the rows array.
     */

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.rows)) {
      return data.rows;
    }

    throw new Error(
      `DATA SOURCE ERROR\n` +
      `Stage: Google Sheets → ${sheetName}\n` +
      `Problem: Expected an array of rows.\n` +
      `Action: Check the Apps Script "getSheet" response shape.`
    );
  }

  async healthCheck() {
    try {

      const data = await this._get({
        action: 'ping'
      });

      return {
        healthy: data?.success !== false,
        message: data?.message || null
      };

    } catch (err) {

      return {
        healthy: false,
        message: err.message
      };

    }
  }
}

module.exports = GoogleSheetsAdapter;