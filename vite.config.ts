import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // 发 GitHub Pages 用相对路径：项目页挂在 /<仓库名>/ 下，写死前缀换仓库名就得改一次。
  // dev 服务器不受这行影响，照旧从 http://localhost:5173/ 进
  base: './',
})
