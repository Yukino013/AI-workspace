import { historyMarkdown, safeFileName } from "./history-export";

export interface CodeToolRunContext {
  title: string;
  model: string;
  input: string;
  language: string;
  createdAt: string;
}

export interface CodeToolReport extends CodeToolRunContext {
  output: string;
  reasoning: string;
  running: boolean;
  stopped: boolean;
  error: string;
}

function literalBlock(value: string): string {
  const longest = Math.max(2, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  return `${fence}\n${value}\n${fence}`;
}

export function codeToolMarkdown(report: CodeToolReport): string {
  const status = report.running
    ? "生成中（当前快照，内容可能不完整）"
    : report.error
      ? "生成失败（内容可能不完整）"
      : report.stopped
        ? "已停止（内容可能不完整）"
        : "生成完成";
  return [
    historyMarkdown({ ...report, id: "", type: "code-tool" }).trimEnd(),
    "",
    "## 运行状态",
    "",
    status,
    ...(report.language ? ["", `目标语言：${report.language.replace(/[\r\n]+/g, " ")}`] : []),
    ...(report.error ? ["", "### 错误信息", "", literalBlock(report.error)] : []),
    ...(report.reasoning ? [
      "",
      "## 公开推理摘要",
      "",
      "仅包含模型服务返回的公开摘要，不代表隐藏思维链。",
      "",
      literalBlock(report.reasoning),
    ] : []),
    "",
  ].join("\n");
}

export function downloadCodeToolReport(report: CodeToolReport): void {
  const url = URL.createObjectURL(new Blob([codeToolMarkdown(report)], {
    type: "text/markdown;charset=utf-8",
  }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(report.title)}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
