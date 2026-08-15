export const WILDLIFE_TYPES = ['bear', 'elk', 'salmon', 'hawk', 'fox'] as const
export const HABITAT_TYPES = ['mountain', 'forest', 'prairie', 'wetland', 'river'] as const
export const GAME_SCHEMA_VERSION = 2 as const

export type WildlifeType = (typeof WILDLIFE_TYPES)[number]
export type HabitatType = (typeof HABITAT_TYPES)[number]
export type ScoreSection = 'wildlife' | 'habitats' | 'tokens'

export interface Player {
  id: string
  name: string
  wildlifeScores: Record<WildlifeType, number | null>
  habitatCorridors: Record<HabitatType, number | null>
  natureTokens: number | null
}

export interface Game {
  schemaVersion: typeof GAME_SCHEMA_VERSION
  id: string
  players: Player[]
  stage: 'scoring' | 'results'
  activeSection: ScoreSection
  activeWildlife: WildlifeType
  activeHabitat: HabitatType
  createdAt: string
  updatedAt: string
}

export const WILDLIFE_LABELS: Record<WildlifeType, string> = {
  bear: 'Bear',
  elk: 'Elk',
  salmon: 'Salmon',
  hawk: 'Hawk',
  fox: 'Fox',
}

export const WILDLIFE_SYMBOLS: Record<WildlifeType, string> = {
  bear: '🐻',
  elk: '🦌',
  salmon: '🐟',
  hawk: '🦅',
  fox: '🦊',
}

export const HABITAT_LABELS: Record<HabitatType, string> = {
  mountain: 'Mountain',
  forest: 'Forest',
  prairie: 'Prairie',
  wetland: 'Wetland',
  river: 'River',
}

export const HABITAT_SYMBOLS: Record<HabitatType, string> = {
  mountain: '⛰️',
  forest: '🌲',
  prairie: '🌾',
  wetland: '🪷',
  river: '🌊',
}

export function createPlayer(name: string): Player {
  return {
    id: createId(),
    name: name.trim(),
    wildlifeScores: {
      bear: null,
      elk: null,
      salmon: null,
      hawk: null,
      fox: null,
    },
    habitatCorridors: {
      mountain: null,
      forest: null,
      prairie: null,
      wetland: null,
      river: null,
    },
    natureTokens: null,
  }
}

export function createGame(names: string[], now = new Date()): Game {
  const cleanedNames = names.map((name) => name.trim()).filter(Boolean)
  if (cleanedNames.length < 2 || cleanedNames.length > 4) {
    throw new Error('A game needs 2 to 4 players.')
  }
  if (new Set(cleanedNames.map((name) => name.toLocaleLowerCase())).size !== cleanedNames.length) {
    throw new Error('Player names must be unique.')
  }

  const timestamp = now.toISOString()
  return {
    schemaVersion: GAME_SCHEMA_VERSION,
    id: createId(),
    players: cleanedNames.map(createPlayer),
    stage: 'scoring',
    activeSection: 'wildlife',
    activeWildlife: 'bear',
    activeHabitat: 'mountain',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function touchGame(game: Game, now = new Date()): void {
  game.updatedAt = now.toISOString()
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
