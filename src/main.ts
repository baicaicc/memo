import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { setupCompat } from './wechat/compat'
import { initSfx } from './audio/sfx'
import { useSyncStore } from './stores/sync'
import './styles/global.css'

setupCompat()
initSfx()

const pinia = createPinia()
createApp(App).use(pinia).use(router).mount('#app')

// 启动时与云端存档对齐一次（无成绩且未开启存档时什么也不做）
void useSyncStore(pinia).sync()
