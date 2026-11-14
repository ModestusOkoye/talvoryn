import {DatabaseSync} from 'node:sqlite';
export class LocalD1 {
 constructor(path){this.sqlite=new DatabaseSync(path)}
 prepare(sql){const db=this;return {args:[],bind(...a){this.args=a;return this},async first(){return db.sqlite.prepare(sql).get(...this.args)||null},async all(){return {results:db.sqlite.prepare(sql).all(...this.args)}},async run(){const r=db.sqlite.prepare(sql).run(...this.args);return {meta:{changes:Number(r.changes)}}}}}
 async batch(statements){this.sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());this.sqlite.exec('COMMIT');return r}catch(e){this.sqlite.exec('ROLLBACK');throw e}}
 close(){this.sqlite.close()}
}
