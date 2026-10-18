<script setup lang="ts">
import { computed, ref } from 'vue'
import TrialPanel from './TrialPanel.vue'
import YuanShenPanel from './YuanShenPanel.vue'
import YuanDaoPanel from './YuanDaoPanel.vue'
import YuanFightPanel from './YuanFightPanel.vue'
import { yuanRealmOpen } from '../game/state'

/**
 * 元婴页：试炼 / 炼神 / 神悟 / 斗法 四个子页。
 *
 * 0.21 只有「试炼」一区（另摆三张"未开"的预告卡）；0.22 把元神本体接上之后，
 * 三脉各占一个子页——试炼是一整页卡片、炼神是一整页取舍、神悟台与斗法是两张表，
 * 四者体量相当，摊开来比折叠清楚。样式与金丹页的 `sub-tabs` 同一套。
 *
 * 后三页要**结婴**之后才给点：炼神页本身会把"累计灵气 1e80 + 结丹一层"那道门念清楚，
 * 神悟与斗法则直接灰掉——没结婴就没有道基，摆出来也只是一排 0。
 */
const emit = defineEmits<{ entered: [] }>()

const open = computed(() => yuanRealmOpen())
const subTab = ref<'trial' | 'shen' | 'dao' | 'fight'>('trial')

function pick(tab: 'trial' | 'shen' | 'dao' | 'fight'): void {
  if ((tab === 'dao' || tab === 'fight') && !open.value) return
  subTab.value = tab
}
</script>

<template>
  <div class="yuan">
    <nav class="sub-tabs" aria-label="元婴">
      <button
        type="button"
        class="sub-tab"
        :class="{ on: subTab === 'trial' }"
        @click="pick('trial')"
      >试 炼</button>
      <button
        type="button"
        class="sub-tab"
        :class="{ on: subTab === 'shen' }"
        @click="pick('shen')"
      >炼 神</button>
      <button
        type="button"
        class="sub-tab"
        :class="{ on: subTab === 'dao', dim: !open }"
        :disabled="!open"
        :title="open ? '' : '结婴之后才开'"
        @click="pick('dao')"
      >神 悟</button>
      <button
        type="button"
        class="sub-tab"
        :class="{ on: subTab === 'fight', dim: !open }"
        :disabled="!open"
        :title="open ? '' : '结婴之后才开'"
        @click="pick('fight')"
      >斗 法</button>
    </nav>

    <TrialPanel v-if="subTab === 'trial'" @entered="emit('entered')" />
    <YuanShenPanel v-else-if="subTab === 'shen'" />
    <YuanDaoPanel v-else-if="subTab === 'dao' && open" />
    <YuanFightPanel v-else-if="subTab === 'fight' && open" />
  </div>
</template>

<style scoped>
.yuan {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 子标签：和金丹那一页是同一种排法 */
.sub-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: none;
}

.sub-tab {
  cursor: pointer;
  padding: 6px 20px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--ink-dim);
  font-size: 13px;
  letter-spacing: 3px;
  text-indent: 3px;
  font-family: var(--font-kai);
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.sub-tab:hover {
  color: var(--ink);
}

.sub-tab.on {
  border-color: var(--accent-line);
  background: var(--accent-wash);
  color: var(--accent-deep);
}

/* 没结婴的那两页：灰着但不消失，玩家得知道后面还有什么 */
.sub-tab.dim {
  cursor: not-allowed;
  opacity: 0.5;
}

.sub-tab:disabled {
  cursor: not-allowed;
}
</style>
