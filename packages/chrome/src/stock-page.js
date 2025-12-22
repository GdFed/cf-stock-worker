import { createApp } from 'vue'
import { StockDetail } from '@cf-stock-worker/components'

const code = new URLSearchParams(location.search).get('code') || '600865'

const app = createApp(StockDetail, {
  codeId: `${code.startsWith('6')?'1':'0'}.${code}`,
})

app.mount('#app')
