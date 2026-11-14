const assert=require('node:assert/strict'),C=require('../dist/chart-curves.js');
assert.equal(C.path([]),'');assert.equal(C.path([[2,3]]),'M2,3');
for(const points of [[[0,0],[1,1],[2,8],[3,10]],[[0,5],[1,5],[2,5]],[[0,1],[1,4],[2,-2],[3,8]],[[0,10],[1,9],[2,3],[3,0]],[[3,0],[2,3],[1,9],[0,10]]]){
 const path=C.path(points);assert(!/NaN|Infinity/.test(path));
 const curves=path.split(' C').slice(1).map(s=>s.split(/[ ,]/).map(Number));assert.equal(curves.length,points.length-1);
 curves.forEach((c,i)=>{assert.deepEqual(c.slice(4),points[i+1]);const lo=Math.min(points[i][1],points[i+1][1]),hi=Math.max(points[i][1],points[i+1][1]);for(let k=0;k<=100;k++){const t=k/100,u=1-t,y=u*u*u*points[i][1]+3*u*u*t*c[1]+3*u*t*t*c[3]+t*t*t*c[5];assert(y>=lo-1e-9&&y<=hi+1e-9,'Curve must not invent extrema')}})
}
console.log('Curve endpoints and no-overshoot checks passed.');
