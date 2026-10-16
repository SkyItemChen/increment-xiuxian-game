<script setup lang="ts">
import { reactive } from 'vue'
import { CHANGELOG, GAME_VERSION } from '../game/更新日志'

/**
 * 更新日志是一整页，和设置页、成就页同一个做法：页头挂着当前版本号，
 * 底下按版本从新到旧排。每一版收成一条，点报头才摊开条目——
 * 版本一多也就是多几行报头，不会几十条挤成一堵墙。最新那一版默认摊开。
 */
const emit = defineEmits<{ back: [] }>()

const entries = CHANGELOG

/** 哪几版现在摊开着。只有第一版（最新）默认开，其余收着 */
const open = reactive<Record<string, boolean>>(
  Object.fromEntries(entries.map((entry, i) => [entry.version, i === 0])),
)
</script>

<template>
  <div class="changelog-page">
    <header class="topbar">
      <div class="title">
        <span class="brand">更 新 日 志</span>
        <span class="version">v{{ GAME_VERSION }}</span>
      </div>
      <button class="back" type="button" @click="emit('back')">
        <span class="back-arrow">←</span>
        <span>返 回 修 行</span>
      </button>
    </header>

    <main class="stage">
      <section
        v-for="entry in entries"
        :key="entry.version"
        class="entry"
        :class="{ open: open[entry.version] }"
      >
        <button
          class="entry-head"
          type="button"
          :aria-expanded="open[entry.version]"
          @click="open[entry.version] = !open[entry.version]"
        >
          <span class="head-inner">
            <span class="tag">v{{ entry.version }}</span>
            <span class="date">{{ entry.date }}</span>
            <span class="count">{{ entry.items.length }} 项改动</span>
            <span class="chevron" aria-hidden="true">▾</span>
          </span>
        </button>

        <ul v-if="open[entry.version]" class="items">
          <li v-for="(item, i) in entry.items" :key="i">{{ item }}</li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.changelog-page {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: clip;
  background:
    radial-gradient(ellipse at 50% -20%, rgba(150, 205, 245, 0.4) 0%, transparent 55%),
    linear-gradient(180deg, var(--bg-top) 0%, var(--bg-mid) 60%, var(--bg-low) 100%);
  color: var(--ink);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 28px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-flat);
}

.title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.brand {
  font-size: 18px;
  letter-spacing: 8px;
  color: var(--accent);
  font-family: var(--font-kai);
}

/* 页头这颗挂当前版本，跟底下的版本标签同一种做法 */
.version {
  padding: 3px 10px;
  border: 1px solid var(--accent-line);
  border-radius: 8px;
  background: var(--accent-wash);
  color: var(--accent-deep);
  font-size: 12px;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}

.back {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 100%);
  color: var(--ink-invert);
  font-size: 13px;
  letter-spacing: 2px;
  box-shadow: 0 4px 0 var(--edge-accent), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  transition: filter 0.18s ease, transform 0.08s ease, box-shadow 0.08s ease;
}

.back:hover {
  filter: brightness(1.06) saturate(1.08);
}

.back:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--edge-accent), inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.back-arrow {
  font-size: 15px;
  line-height: 1;
}

/* 一版一条，从上往下排 */
.stage {
  flex: 1;
  min-height: 0;
  padding: 22px 28px 28px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.entry {
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
}

.entry.open {
  border-color: var(--accent-line);
}

/* 报头就是开关：整条都能点，包一层内芯好让按压位移不被圆角裁掉 */
.entry-head {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: var(--surface-raised);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.head-inner {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 14px 18px;
  transition: background 0.18s ease, transform 0.08s ease;
}

.entry-head:hover .head-inner {
  background: var(--tint-hover);
}

.entry-head:active .head-inner {
  transform: translateY(2px);
}

.entry.open .head-inner {
  border-bottom: 1px solid var(--line-soft);
}

.tag {
  flex: none;
  padding: 3px 10px;
  border: 1px solid var(--accent-line);
  border-radius: 8px;
  background: var(--accent-wash);
  color: var(--accent-deep);
  font-size: 13px;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}

.date {
  flex: none;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

/* 收起时也留一句"这版动了几项"，让报头自己说得清 */
.count {
  margin-left: auto;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.chevron {
  flex: none;
  color: var(--accent-deep);
  font-size: 12px;
  line-height: 1;
  transition: transform 0.2s ease;
}

.entry.open .chevron {
  transform: rotate(180deg);
}

/* 摊开的条目按屏宽铺成多列，条目多也不至于拉成一行长文 */
.items {
  margin: 0;
  padding: 18px;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 10px 22px;
}

.items li {
  position: relative;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.7;
  letter-spacing: 0.5px;
  color: var(--ink-dim);
}

/* 每一条前面点一颗小星，跟正文拉开层次 */
.items li::before {
  content: '✦';
  position: absolute;
  left: 0;
  top: 0;
  color: var(--accent);
  font-size: 11px;
}

@media (max-height: 700px) {
  .stage {
    padding: 14px 20px 18px;
    gap: 10px;
  }

  .head-inner {
    padding: 11px 14px;
  }

  .items {
    padding: 14px;
  }
}
</style>
