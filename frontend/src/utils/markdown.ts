import MarkdownIt from 'markdown-it';

/** 渲染 AI 输出的 Markdown。关闭原生 html，防止注入 */
export const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});
