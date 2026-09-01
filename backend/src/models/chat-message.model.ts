import { Schema, model } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

const schema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, required: true, index: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  tokenUsage: { type: Object, default: undefined },
}, { timestamps: true });
schema.index({ sessionId: 1, createdAt: 1 });
export type ChatMessageDoc = InferSchemaType<typeof schema>;
export const ChatMessage = model('ChatMessage', schema);
