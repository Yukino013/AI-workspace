<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createConversation, deleteConversation, getConversation, getConversations, updateConversation } from '@/api/conversation';
import { streamEndpoint } from '@/utils/sse';
import { MODEL_OPTIONS } from '@/utils/constants';
import ChatMessage from '@/components/ChatMessage.vue';
import type { Conversation, ConversationDetail, ConversationMessage } from '@/types';

const conversations = ref<Conversation[]>([]); const active = ref<ConversationDetail | null>(null); const model = shallowRef<string>(MODEL_OPTIONS[0].value); const input = shallowRef(''); const loading = shallowRef(false); const streaming = shallowRef(false); const aborter = shallowRef<AbortController | null>(null);
async function load() { conversations.value = await getConversations(); if (!active.value && conversations.value[0]) await open(conversations.value[0]); }
async function open(item: Conversation) { loading.value = true; try { active.value = await getConversation(item.id); model.value = active.value.model; } finally { loading.value = false; } }
async function changeModel() { if (active.value && model.value !== active.value.model) { const id = active.value.id; await updateConversation(id, model.value); active.value = await getConversation(id); } }
async function newChat() { const item = await createConversation(model.value); conversations.value.unshift(item); await open(item); }
async function remove(item: Conversation) { try { await ElMessageBox.confirm('删除后会话消息无法恢复，确定继续吗？', '删除会话', { type: 'warning' }); } catch { return; } await deleteConversation(item.id); if (active.value?.id === item.id) active.value = null; await load(); }
function appendAssistant(text: string) { if (!active.value) return; const messages = active.value.messages; const last = messages[messages.length - 1]; if (last?.role === 'assistant' && last.id === 'streaming') last.content += text; else messages.push({ id: 'streaming', role: 'assistant', content: text, createdAt: new Date().toISOString() } as ConversationMessage); }
function send() { const content = input.value.trim(); if (!content || !active.value || streaming.value) return; input.value = ''; streaming.value = true; active.value.messages.push({ id: `user-${Date.now()}`, role: 'user', content, createdAt: new Date().toISOString() }); const controller = streamEndpoint(`/api/conversations/${active.value.id}/stream`, { content }, { onChunk: appendAssistant, onDone: async () => { streaming.value = false; aborter.value = null; await open(active.value!); await load(); }, onError: (err) => { streaming.value = false; aborter.value = null; ElMessage.error(err.message); } }); aborter.value = controller; }
function stop() { aborter.value?.abort(); aborter.value = null; streaming.value = false; }
onMounted(load);
</script>

<template>
  <div class="chat-layout" v-loading="loading">
    <aside class="sessions"><div class="sessions-head"><span>会话</span><el-button type="primary" size="small" @click="newChat">新建</el-button></div><div v-if="!conversations.length" class="empty">还没有会话</div><button v-for="item in conversations" :key="item.id" class="session-item" :class="{ active: active?.id === item.id }" @click="open(item)"><span class="session-title">{{ item.title }}</span><el-button link type="danger" @click.stop="remove(item)">删除</el-button></button></aside>
    <main class="chat-main"><template v-if="active"><header class="chat-head"><div><h2>{{ active.title }}</h2><span>{{ active.model }}</span></div><el-select v-model="model" size="small" style="width: 180px" @change="changeModel"><el-option v-for="option in MODEL_OPTIONS" :key="option.value" v-bind="option" /></el-select></header><el-scrollbar class="messages"><ChatMessage v-for="message in active.messages" :key="message.id" :role="message.role" :content="message.content" /></el-scrollbar><div class="composer"><el-input v-model="input" type="textarea" :rows="3" resize="none" placeholder="输入消息，Enter 发送" @keydown.enter.exact.prevent="send" /><div class="composer-actions"><el-button v-if="streaming" @click="stop">停止</el-button><el-button type="primary" :loading="streaming" @click="send">发送</el-button></div></div></template><el-empty v-else description="新建一个会话开始聊天"><el-button type="primary" @click="newChat">新建会话</el-button></el-empty></main>
  </div>
</template>

<style scoped>
.chat-layout { display: grid; grid-template-columns: 250px minmax(0, 1fr); height: calc(100vh - 104px); gap: 16px; }.sessions, .chat-main { min-height: 0; background: var(--app-bg); border: 1px solid var(--el-border-color-light); border-radius: 8px; }.sessions { padding: 14px 10px; overflow: auto; }.sessions-head, .chat-head { display: flex; justify-content: space-between; align-items: center; }.sessions-head { padding: 0 6px 12px; font-weight: 600; }.session-item { width: 100%; display: flex; align-items: center; justify-content: space-between; border: 0; background: transparent; padding: 10px 8px; border-radius: 6px; cursor: pointer; color: var(--app-text); text-align: left; }.session-item.active, .session-item:hover { background: var(--el-fill-color-light); }.session-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.empty { padding: 30px 8px; color: var(--app-muted); text-align: center; font-size: 13px; }.chat-main { display: flex; flex-direction: column; overflow: hidden; }.chat-head { padding: 16px 20px; border-bottom: 1px solid var(--el-border-color-light); }.chat-head h2 { margin: 0 0 4px; font-size: 16px; }.chat-head span { color: var(--app-muted); font-size: 12px; }.messages { flex: 1; padding: 20px; }.composer { padding: 14px 20px; border-top: 1px solid var(--el-border-color-light); }.composer-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; } @media (max-width: 720px) { .chat-layout { grid-template-columns: 1fr; height: auto; }.sessions { max-height: 210px; }.chat-main { min-height: 600px; } }
</style>
