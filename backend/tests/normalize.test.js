'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const n=require('../data/normalize');
test('normalizes flexible headers and coordinates',()=>{const v=n.normalizeVendorRow({'ID':123,'Vendor':'ABC','Agent':'Majidi.Saeid','City':'Tehran','Provider':'Supermarket','Live?':'فعال','Gross Order':'1,000','%Cancelled':'2.5%','lat & long':'35.7, 51.4'},{sheetName:'Sales & cub'});assert.equal(v.vendorId,'123');assert.equal(v.grossOrder,1000);assert.equal(v.cancelledPct,2.5);assert.equal(v.latitude,35.7);assert.equal(v.longitude,51.4);});
test('rejects rows without vendor identity',()=>assert.throws(()=>n.normalizeVendorRow({'Week':'Week 1'},{sheetName:'Ops'}),/neither Vendor ID/i));
