<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  abortTrial,
  enterTrial,
  fmt,
  settleTrial,
  trialGate,
  trialRows,
  trialStatus,
  trialsCleared,
  trialDaoJiPending,
} from '../game/state'
import { BigNumber } from '../game/BigNumber'
import { TRIALS, addBonus, noBonus } from '../game/词条与属性'

/**
 * 试炼区：元婴标签下的第一区（0.21 从顶栏独立页归位到这里）。
 *
 * 页面只做三件事：把代价念清楚、把进度画出来、把退出放得足够好找。
 * 判定与倍率长在 [试炼.ts](../game/试炼.ts) 和 `state.ts` 的门槛函数上，这里不重复算。
 *
 * 门槛念的是**结丹层数**（1/3/6/10 层），不是境界名：试炼要在**结婴之前**就能打
 * （它是攒道基之外的另一个增量来源），而 `realmIndex` 要结婴才推到元婴那一格，
 * 用境界当门槛等于把四道牌关到 1e80 之后。
 */
const emit = defineEmits<{ entered: [] }>()

const rows = computed(() => trialRows())
const status = computed(() => trialStatus())
const gate = computed(() => trialGate())
const cleared = computed(() => trialsCleared())
const total = TRIALS.length
/**
 * 四道加成叠在一起的总账，页脚念它。
 * 数字从表里现推（`addBonus` 加法相加、乘法相乘），改表不会与文案脱钩。
 */
const totalBuff = computed(() => {
  const b = TRIALS.reduce((a, d) => addBonus(a, d.bonus), noBonus())
  const pct = (v: number | undefined) => `+${Math.round((v ?? 0) * 100)}%`
  const parts: string[] = []
  if (b.energyAdd) parts.push(`灵气产出 ${pct(b.energyAdd)}`)
  if (b.danAdd) parts.push(`出丹 ${pct(b.danAdd)}`)
  if ((b.passMul ?? 1) !== 1) parts.push(`每秒折点 ×${(b.passMul ?? 1).toFixed(1)}`)
  return parts.join(' · ')
})
/** 四道全过一共多少道基（表里的固定梯度，不随境界涨） */
const totalDaoJi = TRIALS.reduce((a, d) => a + (Number(d.daoJi) || 0), 0)
/** 未结婴时，已过的试炼一共欠多少道基——结婴那一刻补发 */
const daoJiPending = computed(() => trialDaoJiPending())

/** 点了「入试炼」但还没落子的那一道：第二下才真的清账 */
const pending = ref<string | null>(null)

function ask(id: string): void {
  pending.value = pending.value === id ? null : id
}

function confirmEnter(id: string): void {
  pending.value = null
  // 进去了就回修行页：这一世要从零重走，留在元婴页看着进度条没有意义
  if (enterTrial(id)) emit('entered')
}

function quit(): void {
  abortTrial()
}

/** 目标一律按 log10 报——试炼要爬的高度动不动几十个数量级 */
function targetText(log10: number): string {
  return fmt(BigNumber.fromLog10(log10))
}

/** 差几个数量级就说几个，比念百分比直观 */
function gapText(gap: number): string {
  if (gap <= 0) return '已到'
  return `还差 ${gap.toFixed(1)} 个数量级`
}

const progressWidth = computed(() => `${Math.round((status.value?.progress ?? 0) * 100)}%`)
</script>

<template>
  <div class="trial">
    <!-- 局中：这一条常驻在最上面，进度、退出、结算都在这里 -->
    <section v-if="status" class="board active-board">
      <div class="board-head">
        <span class="board-name">{{ status.def.name }}</span>
        <span class="board-penalty">{{ status.def.penalty }}</span>
      </div>
      <p class="board-task">
        把本世累计灵气重新攒到
        <b>{{ targetText(status.targetLog10) }}</b>
        <span class="board-now">眼下 {{ targetText(status.nowLog10) }} · {{ gapText(status.gapLog10) }}</span>
      </p>
      <div class="bar" role="progressbar" :aria-valuenow="Math.round(status.progress * 100)">
        <i :style="{ width: progressWidth }"></i>
      </div>
      <p class="board-note">
        这一世是从零重修的：法门与灵气都散了，破境与自动化也封着。
        过关自动结算，不用回来按按钮。
      </p>
      <div class="board-actions">
        <button class="ghost" type="button" @click="quit">退 出 试 炼</button>
        <button v-if="status.progress >= 1" class="primary" type="button" @click="settleTrial()">
          领 取 奖 励
        </button>
      </div>
      <p class="board-warn">退出只摘标记：已经在进入那一刻散掉的这一世，回不来。</p>
    </section>

    <!-- 没解锁：先把条件说清楚，不摆一排点不动的卡片 -->
    <section v-else-if="!gate.unlocked" class="board">
      <p class="locked-name">尚 未 开 试</p>
      <p class="locked-note">
        试炼是拿整整一世去赌的买卖，赌注得是一枚真金丹——
        先结出第一层丹，这一页才开。眼下是<b>{{ gate.jindan }}</b> 层，还差
        <b>{{ gate.need - gate.jindan }}</b> 层。
      </p>
    </section>

    <template v-else>
      <section class="board intro">
        <p class="intro-line">
          元婴这一页分四区：<b>试炼</b>在这里，<b>炼神 / 神悟 / 斗法</b>在隔壁——
          后三区要结婴之后才开，门在「炼神」那一页上。
        </p>
        <p class="intro-line">
          入试炼 = <b>散掉这一世</b>（法门、灵气、本世累计全清，而且<b>不折成破境点数</b>），
          但根骨、法宝、鉴宝台、金丹层数一样不动。
        </p>
        <p class="intro-line">
          然后在更差的条件里，把本世累计重新爬回<b>你进来时的高度</b>，就算过关。
          目标按你自己的进度定，所以第几世进来都是差不多的活。
        </p>
        <p class="intro-line">
          四道按结丹层数一档一档开：
          <template v-for="(row, i) in rows" :key="row.def.id">
            <span v-if="i > 0"> · </span>{{ row.def.name }} <b>{{ row.minJindan }}</b> 层
          </template>
        </p>
      </section>

      <div class="grid">
        <article
          v-for="row in rows"
          :key="row.def.id"
          class="tile"
          :class="{ done: row.done, live: row.active }"
        >
          <header class="tile-head">
            <p class="name">{{ row.def.name }}</p>
            <span v-if="row.done" class="badge done">已 过</span>
            <span v-else class="badge slow">慢 ×{{ Number(row.slow.toFixed(1)) }}</span>
          </header>

          <p class="desc">{{ row.def.desc }}</p>

          <dl class="facts">
            <div class="fact">
              <dt>罚则</dt>
              <dd class="penalty">{{ row.def.penalty }}</dd>
            </div>
            <div class="fact">
              <dt>目标</dt>
              <dd>本世累计回到 {{ targetText(row.targetLog10) }}</dd>
            </div>
            <div class="fact">
              <dt>奖励</dt>
              <dd class="reward">
                {{ row.def.reward }}
                <template v-if="row.daoJi > 0">
                  <br />
                  <span class="dao" :class="{ paid: row.daoJiPaid }">
                    {{ row.daoJiPaid ? `已兑现 ${row.daoJi} 道基` : `结婴后另给 ${row.daoJi} 道基` }}
                  </span>
                </template>
              </dd>
            </div>
          </dl>

          <button
            v-if="row.done"
            class="enter done-btn"
            type="button"
            disabled
          >已 经 过 了</button>
          <button
            v-else-if="row.active"
            class="enter live-btn"
            type="button"
            disabled
          >正 在 局 中</button>
          <button
            v-else-if="!row.unlocked"
            class="enter"
            type="button"
            disabled
          >需 {{ row.gateName }}</button>
          <button
            v-else
            class="enter"
            type="button"
            :class="{ asking: pending === row.def.id }"
            @click="ask(row.def.id)"
          >{{ pending === row.def.id ? '再 想 想' : '入 试 炼' }}</button>

          <div v-if="pending === row.def.id" class="confirm">
            <p class="confirm-warn">
              点下去这一世的灵气与法门就没了，而且<b>不会折成破境点数</b>。
              想清楚再按。
            </p>
            <button class="primary full" type="button" @click="confirmEnter(row.def.id)">
              确 认 · 散 掉 这 一 世
            </button>
          </div>
        </article>
      </div>

      <p class="foot">
        四道全过：<b>{{ totalDaoJi }} 道基</b>，外加 <b>{{ totalBuff }}</b>。
        道基是元婴的货币（神悟台、斗法花它），<b>结婴之后才发</b>：
        <template v-if="daoJiPending > 0">
          你已过的那几道欠着 {{ daoJiPending }} 点，结婴那一刻一起补上。
        </template>
        <template v-else>
          结婴之后每过一道当场到账。
        </template>
        永久加成当场生效、跨世保留，不随境界贬值。奖励只发一次，做完永久锁定。已过 {{ cleared }} / {{ total }}。
      </p>
    </template>
  </div>
</template>

<style scoped>
/* 板上那一条：解锁提示、局中进度、页首说明共用同一个壳 */
.board {
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
}

.active-board {
  border-color: var(--accent-line);
  box-shadow: inset 0 0 0 1px var(--accent-line), var(--shadow-panel);
}

.board-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.board-name {
  font-size: 17px;
  letter-spacing: 4px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
}

.board-penalty {
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 0.5px;
}

.board-task {
  margin: 10px 0 8px;
  font-size: 13px;
  letter-spacing: 0.5px;
  color: var(--ink);
  line-height: 1.7;
}

.board-task b {
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
}

.board-now {
  margin-left: 8px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.bar {
  height: 8px;
  border-radius: 999px;
  background: var(--accent-wash);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent-soft), var(--accent));
  transition: width 0.3s ease;
}

.board-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-faint);
}

.board-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.ghost {
  cursor: pointer;
  padding: 9px 16px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: var(--surface-flat);
  color: var(--ink-dim);
  font-size: 12px;
  letter-spacing: 2px;
}

.ghost:hover {
  background: var(--tint-hover);
}

.primary {
  cursor: pointer;
  padding: 9px 18px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 100%);
  color: var(--ink-invert);
  font-size: 12px;
  letter-spacing: 2px;
  box-shadow: 0 3px 0 var(--edge-accent);
}

.primary.full {
  width: 100%;
  margin-top: 10px;
}

.board-warn {
  margin: 10px 0 0;
  font-size: 11px;
  letter-spacing: 0.5px;
  color: var(--ink-faint);
}

.locked-name {
  margin: 0;
  font-size: 17px;
  letter-spacing: 6px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
}

.locked-note {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.9;
  color: var(--ink-dim);
}

.locked-note b {
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
}

.intro {
  border-style: dashed;
  background: var(--surface-flat);
}

.intro-line {
  margin: 0;
  font-size: 12px;
  line-height: 1.9;
  color: var(--ink-dim);
  letter-spacing: 0.4px;
}

.intro-line + .intro-line {
  margin-top: 6px;
}

.intro-line b {
  color: var(--accent-deep);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-auto-rows: 1fr;
  gap: 16px;
  margin-top: 16px;
}

.tile {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
}

.tile.live {
  border-color: var(--accent-line);
  box-shadow: inset 0 0 0 1px var(--accent-line), var(--shadow-panel);
}

.tile.done {
  border-color: var(--achieved-line);
  background: linear-gradient(180deg, var(--achieved-wash) 0%, var(--surface-raised) 100%);
}

.tile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.name {
  margin: 0;
  font-size: 17px;
  letter-spacing: 3px;
  color: var(--ink);
  font-family: var(--font-kai);
}

.tile.done .name {
  color: var(--achieved-deep);
}

.badge {
  padding: 2px 9px;
  border-radius: 8px;
  font-size: 11px;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}

.badge.slow {
  border: 1px solid var(--line-strong);
  background: var(--surface-flat);
  color: var(--ink-dim);
}

.badge.done {
  border: 1px solid var(--achieved-deep);
  background: var(--achieved-wash);
  color: var(--achieved-deep);
}

.desc {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-faint);
}

.facts {
  margin: 12px 0 0;
  display: grid;
  gap: 7px;
}

.fact {
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 8px;
  align-items: baseline;
}

.fact dt {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--ink-faint);
}

.fact dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

.fact dd.penalty {
  color: var(--danger, #c0533a);
}

.fact dd.reward {
  color: var(--accent-deep);
}

/* 道基那一行：还没结婴时是"欠着"，到手之后颜色压下去 */
.fact dd.reward .dao {
  display: inline-block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--ink-dim);
}

.fact dd.reward .dao.paid {
  color: var(--ink-faint);
}

.enter {
  cursor: pointer;
  margin-top: auto;
  padding: 10px 16px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 100%);
  color: var(--ink-invert);
  font-size: 12px;
  letter-spacing: 3px;
  box-shadow: 0 3px 0 var(--edge-accent);
  transition: filter 0.16s ease;
}

.enter:hover:not(:disabled) {
  filter: brightness(1.06) saturate(1.08);
}

.enter.asking {
  background: var(--surface-flat);
  color: var(--ink-dim);
  border-color: var(--line-strong);
  box-shadow: none;
}

.enter:disabled {
  cursor: default;
  border-color: var(--line);
  background: var(--surface-flat);
  color: var(--ink-faint);
  box-shadow: none;
}

.confirm {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--line-strong);
}

.confirm-warn {
  margin: 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--danger, #c0533a);
}

.foot {
  margin: 18px 0 0;
  font-size: 11px;
  letter-spacing: 0.5px;
  color: var(--ink-faint);
}
</style>
