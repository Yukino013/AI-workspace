import mongoose from 'mongoose';
import { Prompt } from '../models/prompt.model.js';
import { PromptVersion } from '../models/prompt-version.model.js';
import { ChatRecord } from '../models/chat-record.model.js';
import { extractVariables } from '../utils/variables.js';
import { AppError } from '../utils/AppError.js';

interface PromptInput {
  name: string;
  description?: string;
  content: string;
}

interface ListQuery {
  keyword?: string;
  page: number;
  pageSize: number;
}

function toIso(v: unknown): string {
  return v ? new Date(v as string).toISOString() : '';
}

function toPromptDto(doc: {
  _id: unknown;
  name: string;
  description?: string | null;
  content: string;
  variables: string[];
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(doc._id),
    name: doc.name,
    description: doc.description ?? '',
    content: doc.content,
    variables: doc.variables ?? [],
    currentVersion: doc.currentVersion,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

function toVersionDto(doc: {
  _id: unknown;
  promptId: unknown;
  version: number;
  content: string;
  variables: string[];
  createdAt: Date;
  createdBy: string;
}) {
  return {
    id: String(doc._id),
    promptId: String(doc.promptId),
    version: doc.version,
    content: doc.content,
    variables: doc.variables ?? [],
    createdAt: toIso(doc.createdAt),
    createdBy: doc.createdBy,
  };
}

/** 校验资源归属：只能访问自己的 Prompt（userId 过滤），不存在/越权统一 404 不泄露存在性 */
async function assertOwned(userId: string, id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, 40401, 'Prompt 不存在');
  }
  const prompt = await Prompt.findOne({ _id: id, userId });
  if (!prompt) {
    throw new AppError(404, 40401, 'Prompt 不存在');
  }
  return prompt;
}

export async function listPrompts(userId: string, query: ListQuery) {
  const filter: Record<string, unknown> = { userId };
  if (query.keyword) {
    const pattern = new RegExp(query.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: pattern }, { description: pattern }];
  }

  const skip = (query.page - 1) * query.pageSize;
  const [docs, total] = await Promise.all([
    Prompt.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(query.pageSize),
    Prompt.countDocuments(filter),
  ]);

  return { items: docs.map(toPromptDto), total, page: query.page, pageSize: query.pageSize };
}

export async function createPrompt(userId: string, input: PromptInput) {
  const variables = extractVariables(input.content);
  const prompt = await Prompt.create({
    userId,
    name: input.name,
    description: input.description ?? '',
    content: input.content,
    variables,
    currentVersion: 1,
  });

  // 初始版本 v1，见设计文档 6.3 / 7.7
  await PromptVersion.create({
    promptId: prompt._id,
    version: 1,
    content: input.content,
    variables,
    createdBy: userId,
  });

  return toPromptDto(prompt);
}

export async function getPrompt(userId: string, id: string) {
  return toPromptDto(await assertOwned(userId, id));
}

export async function updatePrompt(userId: string, id: string, input: PromptInput) {
  const prompt = await assertOwned(userId, id);
  const variables = extractVariables(input.content);
  const contentChanged = prompt.content !== input.content;
  const nextVersion = contentChanged ? prompt.currentVersion + 1 : prompt.currentVersion;

  prompt.name = input.name;
  prompt.description = input.description ?? '';
  prompt.content = input.content;
  prompt.variables = variables;
  prompt.currentVersion = nextVersion;
  await prompt.save();

  // 内容变化才生成新版本，避免产生空版本（见 7.7）
  if (contentChanged) {
    await PromptVersion.create({
      promptId: prompt._id,
      version: nextVersion,
      content: input.content,
      variables,
      createdBy: userId,
    });
  }

  return toPromptDto(prompt);
}

export async function deletePrompt(userId: string, id: string) {
  const prompt = await assertOwned(userId, id);
  // 级联删除版本与调用记录（见 7.2）
  await Promise.all([
    prompt.deleteOne(),
    PromptVersion.deleteMany({ promptId: prompt._id }),
    ChatRecord.deleteMany({ promptId: prompt._id }),
  ]);
}

export async function listVersions(userId: string, id: string) {
  await assertOwned(userId, id);
  const versions = await PromptVersion.find({ promptId: id }).sort({ version: -1 });
  return versions.map(toVersionDto);
}

export async function restoreVersion(userId: string, id: string, version: number) {
  const prompt = await assertOwned(userId, id);
  const source = await PromptVersion.findOne({ promptId: prompt._id, version });
  if (!source) {
    throw new AppError(404, 40401, '历史版本不存在');
  }

  // 恢复 = 把历史内容写回 Prompt，并生成一个新版本（见 6.3）
  const nextVersion = prompt.currentVersion + 1;
  prompt.content = source.content;
  prompt.variables = [...source.variables];
  prompt.currentVersion = nextVersion;
  await prompt.save();

  await PromptVersion.create({
    promptId: prompt._id,
    version: nextVersion,
    content: source.content,
    variables: [...source.variables],
    createdBy: userId,
  });

  return toPromptDto(prompt);
}
