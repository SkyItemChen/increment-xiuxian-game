<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import AchievementToast from './components/AchievementToast.vue'
import AchievementsPage from './components/AchievementsPage.vue'
import AutomationPage from './components/AutomationPage.vue'
import ChangelogPage from './components/ChangelogPage.vue'
import DevPage from './components/DevPage.vue'
import GameScreen from './components/GameScreen.vue'
import SettingsPage from './components/SettingsPage.vue'
import StartScreen from './components/StartScreen.vue'
import { bootGameLoop, state, stopGameLoop } from './game/state'

onMounted(bootGameLoop)
onUnmounted(stopGameLoop)

/** 设置、自动化、成就、日志、测试各是一整页。修行画面留着不销毁，回来时还站在原来那个境界标签上 */
const page = ref<'game' | 'settings' | 'automation' | 'achievements' | 'changelog' | 'dev'>('game')

/**
 * 画面被打回开始页的那一刻（格式化数据就是这么走的），选页那一下还留在 App 上没松手，
 * 下一次进场会先撞见设置页。回开始就顺手归位到修行。
 */
watch(
  () => state.phase,
  (phase) => {
    if (phase === 'start') page.value = 'game'
  },
)
</script>

<template>
  <Transition name="fade" mode="out-in">
    <StartScreen v-if="state.phase === 'start'" key="start" />
    <div v-else key="play">
      <GameScreen
        v-show="page === 'game'"
        @open-settings="page = 'settings'"
        @open-automation="page = 'automation'"
        @open-achievements="page = 'achievements'"
        @open-changelog="page = 'changelog'"
        @open-dev="page = 'dev'"
      />
      <SettingsPage v-if="page === 'settings'" @back="page = 'game'" />
      <AutomationPage v-if="page === 'automation'" @back="page = 'game'" />
      <AchievementsPage v-if="page === 'achievements'" @back="page = 'game'" />
      <ChangelogPage v-if="page === 'changelog'" @back="page = 'game'" />
      <DevPage v-if="page === 'dev'" @back="page = 'game'" />
      <!-- 成就报条挂在这一层，切到哪一页都照报 -->
      <AchievementToast />
    </div>
  </Transition>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.45s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
