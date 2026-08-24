import { Schema, model } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    // 唯一索引：注册时由数据库兜底保证不重复（见设计文档 6.1）
    username: { type: String, required: true, unique: true, trim: true },
    // select: false → 默认查询不返回密码，登录校验时再显式 .select('+password')
    password: { type: String, required: true, select: false },
    // 昵称：可选，默认空字符串（前端为空时回退展示 username）
    nickname: { type: String, default: '', maxlength: 30, trim: true },
    // 头像：相对 URL 路径（如 /uploads/xxx.png），默认空
    avatar: { type: String, default: '' },
  },
  { timestamps: true },
);

/** 推导出的文档类型：{ username, password, nickname, avatar, createdAt, updatedAt } */
export type UserDoc = InferSchemaType<typeof userSchema>;

export const User = model('User', userSchema);
