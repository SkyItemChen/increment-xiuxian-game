<script setup lang="ts">
import { computed } from 'vue'
import { achievementRows } from '../game/state'

/**
 * 成就是一整页，和设置页、自动化页同一个做法。
 * 这页只当"解锁了什么"的账本：判定和好处都长在 state.ts 那头的门槛函数上，达成一条就永久留着。
 * 顺序按境界从练气往下排，每条方块右上角写着它属于哪一境。
 */
const emit = defineEmits<{ back: [] }>()

const rows = computed(() => achievementRows())
const done = computed(() => rows.value.filter((row) => row.unlocked).length)
</script>

<template>
  <div class="achievement-page">
    <header class="topbar">
      <div class="title">
        <span class="brand">成 就</span>
        <span v-if="rows.length" class="tally">{{ done }} / {{ rows.length }}</span>
      </div>
      <button class="back" type="button" @click="emit('back')">
        <span class="back-arrow">←</span>
        <span>返 回 修 行</span>
      </button>
    </header>

    <main class="stage">
      <div v-if="rows.length" class="grid">
        <div v-for="row in rows" :key="row.def.id" class="tile" :class="{ done: row.unlocked }">
          <div class="head">
            <p class="name">{{ row.def.name }}</p>
            <span class="tier">{{ row.def.realm }}</span>
          </div>
          <p class="gain">{{ row.def.desc }}</p>
          <p v-if="!row.unlocked" class="progress">{{ row.progress }}</p>
          <span class="medal">{{ row.unlocked ? '已 达 成' : '未 达 成' }}</span>
        </div>
      </div>
      <p v-else class="empty">尚无成就</p>
    </main>
  </div>
</template>

<style scoped>
.achievement-page {
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

/* 页头就报这一句总账：达成几条、一共几条 */
.tally {
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

.stage {
  flex: 1;
  min-height: 0;
  padding: 22px 28px 28px;
  overflow: auto;
}

/* 一条成就一格方块，和自动化页同一种铺法。
   宽度走 minmax 让整行拉匀，高度交给 grid-auto-rows：一格里最挤的那条把整行顶到同一高度，
   名字长短、有没有那行进度，都不再把方块撑得高一块矮一块 */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  grid-auto-rows: 1fr;
  gap: 16px;
}

.tile {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 150px;
  padding: 18px 18px 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
}

.tile.done {
  border-color: var(--accent-line);
}

/* 名字和境界标签挤同一行：名字占左边，标签贴着右边缘 */
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.name {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 17px;
  letter-spacing: 3px;
  color: var(--ink);
  font-family: var(--font-kai);
}

/* 这一条算在哪一境头上——不是能按的东西，所以只描个边、不给按压位移 */
.tier {
  flex: none;
  padding: 3px 9px;
  border: 1px solid var(--accent-line);
  border-radius: 8px;
  background: var(--accent-wash);
  color: var(--accent-deep);
  font-size: 11px;
  letter-spacing: 2px;
}

.gain {
  margin: 6px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--accent-deep);
  line-height: 1.6;
}

.progress {
  margin: 4px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

/* 达成那枚贴右下角，没达成的只留个灰框 */
.medal {
  margin-top: auto;
  align-self: flex-end;
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-flat);
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 2px;
}

.tile.done .medal {
  border-color: var(--accent-line);
  background: var(--accent-wash);
  color: var(--accent-deep);
}

.empty {
  margin: 0;
  padding: 40px 24px;
  border: 1px dashed var(--line-strong);
  border-radius: 16px;
  background: var(--surface-flat);
  color: var(--ink-faint);
  font-size: 13px;
  letter-spacing: 3px;
}

@media (max-height: 700px) {
  .stage {
    padding: 14px 20px 18px;
  }

  .tile {
    min-height: 126px;
    padding: 14px 16px;
  }

  .empty {
    padding: 26px 20px;
  }
}
</style>
