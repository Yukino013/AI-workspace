/** 匹配 {{variable}}，变量名只允许字母、数字、下划线。见设计文档 7.3 */
const VAR_REG = /\{\{\s*(\w+)\s*\}\}/g;

/** 提取 Prompt 内容中的所有变量名（去重、保序） */
export function extractVariables(content: string): string[] {
  const keys = [...content.matchAll(VAR_REG)].map((m) => m[1]);
  return [...new Set(keys)];
}

/** 用实际值渲染 Prompt：把 {{var}} 替换为对应值，缺失的变量替换为空字符串 */
export function renderPrompt(content: string, variables: Record<string, string>): string {
  return content.replace(VAR_REG, (_, key: string) => variables[key] ?? '');
}
