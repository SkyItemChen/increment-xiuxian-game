<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { fmt, fmtNum, pull, pullQuote, spiritRows, state, type PullQuote, type SpiritQuote } from '../game/state'
import { SPIRITS, spiritCurrent } from '../game/词条与属性'
import { type SpiritRoll } from '../game/凝练'
import { nextRoll } from '../game/explore'

/**
 * 凝练 = 丹道精神的大转盘。废渣是门票，一转抽中哪道就把那道往上叠一级；
 * 抽到已经抽过的不空手——它升级。敏手与定息各有顶，抽满了照收废渣、等级不动。
 */
const dregText = computed(() => fmt(state.dreg))
const pullsText = computed(() => fmtNum(state.pulls))
const rows = computed<SpiritQuote[]>(() => spiritRows())
const quote = computed<PullQuote>(() => pullQuote())

const canPull = computed(() => quote.value.maxCount >= 1)
/** 抽不起时告诉玩家还差多少：只写"抽不起"等于让人对着一笔看不见的账发呆 */
const shortText = computed(() => {
  const left = quote.value.cost.sub(state.dreg)
  return left.gt(state.dreg) ? '这一转还早' : `还差 ${fmt(left)} 废渣`
})

/** 连转那颗：抽得起就报"一次转满几下"，抽不起就报还差多少 */
const manyText = computed(() => (canPull.value ? `一次转满 ${quote.value.maxCount} 下` : shortText.value))

/** 七道各占多大一格，按词条表的权重摊成角度。转盘和明细表读同一份权重 */
const slices = computed(() => {
  const total = SPIRITS.reduce((a, d) => a + d.weight, 0)
  let acc = 0
  return SPIRITS.map((def) => {
    const from = acc
    acc += (def.weight / total) * 360
    return { def, from, to: acc }
  })
})

/** 转盘底色：每一道一格，按序号上色，颜色只用来认格，不表品质 */
const HUES = [205, 168, 268, 30, 340, 220, 190]
const wheelFace = computed(() => {
  const stops = slices.value.map((s, i) => {
    const c = HUES[i % HUES.length]
    return `hsl(${c} 55% ${i % 2 ? 82 : 76}%) ${s.from.toFixed(2)}deg ${s.to.toFixed(2)}deg`
  })
  return `conic-gradient(${stops.join(', ')})`
})

/** 每一道的标签摆在哪一度、什么色 */
const labels = computed(() =>
  slices.value.map((s, i) => ({
    id: s.def.id,
    angle: (s.from + s.to) / 2,
    hue: HUES[i % HUES.length],
  })),
)

/**
 * 转盘指到的那道。指针固定在正上方，所以整盘转 (N × 360 + 落点补角) 度之后，
 * 指针指的就是落在 0° 那一格里的那道。落点先用种子算出来，动画只是把它演完。
 */
const angle = ref(0)
const spinning = ref(false)
const last = ref<SpiritRoll | null>(null)
let spinTimer = 0

function indexOfHit(hit: SpiritRoll): number {
  return SPIRITS.findIndex((d) => d.id === hit.def.id)
}

function wheelAngleFor(i: number, roll: number): number {
  const s = slices.value[i]
  if (!s) return angle.value
  // 落点只取这一格的中间六成：种子摇到边上时指针会停在两道的分界线上，
  // 明明中了却看着像没中，这一条最招骂
  const jitter = 0.2 + roll * 0.6
  const target = s.from + jitter * (s.to - s.from)
  // 整盘转过 target 之后，target 那一格落到正上方（0°）
  return -(target)
}

function spinTo(hits: SpiritRoll[]): void {
  const hit = hits[hits.length - 1]
  if (!hit) return
  const i = indexOfHit(hit)
  let roll: number
  ;[roll, state.seed] = nextRoll(state.seed)
  const base = wheelAngleFor(i, roll)
  // 每次都从当前角度再往上加满 5 圈，指针永远不会往回跳
  angle.value += 5 * 360 + ((base - angle.value) % 360 + 360) % 360
  last.value = hit
}

function onPull(count: 1 | 'max'): void {
  if (spinning.value) return
  const hits = pull(count)
  if (hits.length === 0) return
  spinning.value = true
  spinTo(hits)
  window.clearTimeout(spinTimer)
  spinTimer = window.setTimeout(() => (spinning.value = false), 2200)
}

onUnmounted(() => window.clearTimeout(spinTimer))

/** 刚抽中的那道摆出来给玩家认一眼：转得太快看不清落在哪，是转盘最常见的坑 */
const lastName = computed(() => last.value?.def.name ?? '')
const lastLevel = computed(() => (last.value ? `第 ${last.value.level} 级` : ''))

function currentText(row: SpiritQuote): string {
  return spiritCurrent(row.def, row.level, state.settings.numberFormat)
}

/** 满级的那两道要标出来，不然玩家会一直往一个不动的格里扔废渣 */
function isMaxed(row: SpiritQuote): boolean {
  return row.def.cap !== undefined && row.level >= row.def.cap
}

const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <div class="ninglian">
    <div class="wrap">
      <section class="column core">
        <div class="wallet">
          <p class="wallet-label">丹 药 废 渣</p>
          <p class="wallet-value">{{ dregText }}</p>
          <p class="wallet-rate">已经转过 {{ pullsText }} 次</p>
        </div>

        <div class="wheel-box">
          <span class="pointer" aria-hidden="true"></span>
          <div class="wheel" :style="{ background: wheelFace, transform: `rotate(${angle}deg)` }">
            <span
              v-for="l in labels"
              :key="l.id"
              class="spoke"
              :style="{ transform: `rotate(${l.angle}deg)` }"
            >
              <b :style="{ color: `hsl(${l.hue} 60% 30%)` }">{{ SPIRITS.find((d) => d.id === l.id)?.name }}</b>
            </span>
          </div>
          <p v-if="lastName" class="landed" :class="{ quiet: spinning }">
            落在 <b>{{ lastName }}</b> · {{ lastLevel }}
          </p>
          <p v-else class="landed quiet">还没转过 · 炸炉攒下的废渣就是这一转的门票</p>
        </div>

        <div class="pulls">
          <button
            class="pull"
            type="button"
            :class="{ ready: canPull && !spinning }"
            :disabled="!canPull || spinning"
            @click="onPull(1)"
          >
            <span class="pull-label">凝 一 转</span>
            <span class="pull-sub">{{ fmt(quote.cost) }} 废渣</span>
          </button>
          <button
            class="pull many"
            type="button"
            :class="{ ready: canPull && !spinning }"
            :disabled="!canPull || spinning"
            @click="onPull('max')"
          >
            <span class="pull-label">连 转</span>
            <span class="pull-sub">{{ manyText }}</span>
          </button>
        </div>

        <p class="note">
          废渣是炸炉赔出来的，丹炉那一页挑火候就是挑"要丹还是要渣"。
          同一道精神重复抽到就升一级，抽满的那两道不用再抽。
        </p>
        <button class="back" type="button" @click="emit('back')">回 丹 炉</button>
      </section>

      <section class="column side">
        <h2 class="heading">丹 道 精 神</h2>
        <ul class="list">
          <li v-for="row in rows" :key="row.def.id" class="item" :class="{ maxed: isMaxed(row) }">
            <div class="info">
              <p class="name">
                {{ row.def.name }}
                <span class="lv">Lv.{{ row.level }}</span>
                <span class="odds">{{ Math.round(row.chance * 100) }}%</span>
              </p>
              <p class="effect">{{ row.def.effect }} · 当前 {{ currentText(row) }}</p>
            </div>
          </li>
        </ul>
        <p class="note">
          百分比是这一道在转盘上占的那一格，七道加起来是一整圈。
          抽的越多，价涨得越高——每一转都比上一转贵一成半。
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ninglian {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.wrap {
  flex: 1;
  min-height: 0;
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
  padding: 26px 30px 24px;
  text-align: center;
}

.side {
  padding: 24px 24px 26px;
}

@media (min-width: 900px) {
  .wrap {
    grid-template-columns: minmax(360px, 0.9fr) 1.1fr;
    align-items: stretch;
  }

  .core {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}

.wallet-label {
  margin: 0;
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--ink-faint);
}

.wallet-value {
  margin: 4px 0 0;
  font-size: 32px;
  line-height: 1.1;
  font-weight: 600;
  color: var(--sky-deep);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 14px rgba(30, 124, 196, 0.14);
}

.wallet-rate {
  margin: 5px 0 0;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

/* 转盘：指针固定在正上方，整盘转。conic-gradient 摆色，标签各占一根辐条 */
.wheel-box {
  position: relative;
  margin: 20px auto 6px;
  width: min(320px, 74vw);
}

.pointer {
  position: absolute;
  top: -10px;
  left: 50%;
  z-index: 2;
  width: 0;
  height: 0;
  transform: translateX(-50%);
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 15px solid var(--accent-deep);
  filter: drop-shadow(0 2px 4px rgba(30, 124, 196, 0.35));
}

.wheel {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 3px solid var(--line);
  box-shadow: var(--shadow-panel), inset 0 0 0 6px rgba(255, 255, 255, 0.55);
  transition: transform 2s cubic-bezier(0.16, 0.84, 0.24, 1);
}

.spoke {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  /* 标签跟着盘转，所以转起来会侧过去——那是转盘的样子，不是 bug */
  padding-top: 9%;
}

.spoke b {
  font-size: 13px;
  letter-spacing: 1px;
  font-family: var(--font-kai);
}

.landed {
  margin: 10px 0 0;
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

.landed b {
  color: var(--accent-deep);
}

.landed.quiet {
  color: var(--ink-faint);
}

.pulls {
  margin-top: 14px;
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 长方形厚按钮，和破境、结丹那两颗是同一颗 */
.pull {
  cursor: pointer;
  flex: 1 1 150px;
  max-width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-flat);
  box-shadow: 0 6px 0 rgba(150, 180, 210, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  color: var(--ink-faint);
  font-family: inherit;
  transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.08s ease;
}

.pull.ready {
  border-color: var(--accent-line);
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 55%, var(--accent-deep) 100%);
  color: var(--ink-invert);
  box-shadow:
    0 6px 0 var(--edge-accent),
    0 0 22px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.32);
}

.pull.ready:hover {
  filter: brightness(1.06) saturate(1.08);
}

.pull.ready:active {
  transform: translateY(5px);
  box-shadow:
    0 1px 0 var(--edge-accent),
    0 0 14px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.pull:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.pull-label {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 5px;
  text-indent: 5px;
}

.pull-sub {
  font-size: 12px;
  letter-spacing: 1px;
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
}

.heading {
  margin: 0 0 18px;
  font-size: 17px;
  letter-spacing: 6px;
  text-indent: 6px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
  text-align: center;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item {
  padding: 11px 14px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: var(--surface-flat);
}

/* 抽满的两道：灰掉、给一句"到头了"，别让人继续往里扔废渣 */
.item.maxed {
  border-color: var(--accent-line);
  background: var(--accent-wash);
}

.info {
  min-width: 0;
  text-align: left;
}

.name {
  margin: 0;
  font-size: 16px;
  letter-spacing: 2px;
  color: var(--ink);
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.lv {
  font-size: 12px;
  letter-spacing: 0;
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
}

.odds {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.effect {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

.note {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-faint);
}

.back {
  margin-top: 16px;
  cursor: pointer;
  padding: 7px 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--ink-faint);
  font-size: 13px;
  letter-spacing: 3px;
  font-family: inherit;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.08s ease;
}

.back:hover {
  background: var(--tint-hover);
}

.back:active {
  transform: translateY(2px);
}
</style>
