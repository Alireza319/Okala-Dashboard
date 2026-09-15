'use strict';

class DataSchemaError extends Error {
  constructor({ stage, problem, expected, found, action, sheetName }) {
    super(`DATA SOURCE ERROR\nStage: ${stage}\nProblem: ${problem}\nExpected: ${expected}\nFound: ${found}\nAction: ${action}`);
    this.name = 'DataSchemaError'; this.stage = stage; this.problem = problem; this.expected = expected; this.found = found; this.action = action; this.sheetName = sheetName;
  }
}

const aliases = {
  vendorId: ['ID','Vendor ID','vendor_id','VendorID'],
  vendorName: ['Vendor','Vendor Name','vendor','name'],
  agent: ['Agent','agent','Owner','Vendor Owner'],
  city: ['City','city','شهر'],
  provider: ['Provider','provider','نوع سرویس','Service Type'],
  status: ['Live?','Status','Live','Vendor Status','وضعیت'],
  liveDate: ['Live Date','LiveDate','Live date'],
  churnDate: ['Churn Date','ChurnDate','Churn date'],
  latitude: ['Latitude','lat','Lat','latitude'],
  longitude: ['Longitude','lng','Long','longitude'],
  coordinates: ['lat & long','Lat & Long','Coordinates','lat,long'],
  grossOrder: ['Gross Order','Gross Orders','gross_order'],
  deliveredOrders: ['Delivered Orders','Delivered Order','delivered'],
  osrPct: ['%OSR','OSR','OSR %'],
  cancelledPct: ['%Cancelled','Cancelled %','Cancel %','% Cancel Vendor Side','Cancel Vendor Side'],
  returnedPct: ['%Returned','Returned %','Return %','% Return Vendor Side','Return Vendor Side'],
  refundPct: ['%Refund Vendor Side','Refund Vendor Side','Refund %','%Refund Vendor Side (Complaint)','Refund Vendor Side (Complaint)'],
  delayPct: ['%Delay (>10 mins)','Hyper Delay','%Hyper Delay','Hyper Delay %'],
  availabilityPct: ['Availability','Availability %','%Availability','Availability Percentage'],
  assortment: ['Assortment','assortment'],
  nfcPct: ['NFC','NFC %','%NFC','NFC Vendor Side','NFC % Vendor Side'],
  barcodeCount: ['Barcode','Barcode Count','Barcode count','Discounted Barcode'],
  avgDiscount: ['Average of Avg Discount','Average Avg Discount','Avg Discount','Average Discount','Avg Discount %'],
  acquisition: ['Acquisition','Acquisition Count','Acquisition count'],
  date: ['Date','date','Week Date','Report Date','Month'],
  week: ['Week','week'],
  total: ['Total','Average Total','Total Amount','Total Sales'],
};

function find(row, key) {
  for (const h of aliases[key] || []) if (Object.prototype.hasOwnProperty.call(row, h)) return row[h];
  const normalized = Object.keys(row).reduce((m,k)=>{m[k.trim().toLowerCase().replace(/[%()\s_-]+/g,'')]=k;return m;},{});
  for (const h of aliases[key] || []) {
    const k = normalized[String(h).trim().toLowerCase().replace(/[%()\s_-]+/g,'')];
    if (k) return row[k];
  }
  return undefined;
}
function parseNumber(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/,/g,'').replace(/٪/g,'%').trim();
  const n = parseFloat(s.replace(/%$/,''));
  return Number.isFinite(n) ? n : null;
}
function parseDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return new Date(Date.UTC(1899,11,30) + v*86400000);
  const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d;
}
function parseCoordinate(v) {
  if (v == null || v === '') return [null,null];
  const s = String(v).replace(/[،;]/g, ',');
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  return m ? [parseFloat(m[1]),parseFloat(m[2])] : [null,null];
}
function inferProvider(sheetName, explicit) {
  if (explicit) {
    const s = String(explicit).toLowerCase();
    if (s.includes('super') || s.includes('سوپر')) return 'Supermarket';
    if (s.includes('other') || s.includes('service') || s.includes('آدر')) return 'Other Service';
    return explicit;
  }
  const s = String(sheetName || '').toLowerCase();
  if (s.includes('other')) return 'Other Service';
  return null;
}
function normalizeVendorRow(row,{sheetName='Unknown'}={}) {
  const vendorId = find(row,'vendorId');
  const vendorName = find(row,'vendorName');
  if (vendorId == null && vendorName == null) throw new DataSchemaError({stage:`Google Sheets → ${sheetName}`,problem:'Row has neither Vendor ID nor Vendor name.',expected:'ID/Vendor',found:Object.keys(row).join(', '),action:'Check the source sheet header mapping.',sheetName});
  let lat = parseNumber(find(row,'latitude')), lng = parseNumber(find(row,'longitude'));
  if (lat == null || lng == null) { const [a,b]=parseCoordinate(find(row,'coordinates')); if(lat==null)lat=a;if(lng==null)lng=b; }
  const explicitProvider=find(row,'provider');
  return {
    vendorId: vendorId == null ? String(vendorName) : String(vendorId), vendorName: vendorName == null ? String(vendorId) : String(vendorName),
    agent: find(row,'agent') ?? null, city: find(row,'city') ?? null, provider: inferProvider(sheetName, explicitProvider),
    status: find(row,'status') ?? null, liveDate: parseDate(find(row,'liveDate')), churnDate: parseDate(find(row,'churnDate')),
    latitude: lat, longitude: lng, grossOrder: parseNumber(find(row,'grossOrder')), deliveredOrders: parseNumber(find(row,'deliveredOrders')),
    osrPct: parseNumber(find(row,'osrPct')), cancelledPct: parseNumber(find(row,'cancelledPct')), returnedPct: parseNumber(find(row,'returnedPct')),
    refundPct: parseNumber(find(row,'refundPct')), delayPct: parseNumber(find(row,'delayPct')), availabilityPct: parseNumber(find(row,'availabilityPct')),
    assortment: parseNumber(find(row,'assortment')), nfcPct: parseNumber(find(row,'nfcPct')), barcodeCount: parseNumber(find(row,'barcodeCount')),
    avgDiscount: parseNumber(find(row,'avgDiscount')), acquisition: parseNumber(find(row,'acquisition')), reportDate: parseDate(find(row,'date')),
    week: find(row,'week') ?? null, total: parseNumber(find(row,'total')), sourceSheet: sheetName, raw: row,
  };
}
module.exports={DataSchemaError,normalizeVendorRow,parseNumber,parseDate,find};
