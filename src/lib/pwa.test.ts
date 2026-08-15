import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerSW } from 'virtual:pwa-register'
import { OFFLINE_READY_NOTICE_MS, registerPwaLifecycle } from './pwa'

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => async () => {}),
}))

describe('PWA lifecycle', () => {
  beforeEach(() => {
    vi.mocked(registerSW).mockClear()
  })

  it('registers immediately and forwards lifecycle callbacks', () => {
    const onNeedRefresh = vi.fn()
    const onOfflineReady = vi.fn()

    const updateServiceWorker = registerPwaLifecycle({ onNeedRefresh, onOfflineReady })

    expect(updateServiceWorker).toEqual(expect.any(Function))
    expect(registerSW).toHaveBeenCalledWith(
      expect.objectContaining({
        immediate: true,
        onNeedRefresh,
        onOfflineReady,
        onRegisterError: expect.any(Function),
      }),
    )
    expect(OFFLINE_READY_NOTICE_MS).toBe(5_000)
  })

  it('reports registration failures without throwing', () => {
    const error = new Error('registration failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    registerPwaLifecycle({ onNeedRefresh: vi.fn(), onOfflineReady: vi.fn() })

    const options = vi.mocked(registerSW).mock.calls[0][0]
    expect(() => options?.onRegisterError?.(error)).not.toThrow()
    expect(consoleError).toHaveBeenCalledWith('Service worker registration failed.', error)

    consoleError.mockRestore()
  })
})
