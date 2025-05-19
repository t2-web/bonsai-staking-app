import './assets/main.css'
import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { WagmiPlugin } from '@wagmi/vue';
import { config } from './plugins/wallet';
import App from './App.vue'
import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
// 先にVuetifyインスタンスを作成
const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#212321',
          surface: '#1a1a1a',
          primary: '#ffffff',
          'primary-darken-1': '#888888',
          secondary: '#2e2e2e',
        }
      }
    }
  }
})

const app = createApp(App)
app.use(WagmiPlugin, { config })
app.use(VueQueryPlugin)
app.use(vuetify)
app.use(Toast, { position: 'bottom-left', timeout: 5000 })
app.mount('#app')