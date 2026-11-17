import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {writeIfCurrent,currentRevision} from '../../worker/storage.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

function fakeDb(initial='a'.repeat(64)){
  let current=initial;
  const db={
    prepare(sql){
      const statement={sql,values:[],bind(...values){this.values=values;return this;},
        async first(){return {hash:current}},
      };
      return statement;
    },
    async batch(statements){
      const update=statements[1];
      const [next,name,expected]=update.values;
      assert.equal(name,'supply-daily');
      const changes=current===expected?1:0;
      if(changes)current=next;
      return [{meta:{changes:0}},{meta:{changes}}];
    }
  };
  return {db,revision:()=>current,interfere(hash){current=hash}};
}
test('matching revision advances pointer',async()=>{
  const f=fakeDb();
  const result=await writeIfCurrent(f.db,'supply-daily',{daily:[{date:'2026-11-17'}]},'a'.repeat(64));
  assert.match(result.hash,/^[a-f0-9]{64}$/);
  assert.equal(f.revision(),result.hash);
});
test('stale revision is rejected and newer pointer survives',async()=>{
  const f=fakeDb();
  f.interfere('b'.repeat(64));
  const result=await writeIfCurrent(f.db,'supply-daily',{daily:[]},'a'.repeat(64));
  assert.deepEqual(result,{conflict:true});
  assert.equal(f.revision(),'b'.repeat(64));
});
test('missing revision is refused before any database write',async()=>{
  const f=fakeDb();
  await assert.rejects(()=>writeIfCurrent(f.db,'supply-daily',{},null),/Expected revision/);
  assert.equal(f.revision(),'a'.repeat(64));
});
test('revision endpoint helper returns current pointer',async()=>{
  const f=fakeDb();
  assert.equal(await currentRevision(f.db,'supply-daily'),'a'.repeat(64));
});
