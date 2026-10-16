<script setup lang="ts">
import { computed, ref } from 'vue'
import { describeSave, exportSave, importSave } from '../game/state'

/**
 * 存档文本的中转弹窗。导出那一面把当前进度摊进文本框，让玩家复制走或落成文件；
 * 导入那一面正过来——粘贴、读剪贴板、读文件都只往文本框里填字，
 * 认出来了才亮"导入这份存档"，所以看一眼不会动进度。
 */
const props = defineProps<{ mode: 'export' | 'import' }>()
const emit = defineEmits<{ close: []; notice: [text: string] }>()

const text = ref(props.mode === 'export' ? exportSave() : '')
const trouble = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const title = computed(() => (props.mode === 'export' ? '导 出 存 档' : '导 入 存 档'))
const summary = computed(() => (props.mode === 'import' ? describeSave(text.value) : null))
const canApply = computed(() => Boolean(summary.value))

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

async function onCopy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(text.value)
    trouble.value = ''
    emit('notice', '存档已复制到剪贴板')
  } catch {
    // 无痕模式、没授权、非安全上下文都会走到这里：文本框本身就能手动复制
    trouble.value = '浏览器不让直接复制。在文本框里全选（Ctrl+A）再 Ctrl+C 一样能带走。'
  }
}

function onDownload(): void {
  // 摊出来的是 base64 存档码，不是 JSON 了，别再用 .json 骗编辑器
  const url = URL.createObjectURL(new Blob([text.value], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `问道长生-存档-${stamp()}.txt`
  document.body.append(a)
  a.click()
  a.remove()
  // 立刻 revoke 会让浏览器来不及把请求发出去，给它几秒
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  emit('notice', `已下载 ${a.download}`)
}

async function onReadClipboard(): Promise<void> {
  try {
    text.value = await navigator.clipboard.readText()
    trouble.value = ''
  } catch {
    trouble.value = '浏览器不让直接读剪贴板。把存档文本粘到下面的文本框里也行。'
  }
}

function onPickFile(): void {
  fileInput.value?.click()
}

async function onFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  // 清掉 value，否则连着选同一个文件不会重新触发 change
  input.value = ''
  if (!file) return
  if (file.size > 200_000) {
    trouble.value = '这个文件太大，不像存档。'
    return
  }
  text.value = await file.text()
  trouble.value = ''
}

function onApply(): void {
  if (!summary.value) return
  emit('notice', importSave(text.value) ? '已导入，进度连同设置都换成了那一份' : '这份存档读不进去，当前进度没动')
  emit('close')
}

function selectAll(e: Event): void {
  (e.target as HTMLTextAreaElement).select()
}
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <section class="dialog" role="dialog" :aria-label="mode === 'export' ? '导出存档' : '导入存档'">
      <h2 class="title">{{ title }}</h2>

      <p class="guide">
        <template v-if="mode === 'export'">
          这一整段就是当前的修行进度。复制走存着，或者落成文件；哪天想接着练，粘回「导入存档」的文本框里就行。
        </template>
        <template v-else>
          把存档文本粘进来，或者按下面的按钮从剪贴板、文件里读。认出来了会先念出那份档的灵气、最后保存时间和游玩时长，确认才覆盖，取消一点都不动。
        </template>
      </p>

      <textarea
        v-model="text"
        class="field"
        :class="{ out: mode === 'export' }"
        :readonly="mode === 'export'"
        spellcheck="false"
        aria-label="存档文本"
        placeholder="把存档文本粘贴到这里"
        @click="selectAll"
      ></textarea>

      <p v-if="summary" class="read yes">这是：{{ summary }}</p>
      <p v-else-if="mode === 'import' && text.trim()" class="read no">这不是这份游戏的存档，导入按钮点不动。</p>
      <p v-if="trouble" class="read no">{{ trouble }}</p>

      <footer class="foot">
        <template v-if="mode === 'export'">
          <button class="key" type="button" @click="onCopy">复制到剪贴板</button>
          <button class="key" type="button" @click="onDownload">导出成文件</button>
        </template>
        <template v-else>
          <button class="key" type="button" @click="onReadClipboard">从剪贴板读取</button>
          <button class="key" type="button" @click="onPickFile">从文件读取</button>
        </template>
        <button
          v-if="mode === 'import'"
          class="key apply"
          type="button"
          :class="{ live: canApply }"
          :disabled="!canApply"
          @click="onApply"
        >导入这份存档</button>
        <button class="key quit" type="button" @click="emit('close')">
          {{ mode === 'export' ? '关 闭' : '取 消' }}
        </button>
      </footer>

      <input
        ref="fileInput"
        class="file"
        type="file"
        accept="application/json,.json,text/plain"
        tabindex="-1"
        @change="onFile"
      />
    </section>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--veil);
  backdrop-filter: blur(3px);
  animation: fade-in 0.18s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.dialog {
  width: min(620px, 100%);
  max-height: min(88vh, 760px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 24px 22px;
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, var(--bg-mid) 100%);
  box-shadow: var(--shadow-panel);
}

.title {
  margin: 0;
  font-size: 17px;
  letter-spacing: 6px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
}

.guide {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  letter-spacing: 0.5px;
  color: var(--ink-faint);
}

.field {
  width: 100%;
  min-height: 9rem;
  padding: 12px 14px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  background: #ffffff;
  color: var(--ink-dim);
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0;
  resize: vertical;
  word-break: break-all;
}

.field:focus-visible {
  outline: 2px solid var(--accent-line);
  outline-offset: 1px;
}

.field.out {
  color: var(--ink);
  background: var(--tint);
}

.read {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.5px;
}

.read.yes {
  color: var(--accent-deep);
}

.read.no {
  color: var(--lose);
}

.foot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.key {
  cursor: pointer;
  flex: 1;
  min-width: 130px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-flat);
  color: var(--ink-dim);
  font-size: 13px;
  letter-spacing: 1px;
  font-family: inherit;
  box-shadow: 0 3px 0 rgba(150, 180, 210, 0.4);
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.08s ease;
}

.key:hover:not(:disabled) {
  border-color: var(--accent-line);
  background: var(--accent-wash);
  color: var(--accent-deep);
}

.key:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 1px 0 rgba(150, 180, 210, 0.4);
}

.key.apply {
  border-color: var(--lose-line);
  color: var(--lose);
}

.key.apply.live {
  background: var(--lose-wash);
  font-weight: 600;
}

.key.apply:hover:not(:disabled) {
  filter: brightness(1.04) saturate(1.06);
  color: var(--lose);
}

.key.apply:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.key.quit {
  flex: none;
  min-width: 92px;
}

.file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
