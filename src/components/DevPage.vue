<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  GLOBAL_SPEEDS,
  devAddDan,
  devAddDaoJi,
  devAddDreg,
  devAddInsight,
  devAddPoints,
  devAddShenNian,
  devAddSpirit,
  devAddWarSoul,
  devFillSpirit,
  devFillYuan,
  devUnlockYuan,
  fmt,
  fmtNum,
  pointPassActive,
  pointPassPerSecond,
  state,
  yuanRealmOpen,
  yuanState,
} from '../game/state'
import { FURNACE_ID } from '../game/金丹丹炉'

/**
 * 测试页是从设置页里拆出来的：那几样是开发用的开关，不该和玩家的偏好挤在一起。
 * 入口在修行页顶栏，排在设置左边。主循环挂在 App 上，停在这一页时修行照走。
 */
const emit = defineEmits<{ back: [] }>()

const warping = computed(() => state.settings.globalSpeed !== 1)
const spiritText = computed(() => fmt(state.spirit))
const danText = computed(() => fmt(state.dan))
/** 结丹线看的就是这一条乘法线，测试页直接把它摆出来，省得回金丹页翻 */
const furnaceText = computed(() => state.pillLevels[FURNACE_ID] ?? 0)
/** 金丹之后练气不再破境，这一条是按秒折给的进项（零头单独记在 loopBanked） */
const passText = computed(() => pointPassPerSecond().toFixed(3))
/** 破境线撤了之后，"灌到破境线"那颗只能翻倍数 */
const noBreak = computed(() => pointPassActive())

/** 元婴那一层：测试页只摆"推门槛"这几颗，数值细节回元婴页看 */
const yuan = computed(() => yuanState())
const yuanOpen = computed(() => yuanRealmOpen())

const UNITS = [
  { label: '×1', mult: 1 },
  { label: '×1千', mult: 1e3 },
  { label: '×1兆', mult: 1e6 },
  { label: '×1E9', mult: 1e9 },
]

/** 三样资源共用一个数量：填数字、选倍率，按「发」才落账 */
const amount = ref(100)
const unit = ref(UNITS[0])
const pick = reactive({ spirit: true, points: true, insight: true, dan: false, dreg: false })

const total = computed(() => Math.max(0, Math.floor((Number(amount.value) || 0) * unit.value.mult)))

function give(): void {
  const n = total.value
  if (n <= 0) return
  if (pick.spirit) devAddSpirit(n)
  if (pick.points) devAddPoints(n)
  if (pick.insight) devAddInsight(n)
  if (pick.dan) devAddDan(n)
  if (pick.dreg) devAddDreg(n)
}

const marks = [10, 100, 1000, 10000, 100000, 1000000]
</script>

<template>
  <div class="dev-page">
    <header class="topbar">
      <span class="brand">测 试</span>
      <button class="back" type="button" @click="emit('back')">
        <span class="back-arrow">←</span>
        <span>返 回 修 行</span>
      </button>
    </header>

    <main class="stage">
      <div class="grid">
        <section class="column">
          <h2 class="heading">发资源</h2>
          <p class="gloss">填多少给多少，再选个倍率。勾哪几样就只发哪几样。</p>

          <div class="row col">
            <div class="give">
              <input v-model.number="amount" class="field" type="number" min="0" step="1" aria-label="发放数量" />
              <div class="seg four">
                <button
                  v-for="u in UNITS"
                  :key="u.label"
                  type="button"
                  class="seg-item"
                  :class="{ on: unit.label === u.label }"
                  @click="unit = u"
                >{{ u.label }}</button>
              </div>
            </div>
            <p class="desc">一次给 <b>{{ total.toLocaleString('en-US') }}</b> 份</p>
            <div class="quick">
              <button
                v-for="m in marks"
                :key="m"
                type="button"
                class="chip"
                :class="{ on: total === m }"
                @click="amount = m; unit = UNITS[0]"
              >{{ m.toLocaleString('en-US') }}</button>
            </div>
          </div>

          <div class="row">
            <div class="checks">
              <label class="check">
                <input v-model="pick.spirit" type="checkbox" />
                <span>灵气</span>
              </label>
              <label class="check">
                <input v-model="pick.points" type="checkbox" />
                <span>筑基点</span>
              </label>
              <label class="check">
                <input v-model="pick.insight" type="checkbox" />
                <span>见识</span>
              </label>
              <label class="check">
                <input v-model="pick.dan" type="checkbox" />
                <span>丹</span>
              </label>
              <label class="check">
                <input v-model="pick.dreg" type="checkbox" />
                <span>废渣</span>
              </label>
            </div>
            <button class="action" type="button" :disabled="total <= 0" @click="give">发 给 我</button>
          </div>

          <p class="desc">勾上哪几样就发哪几样，一次都按上面那个数字给。筑基点与见识同时算进累计，成就和探索的门槛跟着动；给丹或废渣会把金丹那一页的标签顺手开到。</p>

          <div class="row">
            <div class="row-text">
              <p class="name">灌满灵气</p>
              <p class="desc">{{ noBreak ? '金丹之后没有破境线了，这一颗把灵气翻一千倍' : '不看上面的数字，直接把灵气灌到下一个破境线；已破无可破就翻一千倍' }}</p>
            </div>
            <button class="action" type="button" @click="devFillSpirit">{{ noBreak ? '翻 一 千 倍' : '灌到破境线' }}</button>
          </div>
        </section>

        <section class="column">
          <h2 class="heading">时间轴</h2>
          <p class="gloss">全局速度把整条时间轴加速，吐纳、产出、气数一起变快。只给验证数值用。</p>

          <div class="row col">
            <div class="row-text">
              <p class="name">全局速度</p>
              <p class="desc">
                当前 ×{{ state.settings.globalSpeed
                }}{{ warping ? ' · 正在加速，测完记得调回 ×1' : ' · 常速' }}
              </p>
            </div>
            <div class="seg">
              <button
                v-for="s in GLOBAL_SPEEDS"
                :key="s"
                type="button"
                class="seg-item"
                :class="{ on: state.settings.globalSpeed === s }"
                @click="state.settings.globalSpeed = s"
              >×{{ s }}</button>
            </div>
          </div>
        </section>

        <section class="column">
          <h2 class="heading">元婴</h2>
          <p class="gloss">结婴要累计灵气 1e80 加结丹一层。这几颗把"该挂的时长"直接跳过，验完别存。</p>

          <div class="row">
            <div class="row-text">
              <p class="name">结婴</p>
              <p class="desc">
                当前 {{ yuanOpen ? '已结婴' : '未结婴' }} ·
                累计灵气 log10 {{ state.totalEarned.log10().toFixed(1) }}
              </p>
            </div>
            <button class="action" type="button" :disabled="yuanOpen" @click="devUnlockYuan()">
              推 到 1e80 并 结 婴
            </button>
          </div>

          <div class="row">
            <div class="row-text">
              <p class="name">元神</p>
              <p class="desc">
                {{ yuanOpen ? `每秒 ${fmt(yuan.rate)} · 阈值 ${fmt(yuan.threshold)}` : '结婴之后才有' }}
              </p>
            </div>
            <button class="action" type="button" :disabled="!yuanOpen" @click="devFillYuan()">
              灌 到 阈 值
            </button>
          </div>

          <div class="row">
            <div class="row-text">
              <p class="name">道基 / 神念 / 战魂</p>
              <p class="desc">
                道基 {{ fmtNum(state.daoJi) }} · 神念 {{ fmtNum(state.shenNian) }} ·
                战魂 {{ fmtNum(state.warSoul) }}
              </p>
            </div>
            <div class="quick">
              <button class="chip" type="button" @click="devAddDaoJi(100)">+100 道基</button>
              <button class="chip" type="button" @click="devAddShenNian(1000)">+1千 神念</button>
              <button class="chip" type="button" @click="devAddWarSoul(1000)">+1千 战魂</button>
            </div>
          </div>
        </section>

        <section class="column">
          <h2 class="heading">现状</h2>
          <p class="gloss">发完在这儿对一眼，不用回修行页翻数字。</p>

          <div class="row">
            <div class="row-text"><p class="name">手上灵气</p></div>
            <p class="num">{{ spiritText }}</p>
          </div>
          <div class="row">
            <div class="row-text"><p class="name">手上筑基点</p></div>
            <p class="num">{{ state.points.toLocaleString('en-US') }}</p>
          </div>
          <div class="row">
            <div class="row-text"><p class="name">累计筑基点</p></div>
            <p class="num">{{ state.pointsEarned.toLocaleString('en-US') }}</p>
          </div>
          <div class="row">
            <div class="row-text">
              <p class="name">每秒折给</p>
              <p class="desc">路上的零头 {{ state.loopBanked.toFixed(4) }}</p>
            </div>
            <p class="num">{{ passText }} 点/秒</p>
          </div>
          <div class="row">
            <div class="row-text"><p class="name">手上见识</p></div>
            <p class="num">{{ state.insight.toLocaleString('en-US') }}</p>
          </div>
          <div class="row">
            <div class="row-text"><p class="name">手上丹</p></div>
            <p class="num">{{ danText }}</p>
          </div>
          <div class="row">
            <div class="row-text">
              <p class="name">已结金丹</p>
              <p class="desc">定价锚（灵气/秒）{{ state.pillAnchor.toFixed(2) }} · 丹炉 Lv.{{ furnaceText }}</p>
            </div>
            <p class="num">{{ state.jindan.toLocaleString('en-US') }} 层</p>
          </div>
          <div class="row">
            <div class="row-text"><p class="name">已破境次数</p></div>
            <p class="num">{{ state.loops.toLocaleString('en-US') }}</p>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.dev-page {
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

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 20px;
  align-items: start;
}

/* 测试页整页用虚线框，和正经设置一眼分开 */
.column {
  padding: 22px 24px 24px;
  border: 1px dashed var(--line-strong);
  border-radius: 18px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
}

.heading {
  margin: 0;
  font-size: 16px;
  letter-spacing: 6px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
}

.gloss {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-faint);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--line-soft);
}

.row.col {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.row-text {
  min-width: 0;
}

.name {
  margin: 0;
  font-size: 15px;
  letter-spacing: 1px;
  color: var(--ink);
}

.desc {
  margin: 5px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--ink-faint);
  line-height: 1.6;
}

.desc b {
  color: var(--accent-deep);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.num {
  margin: 0;
  font-size: 15px;
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
}

.give {
  display: flex;
  align-items: center;
  gap: 10px;
}

.field {
  flex: none;
  width: 120px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-flat);
  color: var(--ink);
  font-size: 14px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}

.field:focus-visible {
  outline: 2px solid var(--accent-line);
  outline-offset: 2px;
}

.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  cursor: pointer;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-flat);
  color: var(--ink-dim);
  font-size: 12px;
  font-family: inherit;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.chip:hover {
  border-color: var(--accent-line);
}

.chip.on {
  border-color: var(--accent-line);
  background: var(--accent-wash);
  color: var(--accent-deep);
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.check {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-flat);
  color: var(--ink-dim);
  font-size: 13px;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.check:has(input:checked) {
  border-color: var(--accent-line);
  background: var(--accent-wash);
  color: var(--accent-deep);
}

.check input {
  accent-color: var(--accent);
  margin: 0;
}

.action {
  flex: none;
  cursor: pointer;
  padding: 9px 18px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: var(--accent-wash);
  color: var(--accent-deep);
  font-size: 13px;
  letter-spacing: 2px;
  font-family: inherit;
  transition: background 0.2s ease;
}

.action:hover {
  background: var(--tint-hover);
}

.action:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

/* 说明单独摆在行下面时也要留口气 */
.column > .desc {
  margin: 12px 0 0;
}

.seg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.seg.four {
  flex: 1;
  grid-template-columns: repeat(4, 1fr);
}

.seg-item {
  cursor: pointer;
  padding: 9px 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-flat);
  color: var(--ink-dim);
  font-size: 13px;
  font-family: inherit;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.seg-item:hover {
  border-color: var(--accent-line);
}

.seg-item.on {
  border-color: var(--accent-line);
  background: var(--accent);
  color: var(--ink-invert);
}

@media (max-height: 700px) {
  .stage {
    padding: 14px 20px 18px;
  }

  .column {
    padding: 16px 18px 18px;
  }
}
</style>
