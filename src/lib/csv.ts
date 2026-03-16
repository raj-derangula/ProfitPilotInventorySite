/**
 * CSV import/export utilities for ProfitPilot.
 */

import type { InventoryItem, SaleRecord, SalesOrderItem } from './db';
import { generateId } from './db';

// --- CSV Generation ---

function escapeCsvField(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: (string | number | undefined)[]): string {
  return fields.map(escapeCsvField).join(',');
}

export function inventoryToCsv(items: InventoryItem[]): string {
  const headers = [
    'id', 'productName', 'category', 'sourcePlatform',
    'pricePaid', 'costPrice', 'quantity', 'originalQuantityPurchased',
    'visualDescription', 'aiConfidence', 'createdAt', 'updatedAt',
  ];
  const rows = items.map(item => toCsvRow([
    item.id, item.productName, item.category, item.sourcePlatform,
    item.pricePaid, item.costPrice, item.quantity, item.originalQuantityPurchased,
    item.visualDescription, item.aiConfidence, item.createdAt, item.updatedAt,
  ]));
  return [headers.join(','), ...rows].join('\n');
}

export function salesToCsv(sales: SaleRecord[]): string {
  const headers = [
    'saleId', 'dateOfSale', 'productName', 'salePrice', 'quantitySold',
  ];
  const rows: string[] = [];
  for (const sale of sales) {
    for (const item of sale.productsSold) {
      rows.push(toCsvRow([
        sale.id, sale.dateOfSale, item.productName, item.salePrice, item.quantitySold,
      ]));
    }
  }
  return [headers.join(','), ...rows].join('\n');
}

// --- CSV Parsing ---

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(csvText: string): { headers: string[]; rows: string[][] } {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

export function csvToInventoryItems(csvText: string): InventoryItem[] {
  const { headers, rows } = parseCsv(csvText);
  const items: InventoryItem[] = [];

  for (const row of rows) {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });

    items.push({
      id: obj['id'] || generateId(),
      productName: obj['productName'] || '',
      category: obj['category'] || '',
      sourcePlatform: obj['sourcePlatform'] || '',
      pricePaid: obj['pricePaid'] || '0',
      costPrice: obj['costPrice'] || undefined,
      quantity: obj['quantity'] || '0',
      originalQuantityPurchased: obj['originalQuantityPurchased'] || obj['quantity'] || '0',
      visualDescription: obj['visualDescription'] || '',
      aiConfidence: parseFloat(obj['aiConfidence']) || 0,
      productImage: undefined, // Images are not exported to CSV
      createdAt: obj['createdAt'] || new Date().toISOString(),
      updatedAt: obj['updatedAt'] || new Date().toISOString(),
    });
  }

  return items;
}

export function csvToSaleRecords(csvText: string): SaleRecord[] {
  const { headers, rows } = parseCsv(csvText);
  const salesMap = new Map<string, SaleRecord>();

  for (const row of rows) {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });

    const saleId = obj['saleId'] || generateId();
    if (!salesMap.has(saleId)) {
      salesMap.set(saleId, {
        id: saleId,
        dateOfSale: obj['dateOfSale'] || new Date().toISOString(),
        productsSold: [],
      });
    }

    const sale = salesMap.get(saleId)!;
    sale.productsSold.push({
      productName: obj['productName'] || '',
      salePrice: obj['salePrice'] || '0',
      quantitySold: obj['quantitySold'] || '0',
    });
  }

  return Array.from(salesMap.values());
}

// --- File Download Helper ---

export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
