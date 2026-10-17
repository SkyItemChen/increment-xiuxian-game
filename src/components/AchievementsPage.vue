<script setup lang="ts">
import { computed, ref } from 'vue'
import { achievementRows } from '../game/state'
import { REALM_SEQUENCE, type AchievementRealm } from '../game/词条与属性'

/**
 * 成就是一整页，和设置页、自动化页同一个做法。
 * 这页只当"解锁了什么"的账本：判定和好处都长在 state.ts 那头的门槛函数上，达成一条就永久留着。
 * 按境界分档、档头可以折叠，档头自己报这一档达成几条；达成的一格整格刷青绿，
 * 一眼就能看出这档清到哪儿了。
 */
const emit = defineEmits<{ back: [] }>()

const rows = computed(() => achievementRows())
const done = computed(() => rows.value.filter((row) => row.unlocked).length)

const groups = computed(() =>
  REALM_SEQUENCE.map((realm) => {
    const items = rows.value.filter((row) => row.def.realm === realm)
    return { realm, items, done: items.filter((row) => row.unlocked).length }
  }).filter((group) => group.items.length > 0),
)

/* 默认三档都摊开；收起按档记账，翻别的页再回来不会自己弹开 */
const closed = ref<Partial<Record<AchievementRealm, boolean>>>({})

function isOpen(realm: AchievementRealm): boolean {
  return !closed.value[realm]
}

function toggle(realm: AchievementRealm): void {
  closed.value = { ...closed.value, [realm]: !closed.value[realm] }
}
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
      <template v-if="groups.length">
        <section v-for="group in groups" :key="group.realm" class="group">
          <button
            class="group-head"
            type="button"
            :aria-expanded="isOpen(group.realm)"
            @click="toggle(group.realm)"
          >
            <span class="realm">{{ group.realm }}</span>
            <span class="group-tally" :class="{ full: group.done === group.items.length }">
              {{ group.done }} / {{ group.items.length }}
            </span>
            <span class="chev" :class="{ open: isOpen(group.realm) }" aria-hidden="true">▾</span>
          </button>

          <div v-show="isOpen(group.realm)" class="grid">
            <div v-for="row in group.items" :key="row.def.id" class="tile" :class="{ done: row.unlocked }">
              <p class="name">{{ row.def.name }}</p>
              <p class="gain">{{ row.def.desc }}</p>
              <p v-if="!row.unlocked" class="progress">{{ row.progress }}</p>
              <span class="medal">
                <span v-if="row.unlocked" class="check" aria-hidden="true">✓</span>
                {{ row.unlocked ? '已 达 成' : '未 达 成' }}
              </span>
            </div>
          </div>
        </section>
      </template>
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

/* 一档一折：档头整条可点，左边是境界、右边是这一档的账和一个箭头 */
.group + .group {
  margin-top: 18px;
}

.group-head {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-flat);
  color: var(--ink);
  text-align: left;
  transition: background 0.16s ease;
}

.group-head:hover {
  background: var(--tint-hover);
}

.realm {
  font-size: 16px;
  letter-spacing: 6px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
}

.group-tally {
  padding: 2px 10px;
  border: 1px solid var(--accent-line);
  border-radius: 8px;
  background: var(--accent-wash);
  color: var(--accent-deep);
  font-size: 12px;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}

.group-tally.full {
  border-color: var(--achieved-line);
  background: var(--achieved-wash);
  color: var(--achieved-deep);
}

.chev {
  margin-left: auto;
  color: var(--ink-faint);
  font-size: 14px;
  line-height: 1;
  transition: transform 0.18s ease;
}

.chev.open {
  transform: rotate(180deg);
}

.group .grid {
  margin-top: 12px;
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

/* 达成的一格整片转青绿：底色、描边、名字一起换，和没达成的蓝格子拉开距离 */
.tile.done {
  border-color: var(--achieved-line);
  background: linear-gradient(180deg, var(--achieved-wash) 0%, var(--surface-raised) 100%);
  box-shadow: inset 0 0 0 1px var(--achieved-line), var(--shadow-panel);
}

/* 名字贴着左边，不再跟境界标签挤一行——分组已经把境界写在档头上了 */
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

.gain {
  margin: 6px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--accent-deep);
  line-height: 1.6;
}

.tile.done .gain {
  color: var(--achieved);
}

.progress {
  margin: 4px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

/* 达成那枚贴右下角，换成实心青绿；没达成的只留个灰框 */
.medal {
  display: inline-flex;
  align-items: center;
  gap: 5px;
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

.check {
  font-size: 12px;
  line-height: 1;
}

.tile.done .medal {
  border-color: var(--achieved-deep);
  background: linear-gradient(180deg, var(--achieved) 0%, var(--achieved-deep) 100%);
  color: var(--ink-invert);
  box-shadow: 0 3px 0 var(--achieved-deep);
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

  .group + .group {
    margin-top: 12px;
  }

  .group-head {
    padding: 9px 14px;
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
