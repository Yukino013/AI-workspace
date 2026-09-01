import { Schema, model } from 'mongoose';
import type { InferSchemaType } from 'mongoose';
const schema = new Schema({
  userId: { type: String, required: true, index: true }, toolKey: { type: String, required: true }, title: { type: String, required: true }, model: { type: String, required: true }, input: { type: String, required: true }, output: { type: String, default: '' }, language: { type: String, default: '' }, duration: { type: Number, default: 0 }, tokenUsage: { type: Object }, status: { type: String, enum: ['success', 'error', 'aborted'], default: 'success' }, errorMessage: { type: String },
}, { timestamps: true });
schema.index({ userId: 1, createdAt: -1 });
export type CodeToolRecordDoc = InferSchemaType<typeof schema>;
export const CodeToolRecord = model('CodeToolRecord', schema);
