import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../worker/production.mjs',import.meta.url),'utf8');
const route="if(req.method==='POST'&&u.pathname.replace(/\\/$/,'')==='/api/admin/diagnose-whale-transfer')";
const diagnostic=code.indexOf(route),generic=code.indexOf("if(u.pathname.startsWith('/api/admin/')){");
assert(diagnostic>=0,'Dedicated diagnostic route must exist');
assert(diagnostic<generic,'Diagnostic must precede the generic import fallback');
assert(code.slice(diagnostic,generic).includes("req.headers.get('Authorization')"),'Diagnostic must require owner auth');
console.log('PASS whale diagnostic precedes generic import fallback and requires owner authentication');
