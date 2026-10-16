<script setup lang="ts">
import { computed } from 'vue'
import { autoBuyGate, autoBuyPillGate, autoBuyTreeGate, autoPullGate, state } from '../game/state'

/**
 * 自动化是一整页，和设置页同一个做法。
 * 主循环挂在 App 上，停在这一页时修行照走，开关一开就有人替你把灵气花掉。
 * 代跑的活由成就发放，成就没达成这一页就空着，不摆一个拨不动的开关。
 * 方块按境界排：练气的法门在最前，筑基的根骨与鉴宝台跟上，金丹的丹炉与凝练压轴——和成就页同一个顺序。
 */
const emit = defineEmits<{ back: [] }>()

const gate = computed(() => autoBuyGate())
const buyingText = computed(() =>
  state.settings.autoBuyCultivate ? '系统正在替你参悟法门' : '还没有开启，灵气得自己点着花',
)
/** 丹炉那条要结过一层丹才交给系统：头一整世（含那 12 小时的结丹线）都得自己点 */
const pillGate = computed(() => autoBuyPillGate())
const pillText = computed(() =>
  state.settings.autoBuyPill ? '系统正在替你添炉子、炼火候、起丹房' : '还没有开启，丹得自己点着花',
)
/** 转盘要玩家自己转过一大圈才代抽：七道精神先得认全 */
const pullGate = computed(() => autoPullGate())
const pullText = computed(() =>
  state.settings.autoBuyPull ? '系统正在替你转凝练的盘子' : '还没有开启，废渣得自己攒着转',
)
/** 结丹满三层才把根骨和鉴宝台交给系统，门槛写在成就「丹成三转」里 */
const treeGate = computed(() => autoBuyTreeGate())
</script>

<template>
  <div class="automation-page">
    <header class="topbar">
      <span class="brand">自 动 化</span>
      <button class="back" type="button" @click="emit('back')">
        <span class="back-arrow">←</span>
        <span>返 回 修 行</span>
      </button>
    </header>

    <main class="stage">
      <div v-if="gate.unlocked" class="grid">
        <div class="tile">
          <p class="name">练气法门自动购买</p>
          <p class="desc">{{ buyingText }}</p>
          <label class="switch">
            <input v-model="state.settings.autoBuyCultivate" type="checkbox" />
            <span class="track"></span>
          </label>
        </div>

        <div v-if="treeGate.unlocked" class="tile">
          <p class="name">筑基根骨自动购买</p>
          <p class="desc">
            {{ state.settings.autoBuyRebirth ? '系统正在替你往根骨上花筑基点' : '还没有开启，根骨得自己点着点' }}
          </p>
          <label class="switch">
            <input v-model="state.settings.autoBuyRebirth" type="checkbox" />
            <span class="track"></span>
          </label>
        </div>

        <div v-if="treeGate.unlocked" class="tile">
          <p class="name">鉴宝台自动购买</p>
          <p class="desc">
            {{ state.settings.autoBuyExplore ? '系统正在替你搭鉴宝台' : '还没有开启，鉴宝台得自己点着搭' }}
            · 押上筑基点探宝那一下仍是自己按
          </p>
          <label class="switch">
            <input v-model="state.settings.autoBuyExplore" type="checkbox" />
            <span class="track"></span>
          </label>
        </div>

        <div v-if="pillGate.unlocked" class="tile">
          <p class="name">丹炉自动购买</p>
          <p class="desc">{{ pillText }} · 结丹这一步系统不代劳</p>
          <label class="switch">
            <input v-model="state.settings.autoBuyPill" type="checkbox" />
            <span class="track"></span>
          </label>
        </div>

        <div v-if="pullGate.unlocked" class="tile">
          <p class="name">凝练自动抽取</p>
          <p class="desc">{{ pullText }} · 只花废渣，抽到哪道全看盘子上那一格</p>
          <label class="switch">
            <input v-model="state.settings.autoBuyPull" type="checkbox" />
            <span class="track"></span>
          </label>
        </div>
      </div>
      <p v-else class="empty">当前未解锁自动化</p>
    </main>
  </div>
</template>

<style scoped>
.automation-page {
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

.brand {
  font-size: 18px;
  letter-spacing: 8px;
  color: var(--accent);
  font-family: var(--font-kai);
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

/* 一项一格方块：整行拉匀、上下也拉匀，不跟着屏宽碎成宽窄不一 */
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

.name {
  margin: 0;
  font-size: 15px;
  letter-spacing: 1px;
  color: var(--ink);
}

.desc {
  margin: 6px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--ink-faint);
  line-height: 1.6;
}

.switch {
  position: relative;
  flex: none;
  align-self: flex-end;
  margin-top: auto;
  width: 52px;
  height: 28px;
}

.switch input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--line-strong);
  transition: background 0.22s ease;
  pointer-events: none;
}

.track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(22, 57, 94, 0.3);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.switch input:checked + .track {
  background: var(--accent);
}

.switch input:checked + .track::after {
  transform: translateX(24px);
}

.switch input:focus-visible + .track {
  outline: 2px solid var(--accent-line);
  outline-offset: 2px;
}

/* 成就没达成时这一页只有这一句，虚线框摆明"这里以后有东西" */
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
