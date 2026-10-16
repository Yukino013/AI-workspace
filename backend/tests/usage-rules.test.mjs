import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargeFor, completeUsage, estimateReservation, quotaDate } from '../dist/services/usage/rules.js';
import {
  DEFAULT_DAILY_LIMIT,
  MAX_ACTIVE_REQUESTS,
  MAX_DAILY_LIMIT,
  MAX_OUTPUT_TOKENS,
  REQUEST_TIMEOUT_MS,
} from '../dist/models/usage.model.js';

/** 构造 usage；默认视为供应商完整上报 */
function usage(promptTokens, completionTokens, totalTokens = promptTokens + completionTokens, complete = true) {
  return { promptTokens, completionTokens, totalTokens, complete };
}

test('quotaDate 以北京时间 00:00 切分额度日', () => {
  // 北京时间 10-15 23:59:59.999 == UTC 15:59:59.999
  assert.equal(quotaDate(new Date('2026-10-15T15:59:59.999Z')), '2026-10-15');
  // 北京时间 10-16 00:00:00 == UTC 16:00:00
  assert.equal(quotaDate(new Date('2026-10-15T16:00:00.000Z')), '2026-10-16');
  assert.equal(quotaDate(new Date('2026-10-15T23:30:00.000Z')), '2026-10-16');
  assert.equal(quotaDate(new Date('2026-10-16T00:01:00.000Z')), '2026-10-16');
  assert.equal(quotaDate(new Date('2026-10-16T15:00:00.000Z')), '2026-10-16');
});

test('estimateReservation 采用保守估算并含输出上限', () => {
  const single = estimateReservation([{ role: 'user', content: 'abc' }]);
  assert.equal(single, 128 + 3 + 16 + MAX_OUTPUT_TOKENS);
  assert.ok(single > MAX_OUTPUT_TOKENS, '预占必须包含单次最大输出');
  assert.ok(estimateReservation([{ role: 'user', content: 'a'.repeat(1000) }]) > single);
  assert.ok(estimateReservation([]) >= MAX_OUTPUT_TOKENS);
  // 多字节字符按 UTF-8 字节数计，不按字符数
  assert.equal(
    estimateReservation([{ role: 'user', content: '中' }]),
    128 + Buffer.byteLength('中', 'utf8') + 16 + MAX_OUTPUT_TOKENS,
  );
});

test('completeUsage 只承认完整且自洽的 usage', () => {
  assert.equal(completeUsage(usage(10, 5)), true);
  assert.equal(completeUsage(undefined), false);
  assert.equal(completeUsage(usage(10, 5, 15, false)), false, 'complete 标记缺失时不算已知');
  assert.equal(completeUsage(usage(10, 5, 14)), false, 'total 小于输入加输出时视为不自洽');
  assert.equal(completeUsage(usage(-1, 5)), false);
  assert.equal(completeUsage({ promptTokens: 10, completionTokens: 5, totalTokens: 10.5, complete: true }), false);
  assert.equal(completeUsage({ promptTokens: 10, completionTokens: 5, totalTokens: 999_999_999, complete: true }), false);
});

test('chargeFor 完整 usage 记实际，缺失或部分 usage 保守扣额', () => {
  assert.deepEqual(chargeFor(1000, usage(800, 400)), { charged: 1200, source: 'reported' });
  assert.deepEqual(chargeFor(1000, usage(100, 50, 150, false)), { charged: 1000, source: 'estimated' });
  assert.deepEqual(chargeFor(1000, usage(900, 500, 1400, false)), { charged: 1400, source: 'estimated' }, '已知下界大于预占时用下界');
  assert.deepEqual(chargeFor(1000, undefined), { charged: 1000, source: 'estimated' });
  assert.deepEqual(
    chargeFor(1000, { promptTokens: 1200, completionTokens: 0, totalTokens: 0, complete: false }),
    { charged: 1200, source: 'estimated' },
  );
});

test('额度常量与已确认口径一致', () => {
  assert.equal(DEFAULT_DAILY_LIMIT, 1_000_000, '默认每日额度按确认结果固定为 1,000,000');
  assert.equal(MAX_DAILY_LIMIT, 10_000_000);
  assert.equal(MAX_ACTIVE_REQUESTS, 3);
  assert.equal(MAX_OUTPUT_TOKENS, 4096);
  assert.equal(REQUEST_TIMEOUT_MS, 180_000);
});
