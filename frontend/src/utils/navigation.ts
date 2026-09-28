export const workspaceLinks = [
  {
    path: "/chat",
    label: "AI 对话",
    icon: "chat",
    section: "工作空间",
    description: "与模型一起思考、创作和解决问题",
  },
  {
    path: "/prompts",
    label: "Prompt 资源库",
    icon: "grid",
    description: "收藏、管理和复用你的提示词",
  },
  {
    path: "/prompts/new",
    label: "Prompt 工作台",
    icon: "prompt",
    description: "创建提示词，调试变量和版本",
  },
  {
    path: "/code-tools",
    label: "代码工具",
    icon: "code",
    description: "解释、翻译、重构、审查和测试",
  },
  {
    path: "/history",
    label: "历史记录",
    icon: "history",
    section: "记录与管理",
    description: "找回对话和代码工具的生成结果",
  },
  {
    path: "/call-records",
    label: "调用记录",
    icon: "clock",
    description: "查看 Prompt 的运行结果",
  },
  {
    path: "/providers",
    label: "模型与 API",
    icon: "settings",
    description: "管理模型服务与 API Key",
  },
] as const;
