<script setup lang="ts">
import { hasSave, startGame } from '../game/state'
</script>

<template>
  <div class="start-screen">
    <div class="sun"></div>
    <div class="cloud cloud-1"></div>
    <div class="cloud cloud-2"></div>
    <div class="cloud cloud-3"></div>
    <div class="haze"></div>

    <main class="content">
      <p class="seal">仙 途 茫 茫</p>
      <h1 class="title">问道长生</h1>
      <p class="subtitle">天地灵气，自有造化。一念入道，万法自然。</p>
      <button class="start-btn" @click="startGame">
        {{ hasSave ? '继 续 修 行' : '踏 入 仙 途' }}
      </button>
      <p class="hint">{{ hasSave ? '—— 已存本地进度，点击继续 ——' : '—— 点击开始修行 ——' }}</p>
    </main>
  </div>
</template>

<style scoped>
.start-screen {
  position: relative;
  height: 100dvh;
  overflow: clip;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse at 50% 118%, var(--bg-low) 0%, transparent 62%),
    linear-gradient(180deg, var(--bg-top) 0%, var(--bg-mid) 55%, #cfe4f7 100%);
}

/* 晴日 */
.sun {
  position: absolute;
  top: 12%;
  right: 14%;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 35%, #ffffff 0%, #eaf6ff 55%, #bfe0f7 100%);
  box-shadow:
    0 0 46px 12px rgba(150, 205, 245, 0.55),
    0 0 130px 46px rgba(150, 205, 245, 0.3);
}

/* 云海 */
.cloud {
  position: absolute;
  width: 60vw;
  height: 22vh;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(255, 255, 255, 0.85) 0%, transparent 70%);
  filter: blur(6px);
}
.cloud-1 { bottom: -6%; left: -10%; animation: drift 26s ease-in-out infinite alternate; }
.cloud-2 { bottom: -10%; right: -15%; animation: drift 34s ease-in-out infinite alternate-reverse; }
.cloud-3 { bottom: 2%; left: 25%; animation: drift 42s ease-in-out infinite alternate; }

/* 地平线上的一层薄雾，把白云的边缘收进底色里 */
.haze {
  position: absolute;
  inset: auto 0 0;
  height: 34vh;
  background: linear-gradient(180deg, transparent, rgba(210, 232, 250, 0.9));
  pointer-events: none;
}

@keyframes drift {
  from { transform: translateX(-3vw); }
  to { transform: translateX(3vw); }
}

/* 内容 */
.content {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 0 24px;
  animation: rise 1.6s ease-out both;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

.seal {
  margin: 0 0 18px;
  font-size: 14px;
  letter-spacing: 12px;
  text-indent: 12px;
  color: var(--ink-dim);
}

.title {
  margin: 0;
  font-size: clamp(56px, 10vw, 108px);
  font-weight: 600;
  line-height: 1.25; /* 行盒需高于字形，否则渐变裁切会削掉字头 */
  letter-spacing: 18px;
  text-indent: 18px; /* 抵消末字间距，视觉居中 */
  background: linear-gradient(180deg, #7cc4f2 0%, #1e7cc4 45%, #0f4f80 75%, #1e7cc4 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 0 60px rgba(120, 190, 240, 0.35);
  font-family: var(--font-kai);
}

.subtitle {
  margin: 22px 0 56px;
  font-size: 16px;
  letter-spacing: 4px;
  color: var(--ink-dim);
}

.start-btn {
  cursor: pointer;
  padding: 16px 64px;
  font-size: 20px;
  letter-spacing: 10px;
  text-indent: 10px;
  color: var(--ink-invert);
  background: linear-gradient(180deg, var(--accent-soft), var(--accent));
  border: 1px solid var(--accent-deep);
  border-radius: 999px;
  box-shadow:
    0 6px 0 var(--edge-accent),
    0 10px 26px rgba(30, 124, 196, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    background 0.25s ease;
  font-family: inherit;
}

.start-btn:hover {
  transform: translateY(-2px);
  background: linear-gradient(180deg, #74bdec, #2a8ad0);
  box-shadow:
    0 8px 0 var(--edge-accent),
    0 14px 32px rgba(30, 124, 196, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.start-btn:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 var(--edge-accent),
    0 4px 12px rgba(30, 124, 196, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.hint {
  margin-top: 30px;
  font-size: 12px;
  letter-spacing: 6px;
  text-indent: 6px;
  color: var(--ink-faint);
  animation: pulse 2.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

/* 横屏矮视口：收紧纵向留白，标题按视口高度收敛 */
@media (max-height: 700px) {
  .title {
    font-size: clamp(44px, 13vh, 84px);
    letter-spacing: 14px;
    text-indent: 14px;
  }

  .subtitle {
    margin: 16px 0 32px;
  }

  .start-btn {
    padding: 13px 54px;
    font-size: 18px;
  }

  .hint {
    margin-top: 20px;
  }
}
</style>
