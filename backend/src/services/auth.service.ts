import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

/** 签发 JWT：payload 只放身份信息，见设计文档 7.1 */
function signToken(userId: string, username: string): string {
  // @types/jsonwebtoken 把 expiresIn 限定为 ms 字面量类型（如 '7d'），
  // 而环境变量是运行时 string，需断言才能通过类型检查
  const options = {
    expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign({ userId, username }, config.jwt.secret, options);
}

/** 去掉敏感字段，统一对外返回的用户结构 */
function toUserDto(user: {
  _id: unknown;
  username: string;
  nickname?: string;
  avatar?: string;
}) {
  return {
    id: String(user._id),
    username: user.username,
    nickname: user.nickname ?? '',
    avatar: user.avatar ?? '',
  };
}

/** 注册：用户名查重 → bcrypt 加密 → 入库 */
export async function register(username: string, password: string) {
  const exists = await User.findOne({ username });
  if (exists) {
    throw new AppError(400, 40001, '用户名已存在');
  }

  const hash = await bcrypt.hash(password, 10); // 10 = salt rounds
  const user = await User.create({ username, password: hash });

  return toUserDto(user);
}

/** 登录：查用户 → bcrypt 比对 → 签发 token */
export async function login(username: string, password: string) {
  // select('+password')：默认不返回密码，这里显式取回用于比对
  const user = await User.findOne({ username }).select('+password');
  // 用户不存在和密码错误返回同样的信息，避免泄露「用户名是否注册过」
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError(401, 40101, '用户名或密码错误');
  }

  const token = signToken(user._id.toString(), user.username);
  return { token, user: toUserDto(user) };
}

/** 获取当前用户：由 auth 中间件保证已登录，这里按 userId 查库 */
export async function me(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 40401, '用户不存在');
  }
  return toUserDto(user);
}

/** 更新昵称：nickname 允许为空（表示清除昵称），最多 30 字符 */
export async function updateProfile(userId: string, nickname: string) {
  const user = await User.findByIdAndUpdate(
    userId,
    { nickname },
    { new: true, runValidators: true },
  );
  if (!user) {
    throw new AppError(404, 40401, '用户不存在');
  }
  return toUserDto(user);
}

/** 更新头像：avatar 为上传后的相对 URL 路径（如 /uploads/xxx.png） */
export async function updateAvatar(userId: string, avatar: string) {
  const user = await User.findByIdAndUpdate(userId, { avatar }, { new: true });
  if (!user) {
    throw new AppError(404, 40401, '用户不存在');
  }
  return toUserDto(user);
}
