export const CODE_TOOLS = [
  { key: 'explain', name: '代码解释', description: '逐段解释代码逻辑与关键设计', inputHint: '粘贴需要解释的代码' },
  { key: 'translate', name: '代码翻译', description: '在语言之间转换实现并保留行为', inputHint: '粘贴代码，并说明目标语言' },
  { key: 'refactor', name: '代码重构', description: '优化结构、可读性和可维护性', inputHint: '粘贴需要重构的代码' },
  { key: 'review', name: 'Code Review', description: '审查潜在 Bug、安全和性能问题', inputHint: '粘贴待审查的代码' },
  { key: 'test', name: '生成测试', description: '生成覆盖核心场景的单元测试', inputHint: '粘贴需要测试的代码' },
] as const;
export type CodeToolKey = typeof CODE_TOOLS[number]['key'];
export const CODE_TOOL_PROMPTS: Record<CodeToolKey, string> = {
  explain: '你是一名资深工程师，请逐段解释下面代码的职责、执行流程和潜在注意事项。',
  translate: '你是一名跨语言工程师，请根据用户指定的目标语言翻译下面代码，并说明关键差异。',
  refactor: '你是一名资深工程师，请重构下面代码，保持行为不变，输出改进后的完整代码并解释改动。',
  review: '你是一名严格的 Code Reviewer，请按严重程度指出下面代码的 Bug、安全、性能和可维护性问题，并给出建议。',
  test: '你是一名测试工程师，请为下面代码生成完整、可运行的单元测试，覆盖正常、边界和错误场景。',
};
