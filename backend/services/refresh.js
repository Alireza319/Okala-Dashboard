'use strict';
const fs=require('node:fs'); const path=require('node:path');
const {normalizeVendorRow,DataSchemaError}=require('../data/normalize');
class CacheStore {
  constructor(filePath='./data/cache.json'){this.filePath=filePath;this._snapshot=null;this.load();}
  load(){try{if(fs.existsSync(this.filePath))this._snapshot=JSON.parse(fs.readFileSync(this.filePath,'utf8'),(k,v)=>v); }catch(e){console.warn('Cache load failed:',e.message);}}
  get(){return this._snapshot;}
  set(s){fs.mkdirSync(path.dirname(this.filePath),{recursive:true}); const tmp=this.filePath+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(s)); fs.renameSync(tmp,this.filePath); this._snapshot=s;}
}
function mergeRows(rows){
  const map=new Map();
  for(const r of rows){const key=String(r.vendorId); const old=map.get(key); if(!old){map.set(key,r);continue;} const merged={...old}; for(const [k,v] of Object.entries(r)){if(v!==null&&v!==undefined&&v!=='')merged[k]=v;} if(r.reportDate && (!old.reportDate || new Date(r.reportDate)>new Date(old.reportDate))) merged.reportDate=r.reportDate; map.set(key,merged);}
  return [...map.values()];
}
async function runRefresh({adapter,db,cacheStore,triggeredBy,sourceSheets}){
  const startedAt=new Date().toISOString(); const log=db.prepare(`INSERT INTO refresh_logs (triggered_by,status,started_at) VALUES (?,'running',?)`).run(triggeredBy,startedAt); const logId=log.lastInsertRowid;
  let rowsProcessed=0,rowsAccepted=0,rowsRejected=0; const warnings=[];
  try{
    const rows=[];
    for(const sheetName of sourceSheets){
      const raw=await adapter.fetchSheet(sheetName); rowsProcessed+=raw.length;
      for(const row of raw){try{rows.push(normalizeVendorRow(row,{sheetName}));rowsAccepted++;}catch(e){if(e instanceof DataSchemaError){rowsRejected++;warnings.push(e.message);continue;}throw e;}}
    }
    if(!rows.length) throw new Error('No usable vendor rows were found. Check source sheet names and headers.');
    const vendors=mergeRows(rows);
    const snapshot={builtAt:new Date().toISOString(),vendors,rows, dataQuality:{rowsProcessed,rowsAccepted,rowsRejected,warnings:warnings.slice(0,200)}};
    cacheStore.set(snapshot);
    db.prepare(`UPDATE refresh_logs SET status='success',rows_processed=?,rows_accepted=?,rows_rejected=?,finished_at=datetime('now') WHERE id=?`).run(rowsProcessed,rowsAccepted,rowsRejected,logId);
    return {ok:true,rowsProcessed,rowsAccepted,rowsRejected,vendorCount:vendors.length,builtAt:snapshot.builtAt,warnings:warnings.slice(0,20)};
  }catch(e){db.prepare(`UPDATE refresh_logs SET status='failed',error_message=?,rows_processed=?,rows_accepted=?,rows_rejected=?,finished_at=datetime('now') WHERE id=?`).run(e.message,rowsProcessed,rowsAccepted,rowsRejected,logId);throw e;}
}
module.exports={CacheStore,runRefresh};
