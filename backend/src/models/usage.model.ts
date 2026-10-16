import { Schema, model } from 'mongoose';

export const DEFAULT_DAILY_LIMIT = 1_000_000;
export const MAX_DAILY_LIMIT = 10_000_000;
export const MAX_ACTIVE_REQUESTS = 3;
export const MAX_OUTPUT_TOKENS = 4096;
export const REQUEST_TIMEOUT_MS = 180_000;
const counter = () => ({ type: Number, default: 0, min: 0 });

const account = new Schema({
  userId: { type: String, required: true, unique: true },
  dailyTokenLimit: { type: Number, default: DEFAULT_DAILY_LIMIT },
  activeRequests: counter(), mutationVersion: counter(),
  trackingStartedAt: { type: Date, default: Date.now },
}, { timestamps: true });
export const QuotaAccount = model('QuotaAccount', account);

const daily = new Schema({
  userId: { type: String, required: true }, quotaDate: { type: String, required: true },
  dailyTokenLimit: { type: Number, required: true },
  startedRequests: counter(), successRequests: counter(), failedRequests: counter(), cancelledRequests: counter(),
  reportedInputTokens: counter(), reportedOutputTokens: counter(), reportedTokens: counter(),
  estimatedChargedTokens: counter(), consumedTokens: counter(), reservedTokens: counter(),
}, { timestamps: true });
daily.index({ userId: 1, quotaDate: 1 }, { unique: true });
export const DailyUsage = model('DailyUsage', daily);

const request = new Schema({
  requestId: { type: String, required: true, unique: true },
  userId: { type: String, required: true }, operationKey: { type: String, required: true },
  quotaDate: { type: String, required: true },
  source: { type: String, enum: ['prompt', 'conversation', 'code_tool', 'workflow'], required: true },
  sourceRef: { type: String, required: true }, model: { type: String, required: true },
  status: { type: String, enum: ['reserved', 'running', 'settled'], default: 'reserved' },
  outcome: { type: String, enum: ['success', 'error', 'cancelled', 'not_sent'], default: null },
  usageSource: { type: String, enum: ['reported', 'estimated', 'none'], default: null },
  reservedTokens: { type: Number, required: true },
  chargedTokens: { type: Number, default: null },
  reportedInputTokens: { type: Number, default: null }, reportedOutputTokens: { type: Number, default: null },
  reportedTotalTokens: { type: Number, default: null },
  estimateVersion: { type: String, default: 'utf8-bytes-v1' },
  startedAt: { type: Date, default: null }, finishedAt: { type: Date, default: null },
  deadlineAt: { type: Date, required: true },
  durationMs: counter(), errorCode: { type: String, default: '' },
  recovered: { type: Boolean, default: false },
}, { timestamps: true });
request.index({ userId: 1, operationKey: 1 }, { unique: true });
request.index({ userId: 1, quotaDate: 1, createdAt: -1 });
request.index({ status: 1, deadlineAt: 1 });
export const UsageRequest = model('UsageRequest', request);

// HTTP operation guard precedes business writes (messages / workflow runs).
const operation = new Schema({
  userId: { type: String, required: true }, operationKey: { type: String, required: true },
  payloadHash: { type: String, required: true }, resourceKey: { type: String, required: true },
  active: { type: Boolean, default: true }, expiresAt: { type: Date, required: true },
}, { timestamps: true });
operation.index({ userId: 1, operationKey: 1 }, { unique: true });
operation.index({ userId: 1, resourceKey: 1 }, { unique: true, partialFilterExpression: { active: true } });
operation.index({ active: 1, expiresAt: 1 });
export const UsageOperation = model('UsageOperation', operation);
