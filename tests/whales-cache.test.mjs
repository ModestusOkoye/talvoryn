import assert from 'node:assert/strict';
import {mergeWhaleSnapshots} from '../worker/whales.mjs';
const roster=[{account:'alice.near'},{account:'bob.near'}],before={from:'2026-11-13T00:00:00Z',through:'2026-11-13T10:00:00Z',wallets:[{account:'alice.near',inflow:500,outflow:100},{account:'bob.near',inflow:20,outflow:0}],events:[]};
const next={from:before.from,through:'2026-11-13T11:00:00Z',roster,wallets:[{account:'bob.near',inflow:40,outflow:10}],events:[]};
const merged=mergeWhaleSnapshots(before,next);assert.equal(merged.wallets.length,2);assert.equal(merged.net,430);assert.equal(merged.cachedWallets,1);assert.equal(merged.partialWallets,0);assert.equal(merged.wallets.find(w=>w.account==='alice.near').observedThrough,before.through);
const day=mergeWhaleSnapshots(before,{...next,from:'2026-11-14T00:00:00Z',through:'2026-11-14T01:00:00Z'});assert.equal(day.wallets.length,1);assert.equal(day.net,30);console.log('Partial refresh preserves timestamped valid readings without carrying yesterday into today.');

const legacy=mergeWhaleSnapshots({...before,classification:'transfers_only'},{...next,classification:'verified_exchange_flows'});assert.equal(legacy.wallets.length,1);assert.equal(legacy.net,30);
