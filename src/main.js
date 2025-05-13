import './assets/main.css'
import { createApp } from 'vue'
import App from './App.vue'
import { createVuetify } from 'vuetify'
import 'vuetify/styles'

// 先にVuetifyインスタンスを作成
const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#1a1a1a',
          surface: '#1a1a1a',
          primary: '#ffffff',
          'primary-darken-1': '#888888',
          secondary: '#2e2e2e',
        }
      }
    }
  }
})

// 作成したvuetifyインスタンスを使用
createApp(App).use(vuetify).mount('#app')