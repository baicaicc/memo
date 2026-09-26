import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { setupCompat } from './wechat/compat'
import './styles/global.css'

setupCompat()

createApp(App).use(createPinia()).use(router).mount('#app')
