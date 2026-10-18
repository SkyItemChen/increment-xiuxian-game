<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  breakIntoYuan,
  buyYuanBuilding,
  fmt,
  fmtNum,
  setYuanAuto,
  setYuanMode,
  trialDaoJiPending,
  yuanBreak,
  yuanState,
  yuanUnlockGate,
} from '../game/state'
import { YUAN_AUTO_TRIGGERS, YUAN_MODES, type YuanModeId } from '../game/元婴'
import { BigNumber } from '../game/BigNumber'

/**
 * 炼神：元婴页的主区。
 *
 * 三段从上往下：**结婴**（累计灵气到 1e80）→ **炼神**（三档分流，攒元神）→ **大突破**
 * （元神攒到阈值，一次散掉本世换道基）。元道总倍率与洞明都在神悟台点，这里只念结果。
 *
 * 页面只负责念数：算式全在 `元婴.ts`，读写在 `state.ts` 的 `yuanState()` / `yuanBreak()`。
 */
const s = computed(() => yuanState())
const gate = computed(() => yuanUnlockGate())
/** 结婴之前过的试炼只发了筑基点，道基欠着，在这一刻补齐 */
const owedDaoJi = computed(() => trialDaoJiPending())

/** 结婴进度按 log 比例：1e80 这种门槛，线性条永远贴着 0 */
const gateProgress = computed(() => {
  const g = gate.value
  if (g.reached) return 100
  return Math.round(Math.min(Math.max(g.earnedLog10 / g.needLog10, 0), 1) * 100)
})

const progressWidth = computed(() => `${Math.round(s.value.progress * 100)}%`)

/**
 * 大突破第一次按要摆字据：它散的是整整一世的灵气、丹、法门与战将。
 * 破过一次之后玩家已经知道这一笔怎么算，之后点一下就破。
 */
const asking = ref(false)

function onBreak(): void {
  if (s.value.breaks < 1) {
    asking.value = true
    return
  }
  doBreak()
}

function doBreak(): void {
  asking.value = false
  yuanBreak()
}

function pick(id: YuanModeId): void {
  setYuanMode(id)
}

function secText(sec: number): string {
  if (!Number.isFinite(sec)) return '这一世还等不到'
  if (sec <= 0) return '现成'
  if (sec < 90) return `${Math.ceil(sec)} 秒`
  if (sec < 3600) return `${(sec / 60).toFixed(1)} 分`
  if (sec < 86400) return `${(sec / 3600).toFixed(1)} 小时`
  return `${(sec / 86400).toFixed(1)} 天`
}

/** 留存的三个比例念成百分比，别让玩家去心算 0.55 */
function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

const autoOptions = [0, ...YUAN_AUTO_TRIGGERS]

function autoLabel(n: number): string {
  return n === 0 ? '关' : `${n}×`
}

function autoText(n: number): string {
  return n === 0 ? '关着，过线也不破' : `等到 ${n} 倍阈值再破（道基更多，但要多等）`
}
</script>

<template>
  <div class="shen">
    <!-- 没结婴：把两道门念清楚，不摆一排点不动的按钮 -->
    <section v-if="!s.open" class="board">
      <div class="head">
        <p class="title">元 婴 未 成</p>
        <span class="badge">未 开</span>
      </div>
      <p class="note">
        结婴要两件事：<b>累计灵气到过 {{ fmt(gate.need) }}</b>，并且<b>结出过一层金丹</b>。
        它不扣灵气、也不散功——这是"修到这个份上，元婴自然该成了"，不是一笔买卖。
      </p>
      <p v-if="owedDaoJi > 0" class="note">
        你在结婴之前过的那几道试炼只发了筑基点，欠下 <b>{{ owedDaoJi }} 道基</b>——
        结婴的这一下会一并补上。
      </p>
      <dl class="facts">
        <div class="fact">
          <dt>累计灵气</dt>
          <dd :class="{ ok: gate.reached }">
            {{ fmt(BigNumber.fromLog10(gate.earnedLog10)) }} / {{ fmt(gate.need) }}
          </dd>
        </div>
        <div class="fact">
          <dt>金丹</dt>
          <dd :class="{ ok: gate.jindanOk }">{{ gate.jindan }} / {{ gate.jindanNeed }} 层</dd>
        </div>
      </dl>
      <div class="bar" role="progressbar" :aria-valuenow="gateProgress">
        <i :style="{ width: `${gateProgress}%` }"></i>
      </div>
      <button
        class="jiedan"
        type="button"
        :class="{ ready: gate.reached && gate.jindanOk }"
        :disabled="!gate.reached || !gate.jindanOk"
        @click="breakIntoYuan()"
      >
        <span class="break-label">结 婴</span>
        <span class="break-sub">
          {{ gate.reached && gate.jindanOk ? '元婴出窍，从此可以炼神' : '两道门都过了才按得动' }}
        </span>
      </button>
    </section>

    <template v-else>
      <section class="board wallet-board">
        <div class="wallets">
          <div class="wallet">
            <p class="wallet-label">元 神</p>
            <p class="wallet-value">{{ fmt(s.yuan) }}</p>
            <p class="wallet-rate">每秒 {{ fmt(s.rate) }}</p>
          </div>
          <div class="wallet aside">
            <p class="wallet-label">道 基</p>
            <p class="wallet-value small">{{ fmtNum(s.daoJi) }}</p>
            <p class="wallet-rate">已破 {{ s.breaks }} 次 · 道基只在神悟台花</p>
          </div>
          <div class="wallet aside">
            <p class="wallet-label">神 念</p>
            <p class="wallet-value small">{{ fmtNum(s.shenNian) }}</p>
            <p class="wallet-rate">元神宫每秒 {{ s.buildingIncome.toFixed(2) }}</p>
          </div>
        </div>

        <div class="modes" role="group" aria-label="炼神">
          <button
            v-for="m in YUAN_MODES"
            :key="m.id"
            type="button"
            class="mode"
            :class="{ on: s.mode.id === m.id }"
            @click="pick(m.id)"
          >{{ m.name }}</button>
        </div>
        <p class="mode-line">
          {{ s.mode.desc }} · 元神 ×{{ s.mode.yuanMul.toFixed(2) }} ·
          丹留存 {{ pct(s.mode.danKeep) }} · 渣留存 {{ pct(s.mode.dregKeep) }} ·
          返哺留存 {{ pct(s.mode.qiKeep) }}
        </p>
        <p v-if="s.drain > 0" class="mode-line warn">
          斗法正在分走 {{ pct(s.drain) }} 的元神，未分流时每秒 {{ fmt(s.rawRate) }}。
          要省这一份就去「斗法」切回守御。
        </p>
        <p v-else class="mode-line faint">
          三档只改"每秒产出怎么分"，不烧存量丹与渣；切换随时可以，代价只是往后每一秒的分配。
        </p>
      </section>

      <section class="board">
        <div class="head">
          <p class="title">大 突 破</p>
          <span class="badge">{{ s.auto > 0 ? `自动 ${autoLabel(s.auto)}` : '手动' }}</span>
        </div>
        <p class="note">
          元神攒到 <b>{{ fmt(s.threshold) }}</b> 就能破一次：散掉本世的灵气、丹、废渣、法门与战将，
          <template v-if="s.progress >= 1">换回 <b>{{ fmtNum(s.gain) }}</b> 道基。</template>
          <template v-else>换回一笔道基（过线之后这里会写出数目）。</template>
          阈值跟着你的产量锚走，所以首破总是约
          {{ secText(62 * 3600) }}，想快只能点神炼或换凝魄 / 夺舍。
        </p>
        <div class="bar" role="progressbar" :aria-valuenow="Math.round(s.progress * 100)">
          <i :style="{ width: progressWidth }"></i>
        </div>
        <p class="note faint">
          眼下 {{ fmt(s.yuan) }} / {{ fmt(s.threshold) }} · 到 1× 还要 {{ secText(s.etaSeconds) }}
        </p>

        <button
          class="jiedan"
          type="button"
          :class="{ ready: s.progress >= 1 && !s.trialOn }"
          :disabled="s.progress < 1 || s.trialOn"
          @click="onBreak"
        >
          <span class="break-label">大 突 破</span>
          <span class="break-sub">
            {{ s.trialOn ? '试炼中封着 · 它会连试炼进度一起清零'
              : s.progress >= 1 ? `可得 ${fmtNum(s.gain)} 道基` : '元神还没到阈值' }}
          </span>
        </button>

        <div v-if="asking" class="confirm">
          <p class="confirm-warn">
            这一按会散掉本世的灵气、丹、废渣、练气法门与战将；根骨、法宝、金丹层数、
            丹炉与道基一分不动。想清楚再按。
          </p>
          <div class="confirm-actions">
            <button class="ghost" type="button" @click="asking = false">再 想 想</button>
            <button class="primary" type="button" @click="doBreak">确 认 · 破 一 次</button>
          </div>
        </div>

        <div class="auto">
          <p class="auto-label">自动大突破</p>
          <div class="seg">
            <button
              v-for="n in autoOptions"
              :key="n"
              type="button"
              class="seg-item"
              :class="{ on: s.auto === n }"
              :disabled="!s.autoUnlocked"
              @click="setYuanAuto(n)"
            >{{ autoLabel(n) }}</button>
          </div>
          <p class="note faint">
            {{ s.autoUnlocked
              ? autoText(s.auto)
              : `累计破过 ${s.breaks} 次，到 12 次才发自动器（前期这一下必须自己按）` }}
          </p>
        </div>
      </section>

      <section class="board">
        <div class="head">
          <p class="title">元 神 宫</p>
          <span class="badge">Lv.{{ s.building }}</span>
        </div>
        <p class="note">
          每级多产 15% 神念，价格 ×1.7/级——下一级要等的时间按 1.48 倍往上走，是一堵对数墙。
          Lv.0 也产 0.05/秒，否则第一级永远买不起。神念只用来买斗法的战悟。
        </p>
        <button
          class="buy wide"
          type="button"
          :class="{ ready: s.shenNian >= s.buildingCost && Number.isFinite(s.buildingCost) }"
          :disabled="!(s.shenNian >= s.buildingCost && Number.isFinite(s.buildingCost))"
          @click="buyYuanBuilding()"
        >升 一 级 · {{ fmtNum(s.buildingCost) }} 神念</button>
        <p class="note faint">
          现在每秒 {{ s.buildingIncome.toFixed(3) }} 神念 · 手上 {{ fmtNum(s.shenNian) }}
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.shen {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.board {
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title {
  margin: 0;
  font-size: 16px;
  letter-spacing: 5px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
}

.badge {
  padding: 2px 9px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--ink-faint);
  font-size: 11px;
  letter-spacing: 1px;
  white-space: nowrap;
}

.note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.9;
  color: var(--ink-dim);
}

.note b {
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
}

.note.faint {
  color: var(--ink-faint);
}

.note.warn {
  color: var(--lose);
}

.facts {
  margin: 12px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 26px;
}

.fact {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.fact dt {
  font-size: 12px;
  color: var(--ink-faint);
}

.fact dd {
  margin: 0;
  font-size: 14px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.fact dd.ok {
  color: var(--achieved);
}

.bar {
  margin-top: 12px;
  height: 8px;
  border-radius: 5px;
  background: var(--tint);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, var(--accent-soft), var(--accent-deep));
  transition: width 0.3s ease;
}

/* 结婴 / 大突破共用一颗厚按钮，和破境、结丹是同一颗 */
.jiedan {
  width: 100%;
  margin-top: 16px;
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

.jiedan.ready {
  border-color: var(--accent-line);
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 55%, var(--accent-deep) 100%);
  color: var(--ink-invert);
  box-shadow:
    0 6px 0 var(--edge-accent),
    0 0 22px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.32);
}

.jiedan.ready:hover {
  filter: brightness(1.06) saturate(1.08);
}

.jiedan.ready:active {
  transform: translateY(5px);
  box-shadow:
    0 1px 0 var(--edge-accent),
    0 0 14px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.jiedan:disabled {
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

.jiedan.ready .break-sub {
  color: rgba(255, 255, 255, 0.82);
}

.wallets {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.wallet {
  flex: 1 1 150px;
  min-width: 0;
}

.wallet-label {
  margin: 0;
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--ink-faint);
}

.wallet-value {
  margin: 4px 0 0;
  font-size: 30px;
  line-height: 1.1;
  font-weight: 600;
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.wallet.aside .wallet-value {
  font-size: 22px;
  color: var(--sky-deep);
}

.wallet-value.small {
  font-size: 22px;
}

.wallet-rate {
  margin: 6px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.modes {
  margin-top: 16px;
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface-raised);
}

.mode {
  cursor: pointer;
  padding: 8px 22px;
  border: 0;
  border-right: 1px solid var(--line);
  background: transparent;
  color: var(--ink-faint);
  font-size: 14px;
  letter-spacing: 3px;
  text-indent: 3px;
  font-family: var(--font-kai);
  transition: background 0.18s ease, color 0.18s ease;
}

.mode:last-child {
  border-right: 0;
}

.mode:hover {
  color: var(--ink);
}

.mode.on {
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 100%);
  color: var(--ink-invert);
}

.mode-line {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

.mode-line.warn {
  color: var(--lose);
}

.mode-line.faint {
  color: var(--ink-faint);
}

.confirm {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--lose-line);
  border-radius: 12px;
  background: var(--lose-wash);
}

.confirm-warn {
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--lose);
}

.confirm-actions {
  margin-top: 10px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.ghost,
.primary {
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 13px;
  letter-spacing: 2px;
  font-family: inherit;
}

.ghost {
  border: 1px solid var(--line);
  background: var(--surface-raised);
  color: var(--ink-dim);
}

.primary {
  border: 1px solid var(--lose-line);
  background: var(--lose);
  color: var(--ink-invert);
}

.auto {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}

.auto-label {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--ink-faint);
}

.seg {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}

.seg-item {
  cursor: pointer;
  padding: 7px 16px;
  border: 0;
  border-right: 1px solid var(--line);
  background: var(--surface-raised);
  color: var(--ink-dim);
  font-size: 13px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}

.seg-item:last-child {
  border-right: 0;
}

.seg-item.on {
  background: var(--accent);
  color: var(--ink-invert);
}

.seg-item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.buy {
  cursor: pointer;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--ink-faint);
  font-size: 14px;
  letter-spacing: 1px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}

.buy.wide {
  margin-top: 12px;
  width: 100%;
}

.buy.ready {
  border-color: var(--accent-line);
  background: var(--accent-wash);
  color: var(--accent-deep);
}

.buy.ready:hover {
  background: var(--tint-hover);
}

.buy:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (min-width: 900px) {
  .shen {
    max-width: 900px;
  }
}
</style>
