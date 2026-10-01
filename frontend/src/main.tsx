import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import * as Tooltip from '@radix-ui/react-tooltip'
import '@fontsource-variable/inter'
import './index.css'
import App from './App'
import { ApiError } from './lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, err) => !(err instanceof ApiError && err.status < 500) && n < 2,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Tooltip.Provider>
          <App />
        </Tooltip.Provider>
        <Toaster position="bottom-right" toastOptions={{ className: '!bg-surface !text-ink !shadow-pop !border-0 !rounded-xl !font-sans' }} />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
