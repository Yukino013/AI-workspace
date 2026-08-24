import { Schema, model } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

const tokenUsageSchema = new Schema(
  {
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
  { _id: false },
);

const chatRecordSchema = new Schema(
  {
    // 用户 ID（字符串，与 auth 中间件的 req.user.userId 一致）
    userId: { type: String, required: true, index: true },

    // 使用的 Prompt（ObjectId 引用）
    promptId: { type: Schema.Types.ObjectId, required: true },

    // Prompt 名称快照（冗余存储，供调用历史列表直接展示，避免每次 join）
    promptName: { type: String, default: '' },

    // 运行时 Prompt 的版本号（快照，便于回看）
    promptVersion: { type: Number, required: true },

    // 使用的模型标识（'deepseek-v4-pro' | 'qwen-plus' | 'claude-sonnet-5'）
    model: { type: String, required: true },

    // 变量替换后的完整 AI 输入
    input: { type: String, default: '' },

    // 流式聚合后的最终完整输出
    output: { type: String, default: '' },

    // 请求耗时（ms）
    duration: { type: Number, default: 0 },

    // Token 用量
    tokenUsage: { type: tokenUsageSchema, default: () => ({}) },

    // 请求状态：success / error / aborted
    status: { type: String, enum: ['success', 'error', 'aborted'], default: 'success' },

    // 失败时的错误信息
    errorMessage: { type: String },
  },
  { timestamps: true },
);

// 复合索引：用户 ID + 创建时间倒序（调用历史分页）
chatRecordSchema.index({ userId: 1, createdAt: -1 });

/** 推导出的文档类型 */
export type ChatRecordDoc = InferSchemaType<typeof chatRecordSchema>;

export const ChatRecord = model('ChatRecord', chatRecordSchema);
