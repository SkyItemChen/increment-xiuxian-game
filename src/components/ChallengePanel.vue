<script setup lang="ts">
import { computed } from 'vue'
import { bonusSummary, challengeRows, fmtNum, milestoneRows, state, type ChallengeRow, type MilestoneRow } from '../game/state'

/**
 * 金丹页第三栏：挑战与结丹里程碑。
 * 这两张表都是"链上走过一遍"的凭据——门槛读的全是只涨不跌的那几笔累计，
 * 好处直接添在链上现成的轴上，被动生效，没有领取那一步，也就不用担心玩家漏领。
 */
const emit = defineEmits<{ back: [] }>()

const challenges = computed<ChallengeRow[]>(() => challengeRows())
const milestones = computed<MilestoneRow[]>(() => milestoneRows())
const gains = computed<string[]>(() => bonusSummary())

const doneChallenges = computed(() => challenges.value.filter((row) => row.unlocked).length)
const doneMilestones = computed(() => milestones.value.filter((row) => row.unlocked).length)

/** 里程碑那一栏顺手报一下已经结到第几层，玩家才知道自己站在哪一格上 */
const layerText = computed(() => fmtNum(state.jindan))

function percent(row: ChallengeRow): number {
  if (row.need <= 0) return 100
  return Math.round((Math.min(row.now, row.need) / row.need) * 100)
}
</script>

<template>
  <div class="challenge">
    <section class="column">
      <div class="head">
        <h2 class="heading">挑 战</h2>
        <span class="tally">{{ doneChallenges }} / {{ challenges.length }}</span>
      </div>
      <ul class="list">
        <li v-for="row in challenges" :key="row.def.id" class="item" :class="{ done: row.unlocked }">
          <div class="info">
            <p class="name">
              {{ row.def.name }}
              <span class="mark">{{ row.unlocked ? '已 圆 满' : row.progress }}</span>
            </p>
            <p class="effect">{{ row.def.hint }}</p>
            <p class="gain">达成：{{ row.def.reward }}</p>
            <span class="bar"><i :style="{ width: `${percent(row)}%` }"></i></span>
          </div>
        </li>
      </ul>
    </section>

    <section class="column">
      <div class="head">
        <h2 class="heading">结 丹 里 程 碑</h2>
        <span class="tally">{{ doneMilestones }} / {{ milestones.length }}</span>
      </div>
      <p class="ledger">已结金丹 <b>{{ layerText }}</b> 层</p>
      <ul class="list">
        <li v-for="row in milestones" :key="row.def.id" class="item" :class="{ done: row.unlocked }">
          <div class="info">
            <p class="name">
              第 {{ row.def.layer }} 层
              <span class="mark">{{ row.unlocked ? '已 圆 满' : row.progress }}</span>
            </p>
            <p class="gain">结到这一层：{{ row.def.reward }}</p>
          </div>
        </li>
      </ul>

      <div v-if="gains.length" class="now">
        <p class="now-title">眼 下 多 出</p>
        <p class="now-line">
          <span v-for="(line, i) in gains" :key="line"
            ><span v-if="i" class="dot">·</span>{{ line }}</span
          >
        </p>
      </div>

      <p class="note">
        这两张表都是一次达成、永久留着：结丹散掉的是这一世的灵气与法门修为，
        这些好处跟着炉子、精神、层数一起留着，不会又被收回去。
      </p>
      <button class="back" type="button" @click="emit('back')">回 丹 炉</button>
    </section>
  </div>
</template>

<style scoped>
.challenge {
  display: grid;
  grid-template-columns: 1fr;
  gap: 22px;
  align-content: start;
}

@media (min-width: 900px) {
  .challenge {
    grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
    align-items: start;
  }
}

.column {
  padding: 24px 24px 26px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.heading {
  margin: 0;
  font-size: 16px;
  letter-spacing: 6px;
  color: var(--accent);
  font-family: var(--font-kai);
  font-weight: 600;
}

/* 达成几条 / 一共几条：和成就页页头那一颗是同一枚 */
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

.ledger {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.ledger b {
  color: var(--sky-deep);
  font-size: 14px;
}

.list {
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item {
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-raised);
}

.item.done {
  border-color: var(--accent-line);
  background: var(--accent-wash);
}

.info {
  min-width: 0;
}

.name {
  margin: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 15px;
  letter-spacing: 2px;
  color: var(--ink);
  font-family: var(--font-kai);
}

/* 达成那一颗贴右边；没达成的写"还差几级"，同一颗位置不换，读起来才对得上 */
.mark {
  flex: none;
  padding: 2px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--ink-faint);
  font-size: 11px;
  letter-spacing: 1px;
  font-family: var(--font-song, inherit);
  font-variant-numeric: tabular-nums;
}

.item.done .mark {
  border-color: var(--accent-line);
  color: var(--accent-deep);
}

.effect {
  margin: 6px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--ink-dim);
}

.gain {
  margin: 3px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--accent-deep);
  line-height: 1.6;
}

.bar {
  display: block;
  margin: 10px 0 0;
  height: 6px;
  border-radius: 4px;
  background: var(--tint);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--accent-soft), var(--accent-deep));
  transition: width 0.18s ease;
}

/* 三张表合起来的那本总账，一句一条，中间点号隔开 */
.now {
  margin: 16px 0 0;
  padding: 14px 16px;
  border: 1px dashed var(--accent-line);
  border-radius: 14px;
  background: var(--surface-flat);
}

.now-title {
  margin: 0;
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--ink-faint);
}

.now-line {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
}

.dot {
  margin: 0 8px;
  color: var(--ink-faint);
}

.note {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--ink-faint);
}

.back {
  cursor: pointer;
  margin-top: 16px;
  padding: 9px 20px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 100%);
  color: var(--ink-invert);
  font-size: 13px;
  letter-spacing: 3px;
  text-indent: 3px;
  font-family: var(--font-kai);
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
</style>
