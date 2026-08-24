import { Schema, model } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

const promptVersionSchema = new Schema(
  {
    // 归属的 Prompt（ObjectId 引用），见设计文档 6.3
    promptId: { type: Schema.Types.ObjectId, required: true, index: true },

    // 整数自增版本号：1、2、3……
    version: { type: Number, required: true },

    // 该版本的完整内容（含 {{variable}} 模板）
    content: { type: String, required: true },

    // 该版本内容提取出的变量名列表（冗余存储）
    variables: { type: [String], default: [] },

    // 创建人（记录 userId，v1 用 'system' 标识初始版本）
    createdBy: { type: String, default: 'system' },
  },
  { timestamps: true },
);

// 复合索引：按 promptId 查，version 倒序取最新
promptVersionSchema.index({ promptId: 1, version: -1 });

/** 推导出的文档类型 */
export type PromptVersionDoc = InferSchemaType<typeof promptVersionSchema>;

export const PromptVersion = model('PromptVersion', promptVersionSchema);
