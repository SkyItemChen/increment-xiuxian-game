<script setup lang="ts">
import { computed, ref } from 'vue'
import { REALMS, visibleRealms } from '../game/realms'
import {
  autoBuyActive,
  breakBonus,
  breakThrough,
  fmt,
  fmtNum,
  needBreakConfirm,
  offlineReport,
  pointPassActive,
  pointPassPerSecond,
  previewBreakThrough,
  realmTabDepth,
  realmToBreakThrough,
  shown,
  state,
  type BreakPreview,
} from '../game/state'
import { pointsForLoop, POINTS_PER_DECADE } from '../game/rebirth'
import { GAME_VERSION } from '../game/更新日志'
import { POINT_PASS_RATE } from '../game/词条与属性'
import BreakDialog from './BreakDialog.vue'
import OfflineDialog from './OfflineDialog.vue'
import PillPanel from './PillPanel.vue'
import RebirthPanel from './RebirthPanel.vue'
import UpgradeList from './UpgradeList.vue'

const emit = defineEmits<{ openSettings: [], openAutomation: [], openAchievements: [], openChangelog: [], openDev: [] }>()

/** 测试页那颗只在 `npm run dev` 里露出来，发出去的版本上不认这条路 */
const isDev = import.meta.env.DEV

const spiritText = computed(() => fmt(shown.spirit))
const gatherText = computed(() => fmt(state.spiritPerGather))
const rateText = computed(() => fmt(state.spiritPerSecond))
const gathersText = computed(() => fmtNum(state.totalGathers))
const periodText = computed(() => state.gatherSeconds.toFixed(1).replace(/\.0$/, ''))
/** 吐纳速度词条生效时才占位，起手期那行还是干净的"每 5 秒一次" */
const speedText = computed(() =>
  state.gatherSpeed > 1.005 ? ` · 吐纳速度 ×${state.gatherSpeed.toFixed(2).replace(/\.?0+$/, '')}` : '',
)
/** 进度条每帧都在走，绑 0..1 的小数就够了，别让模板去算百分比 */
const gatherWidth = computed(() => `${Math.round(state.gatherProgress * 100)}%`)

/** 金丹那一页在结丹之前就要摆出来，标签深度由丹炉的门槛决定，不看 realmIndex 一个数 */
const realms = computed(() => visibleRealms(realmTabDepth()))
const active = ref('lianqi')
const viewed = computed(() => realms.value.find((r) => r.id === active.value) ?? realms.value[0])

/** 破境是转生，代价太大，必须让玩家可以反悔 */
const preview = ref<BreakPreview | null>(null)

/** 破境按钮常驻修行页：灵气只从这一页来，一世一世都在这里循环 */
const gate = computed(() =>
  viewed.value.page === 'cultivate' ? realmToBreakThrough() : null,
)

const gateNeedText = computed(() => {
  const need = gate.value?.realm.breakThrough
  return need ? fmt(need) : ''
})

const gateGainText = computed(() => {
  const need = gate.value?.realm.breakThrough
  if (!need) return '0'
  return fmtNum(pointsForLoop(shown.loopEarned, need, state.loops) + breakBonus())
})

// 差好几个数量级，线性进度条永远贴着 0，改用 log 刻度
const gateProgress = computed(() => {
  const need = gate.value?.realm.breakThrough
  if (!need || gate.value?.reached) return 100
  const ratio = shown.spirit.log10() / need.log10()
  return Math.round(Math.min(Math.max(ratio, 0), 1) * 100)
})

/** 金丹一开张，破境那颗按钮就撤了：这一栏改成念每秒折给多少筑基点 */
const passive = computed(() => viewed.value.page === 'cultivate' && pointPassActive())
const passText = computed(() => pointPassPerSecond().toFixed(2))
/** 多攒一个数量级能多换几点，摆在字据里当"挂久一点还有好处"的凭据 */
const passStepText = computed(() => (POINTS_PER_DECADE * POINT_PASS_RATE).toFixed(2))

function onBreakThrough(): void {
  // 累计筑基点攒够了就不摆字据，但这一世仍然是玩家这一下按掉的
  if (!needBreakConfirm()) {
    onConfirmBreak()
    return
  }
  const p = previewBreakThrough()
  if (p) preview.value = p
}

function onConfirmBreak(): void {
  preview.value = null
  if (!breakThrough()) return
  active.value = REALMS[state.realmIndex].id
}

/** 出关字据看过就算翻篇，进项早就落账了，点掉它不动任何数值 */
function closeOffline(): void {
  offlineReport.value = null
}

const playTime = computed(() => {
  const s = Math.floor(shown.totalTime)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
})
</script>

<template>
  <div class="game-screen">
    <div class="aurora"></div>

    <header class="topbar">
      <div class="brand-block">
        <span class="brand">问道长生</span>
        <span class="version">v{{ GAME_VERSION }}</span>
        <button class="changelog-btn" type="button" aria-label="更新日志" @click="emit('openChangelog')">
          <span class="changelog-icon">☰</span>
          <span class="changelog-text">日志</span>
        </button>
      </div>
      <div class="topbar-right">
        <span class="time">修行时长 {{ playTime }}</span>
        <button v-if="isDev" class="gear dev" type="button" aria-label="测试" @click="emit('openDev')">
          <span class="gear-icon">⚗</span>
          <span class="gear-text">测试</span>
        </button>
        <button class="gear" type="button" aria-label="设置" @click="emit('openSettings')">
          <span class="gear-icon">⚙</span>
          <span class="gear-text">设置</span>
        </button>
        <button
          class="gear"
          :class="{ busy: autoBuyActive() }"
          type="button"
          aria-label="自动化"
          @click="emit('openAutomation')"
        >
          <span class="gear-icon">⚡</span>
          <span class="gear-text">自动化</span>
        </button>
        <button class="gear" type="button" aria-label="成就" @click="emit('openAchievements')">
          <span class="gear-icon">❖</span>
          <span class="gear-text">成就</span>
        </button>
      </div>
    </header>

    <!-- 灵气是全局资源，放在境界标签栏上方，切到哪个境界都看得到 -->
    <div class="spirit-bar">
      <p class="label">灵 气</p>
      <p class="spirit">{{ spiritText }}</p>
      <p class="rate">
        <span class="orb">✦</span>
        每秒 {{ rateText }}
      </p>
    </div>

    <nav class="realms" aria-label="境界">
      <button
        v-for="r in realms"
        :key="r.id"
        type="button"
        class="realm-tab"
        :class="{ on: viewed.id === r.id }"
        @click="active = r.id"
      >{{ r.name }}</button>
    </nav>

    <main class="stage">
      <section v-if="viewed.page === 'cultivate'" class="workbench">
        <div class="column core">
          <p class="per-gather">{{ viewed.name }}期修行 · 每次吐纳 +{{ gatherText }} 灵气</p>

          <div class="gather">
            <div class="gather-head">
              <span class="gather-label">吐 纳</span>
              <span class="gather-sub">每 {{ periodText }} 秒一次{{ speedText }} · 已吐纳 {{ gathersText }} 次</span>
            </div>
            <div class="gather-bar" role="progressbar" :aria-valuenow="Math.round(state.gatherProgress * 100)">
              <i :style="{ width: gatherWidth }"></i>
            </div>
          </div>

          <div v-if="gate" class="gate">
            <button
              class="breakthrough"
              type="button"
              :class="{ ready: gate.reached }"
              :disabled="!gate.reached"
              @click="onBreakThrough"
            >
              <span class="break-label">突 破 {{ gate.realm.name }}</span>
              <span class="break-sub">
                {{ gate.reached ? `灵气已盈，破境可得 ${gateGainText} 筑基点` : `需持有 ${gateNeedText} 灵气` }}
              </span>
            </button>
            <span v-if="!gate.reached" class="gate-bar">
              <i :style="{ width: `${gateProgress}%` }"></i>
            </span>
            <p v-else class="gate-note">
              这一世灵气还在往上涨。多攒上十倍，破境就多换 {{ POINTS_PER_DECADE }} 筑基点。
            </p>
          </div>

          <div v-else-if="passive" class="gate">
            <div class="pass">
              <span class="pass-label">金 丹 已 成 · 不 必 再 破 境</span>
              <span class="pass-sub">修行进项按秒折算，每秒进账 <b>{{ passText }}</b> 筑基点</span>
            </div>
            <p class="gate-note">灵气多攒上十倍，每秒才多给 {{ passStepText }} 点 —— 一直挂着就行，不用一世一世回来按按钮。</p>
          </div>
        </div>

        <div class="column side">
          <UpgradeList :defs="viewed.upgrades" />
        </div>
      </section>

      <section v-else-if="viewed.page === 'rebirth'" class="rebirth-page">
        <RebirthPanel />
      </section>

      <section v-else-if="viewed.page === 'pill'" class="pill-page">
        <PillPanel />
      </section>

      <section v-else class="locked-realm">
        <p class="locked-name">{{ viewed.name }}</p>
        <p class="locked-teaser">{{ viewed.teaser }}</p>
        <p class="locked-note">此境界的法门尚未参悟，且待后续造化。</p>
      </section>
    </main>

    <BreakDialog
      v-if="preview"
      :preview="preview"
      @cancel="preview = null"
      @confirm="onConfirmBreak"
    />

    <OfflineDialog v-if="offlineReport" :report="offlineReport" @close="closeOffline" />
  </div>
</template>

<style scoped>
.game-screen {
  position: relative;
  height: 100dvh;
  /* 用 clip 而不是 hidden：极光宽达 120vw 会溢出容器，hidden 仍留下可滚动的
     scrollWidth，点右侧按钮时浏览器会把整屏横向滚走 */
  overflow: clip;
  background:
    radial-gradient(ellipse at 50% -20%, rgba(150, 205, 245, 0.4) 0%, transparent 55%),
    linear-gradient(180deg, var(--bg-top) 0%, var(--bg-mid) 60%, var(--bg-low) 100%);
  color: var(--ink);
  display: flex;
  flex-direction: column;
}

.aurora {
  position: absolute;
  top: -30%;
  left: 50%;
  width: 120vw;
  height: 70vh;
  transform: translateX(-50%);
  background: radial-gradient(ellipse, rgba(255, 255, 255, 0.7) 0%, transparent 65%);
  filter: blur(10px);
  animation: sway 12s ease-in-out infinite alternate;
  pointer-events: none;
}

@keyframes sway {
  from { transform: translateX(-52%) rotate(-2deg); }
  to { transform: translateX(-48%) rotate(2deg); }
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 28px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-flat);
  z-index: 1;
}

.brand {
  font-size: 18px;
  letter-spacing: 8px;
  color: var(--accent);
  font-family: var(--font-kai);
}

/* 品牌后面缀一颗当前版本，跟更新日志页头那颗同一种做法 */
.brand-block {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.version {
  padding: 2px 8px;
  border: 1px solid var(--accent-line);
  border-radius: 7px;
  background: var(--accent-wash);
  color: var(--accent-deep);
  font-size: 11px;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}

/* 版本号右侧的日志按钮：和 version 同一种小标签风格，但可点 */
.changelog-btn {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid var(--accent-line);
  border-radius: 7px;
  background: var(--surface-flat);
  color: var(--ink);
  font-size: 11px;
  letter-spacing: 1px;
  transition: filter 0.15s ease, transform 0.06s ease;
}

.changelog-btn:hover {
  filter: brightness(1.08);
}

.changelog-btn:active {
  transform: translateY(2px);
}

.changelog-icon {
  font-size: 12px;
  line-height: 1;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 18px;
}

.time {
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

.gear {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  padding: 7px 15px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--ink-dim);
  font-size: 13px;
  letter-spacing: 2px;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.gear:hover {
  border-color: var(--accent-line);
  color: var(--accent);
  background: var(--accent-wash);
}

/* 自动化开着的时候让这颗按钮一直发亮，一眼看出有人在替自己买东西 */
.gear.busy {
  border-color: var(--accent-line);
  color: var(--accent-deep);
  background: var(--accent-wash);
}

.gear-icon {
  font-size: 15px;
  line-height: 1;
}

/* 测试那颗用虚线框，和给玩家用的三颗按钮摆在一起也不至于被误点 */
.gear.dev {
  border-style: dashed;
  color: var(--ink-faint);
}

/* 境界标签栏 */
.realms {
  display: flex;
  gap: 8px;
  padding: 12px 28px;
  border-bottom: 1px solid var(--line-soft);
  background: var(--surface-flat);
  overflow-x: auto;
  scrollbar-width: none;
  z-index: 1;
}

.realms::-webkit-scrollbar {
  display: none;
}

.realm-tab {
  flex: none;
  cursor: pointer;
  padding: 8px 22px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--ink-dim);
  font-size: 15px;
  letter-spacing: 4px;
  text-indent: 4px;
  font-family: var(--font-kai);
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.realm-tab:hover {
  color: var(--ink);
}

.realm-tab.on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--ink-invert);
}

/* 主舞台 */
.stage {
  flex: 1;
  min-height: 0;
  padding: 22px 28px 28px;
  overflow: auto;
  z-index: 1;
}

.workbench {
  height: 100%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 22px;
  align-content: start;
}

.column {
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
}

.core {
  padding: 30px 32px;
  text-align: center;
}

.side {
  padding: 26px 24px;
  min-height: 0;
}

/* 横屏：左核心右法门，吃满宽度。和筑基页一样不再套 max-width，宽屏就该铺满 */
@media (min-width: 900px) {
  .workbench {
    grid-template-columns: minmax(360px, 0.9fr) 1.1fr;
    grid-template-rows: minmax(0, 1fr);
    align-content: stretch;
    align-items: stretch;
  }

  .core {
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .side {
    overflow: hidden;
  }

  /* 只有横屏才让法门列表自己撑满并内部滚动，竖屏交给 .stage 滚，否则会多出 2px 的幽灵滚动条 */
  .side :deep(.upgrades) {
    height: 100%;
  }
}

@media (max-height: 700px) {
  .spirit-bar {
    padding: 10px 20px 8px;
  }

  .stage {
    padding: 14px 20px 18px;
  }

  .core {
    padding: 18px 24px;
  }

  .spirit {
    font-size: clamp(26px, 4.6vh, 40px);
  }

  .gather {
    margin-top: 14px;
    padding: 12px 16px 14px;
  }

  .gate {
    margin-top: 12px;
  }

  .breakthrough {
    padding: 10px 14px;
  }

  .break-label {
    font-size: 15px;
    letter-spacing: 4px;
  }
}

/* 灵气读数条：标签栏之上，一行摆完"名字 + 数值 + 速率" */
.spirit-bar {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 20px;
  padding: 14px 28px 12px;
  border-bottom: 1px solid var(--line-soft);
  background: var(--surface-flat);
  z-index: 1;
}

.label {
  margin: 0;
  font-size: 14px;
  letter-spacing: 8px;
  text-indent: 8px;
  color: var(--ink-dim);
}

.spirit {
  margin: 0;
  font-size: clamp(32px, 5vh, 54px);
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--sky-deep);
  text-shadow: 0 2px 14px rgba(13, 132, 198, 0.16);
  white-space: nowrap;
}

.per-gather {
  margin: 0;
  font-size: 14px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}


.rate {
  margin: 0;
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.orb {
  color: var(--sky);
  animation: spin 6s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 吐纳：进度条走满一次才结算灵气，没有点击 */
.gather {
  position: relative;
  width: 100%;
  margin-top: 22px;
  padding: 16px 18px 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-raised);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  user-select: none;
}

.gather-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.gather-label {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 8px;
  text-indent: 8px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
}

.gather-sub {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.gather-bar {
  height: 16px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--tint);
  box-shadow: inset 0 2px 4px rgba(22, 57, 94, 0.14);
  overflow: hidden;
}

.gather-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--sky-soft) 0%, var(--sky) 60%, var(--sky-deep) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

/* 破境：攒够灵气才点亮，长方形厚按钮 */
.gate {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.breakthrough {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-flat);
  box-shadow: 0 6px 0 rgba(150, 180, 210, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  color: var(--ink-faint);
  transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.08s ease;
}

.breakthrough.ready {
  border-color: var(--accent-line);
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 55%, var(--accent-deep) 100%);
  color: var(--ink-invert);
  box-shadow:
    0 6px 0 var(--edge-accent),
    0 0 22px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.32);
}

.breakthrough.ready:hover {
  filter: brightness(1.06) saturate(1.08);
}

.breakthrough.ready:active {
  transform: translateY(5px);
  box-shadow:
    0 1px 0 var(--edge-accent),
    0 0 14px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.breakthrough.ready .break-sub {
  color: rgba(255, 255, 255, 0.82);
}

.breakthrough:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.break-label {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 6px;
}

.break-sub {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.gate-bar {
  height: 4px;
  border-radius: 3px;
  background: var(--tint);
  overflow: hidden;
}

.gate-bar i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--accent-soft), var(--accent-deep));
  transition: width 0.3s ease;
}

.gate-note {
  margin: 0;
  font-size: 12px;
  letter-spacing: 1px;
  text-align: center;
  color: var(--ink-faint);
}

/* 金丹之后的按秒折给：形状跟着破境那颗按钮，但不给按压位移——它不是能按的东西 */
.pass {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 18px;
  border: 1px solid var(--accent-line);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--accent-wash) 0%, var(--surface-flat) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.pass-label {
  font-size: 15px;
  letter-spacing: 4px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
}

.pass-sub {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.pass-sub b {
  color: var(--accent-deep);
  font-size: 14px;
}

/* 筑基页整页交给根骨/探索面板，自己只负责撑满舞台；清单能长得比舞台高，所以留 min */
.rebirth-page {
  min-height: 100%;
}

/* 金丹页同理：整页交给丹炉面板 */
.pill-page {
  min-height: 100%;
}

.locked-realm {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}

.locked-name {
  font-size: 40px;
  letter-spacing: 12px;
  text-indent: 12px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
}

.locked-teaser {
  font-size: 15px;
  color: var(--ink-dim);
}

.locked-note {
  font-size: 13px;
  color: var(--ink-faint);
}
</style>
