const DEVELOPMENT_SECRET = 'dev-secret-do-not-use-in-prod';
const PLACEHOLDER_SECRETS = new Set([
  DEVELOPMENT_SECRET,
  'replace-with-a-long-random-secret',
  'your-secret-key',
  'your-jwt-secret',
  'change-me',
  'changeme',
  'xxx',
]);

/** 只返回配置项名称和规则，不把密钥原文写入异常或日志。 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv): string {
  const secret = env.JWT_SECRET;
  if (env.NODE_ENV !== 'production') {
    return secret ?? DEVELOPMENT_SECRET;
  }

  if (!secret || !secret.trim()) {
    throw new Error('生产配置错误：必须设置 JWT_SECRET');
  }
  if (PLACEHOLDER_SECRETS.has(secret.trim().toLowerCase())) {
    throw new Error('生产配置错误：JWT_SECRET 不能使用开发默认值或示例占位值');
  }
  if (/\s/u.test(secret)) {
    throw new Error('生产配置错误：JWT_SECRET 不能包含空白字符');
  }
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('生产配置错误：JWT_SECRET 至少需要 32 字节，请使用安全随机生成的密钥');
  }
  if (new Set(secret).size === 1) {
    throw new Error('生产配置错误：JWT_SECRET 不能由单个字符重复组成');
  }

  // 长度和占位值检查不能证明随机性；部署时仍须用安全随机方式生成。
  return secret;
}
