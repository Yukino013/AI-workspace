import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const promptSchema = new Schema(
  {
    // 用户 ID：必须，用于资源隔离
    userId: { type: String, required: true, index: true },

    // Prompt 名称
    name: { type: String, required: true, trim: true },

    // Prompt 描述
    description: { type: String, trim: true },

    // Prompt 内容（含 {{variable}} 模板）
    content: { type: String, required: true },

    // 自动提取的变量名列表（冗余存储，便于查询和展示）
    variables: { type: [String], default: [] },

    // 当前版本号（从 1 开始）
    currentVersion: { type: Number, default: 1 },
  },
  {
    timestamps: true,
  },
);

// 复合索引：用户 ID + 用于查询用户的 Prompt
promptSchema.index({ userId: 1, createdAt: -1 });

// 复合索引：用户 ID + name，用于搜索
promptSchema.index({ userId: 1, name: "text", description: "text" });

/** 推导出的文档类型 */
export type PromptDoc = InferSchemaType<typeof promptSchema>;

export const Prompt = model("Prompt", promptSchema);
