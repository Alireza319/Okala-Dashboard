'use strict';
require('dotenv').config();
const GoogleSheetsAdapter=require('../backend/data/GoogleSheetsAdapter');
(async()=>{const a=new GoogleSheetsAdapter({endpoint:process.env.GOOGLE_SHEETS_ENDPOINT});const s=await a.listSchemas();console.log(JSON.stringify(s,null,2));})().catch(e=>{console.error(e.message);process.exit(1)});
