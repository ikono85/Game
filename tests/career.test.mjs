// Carrière : règles du banzuke et basho fini mais pas encore clos (page fermée avant le classement).
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASHO_DAYS, bashoOver, judgeBasho } from '../src/game/banzuke.js';

const basho = (wins, day = BASHO_DAYS) => ({ day, opps: [], results: Array.from({ length: day }, (_, k) => (k < wins ? 1 : 0)) });
const car = (rank, wins, extra = {}) => ({ rank, best: rank, bashoNo: 1, yusho: 0, basho: basho(wins), ...extra });

test('basho fini : reconnu par le jour comme par les résultats', () => {
  assert.equal(bashoOver(car(0, 4)), true);
  assert.equal(bashoOver({ rank: 0, basho: basho(3, 6) }), false);
  assert.equal(bashoOver({ rank: 0, basho: { day: 7, results: [] } }), true);
  assert.equal(bashoOver({ rank: 0, basho: null }), false);
  assert.equal(bashoOver(null), false);
});

test('kachi-koshi : promotion ; make-koshi : rétrogradation (sauf au plus bas)', () => {
  const up = car(3, 4); judgeBasho(up); assert.equal(up.rank, 4); assert.equal(up.best, 4);
  const down = car(3, 3); assert.equal(judgeBasho(down).cls, 'down'); assert.equal(down.rank, 2); assert.equal(down.best, 3);
  const floor = car(0, 2); judgeBasho(floor); assert.equal(floor.rank, 0);
});

test('7-0 : deux rangs et un yusho, jamais au-delà d’Ōzeki', () => {
  const c = car(2, 7); judgeBasho(c); assert.equal(c.rank, 4); assert.equal(c.yusho, 1);
  const s = car(7, 7); judgeBasho(s); assert.equal(s.rank, 8);
});

test('Ōzeki : 6 victoires pour Yokozuna, et un Yokozuna ne descend pas', () => {
  const o5 = car(8, 5); judgeBasho(o5); assert.equal(o5.rank, 8);
  const o6 = car(8, 6); judgeBasho(o6); assert.equal(o6.rank, 9);
  const y = car(9, 0); assert.equal(judgeBasho(y).cls, 'down'); assert.equal(y.rank, 9);
});
