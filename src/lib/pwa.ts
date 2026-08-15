import { registerSW, type RegisterSWOptions } from 'virtual:pwa-register'

export const OFFLINE_READY_NOTICE_MS = 5_000

export type UpdateServiceWorker = ReturnType<typeof registerSW>

type PwaLifecycleOptions = Pick<RegisterSWOptions, 'onNeedRefresh' | 'onOfflineReady'>

export function registerPwaLifecycle(options: PwaLifecycleOptions): UpdateServiceWorker {
  return registerSW({
    immediate: true,
    ...options,
    onRegisterError(error) {
      console.error('Service worker registration failed.', error)
    },
  })
}
