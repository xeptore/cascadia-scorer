import type { Game } from './domain/types'

const STORAGE_KEY = 'cascadia-scorer.current-game.v1'

export function loadGame(): Game | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const game = JSON.parse(stored) as Game
    if (!game.id || !Array.isArray(game.players) || game.players.length < 2) return null
    return game
  } catch {
    return null
  }
}

export function saveGame(game: Game): void {
  game.updatedAt = new Date().toISOString()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(game))
}

export function clearGame(): void {
  localStorage.removeItem(STORAGE_KEY)
}
