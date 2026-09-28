import type { HistoryItem } from "../types";

export function safeFileName(value: string): string {
  return (
    value
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
      .trim()
      .slice(0, 80) || "ai-record"
  );
}
export function historyMarkdown(item: HistoryItem): string {
  // Fence user input so source code and embedded HTML remain literal in Markdown exports.
  const longest = Math.max(
    2,
    ...Array.from(item.input.matchAll(/`+/g), (match) => match[0].length),
  );
  const fence = "`".repeat(longest + 1);
  return [
    `# ${item.title.replace(/[\r\n]+/g, " ") || "AI 工作台记录"}`,
    "",
    `- 来源：${item.type === "chat" ? "AI 对话" : "代码工具"}`,
    `- 模型：${item.model || "-"}`,
    `- 时间：${item.createdAt}`,
    "",
    "## 输入",
    "",
    fence,
    item.input || "",
    fence,
    "",
    "## 输出",
    "",
    item.output || "（无输出）",
    "",
  ].join("\n");
}
export function downloadHistory(item: HistoryItem) {
  const url = URL.createObjectURL(
    new Blob([historyMarkdown(item)], { type: "text/markdown;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(item.title)}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
