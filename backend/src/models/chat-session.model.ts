import { Schema, model } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

const schema = new Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  model: { type: String, required: true },
}, { timestamps: true });
schema.index({ userId: 1, updatedAt: -1 });
export type ChatSessionDoc = InferSchemaType<typeof schema>;
export const ChatSession = model('ChatSession', schema);
