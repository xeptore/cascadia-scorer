import {
  GAME_SCHEMA_VERSION,
  HABITAT_TYPES,
  WILDLIFE_TYPES,
  type Game,
  type HabitatType,
  type Player,
  type WildlifeType,
} from './domain/types'

// Keep the original key stable: changing it would strand existing local games.
export const GAME_STORAGE_KEY = 'cascadia-scorer:active-game'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value))
}

function isStoredScore(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0)
}

function isStoredScoreRecord<Key extends string>(
  value: unknown,
  keys: readonly Key[],
): value is Record<Key, number | null> {
  return isRecord(value) && keys.every((key) => isStoredScore(value[key]))
}

function isStoredPlayer(value: unknown): value is Player {
  if (!isRecord(value)) return false

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isStoredScoreRecord<WildlifeType>(value.wildlifeScores, WILDLIFE_TYPES) &&
    isStoredScoreRecord<HabitatType>(value.habitatCorridors, HABITAT_TYPES) &&
    isStoredScore(value.natureTokens)
  )
}

function isStoredGame(value: unknown): value is Game {
  if (!isRecord(value)) return false

  if (
    value.schemaVersion !== GAME_SCHEMA_VERSION ||
    !isNonEmptyString(value.id) ||
    !isIsoTimestamp(value.createdAt) ||
    !isIsoTimestamp(value.updatedAt) ||
    (value.stage !== 'scoring' && value.stage !== 'results') ||
    (value.activeSection !== 'wildlife' &&
      value.activeSection !== 'habitats' &&
      value.activeSection !== 'tokens') ||
    !WILDLIFE_TYPES.some((wildlife) => wildlife === value.activeWildlife) ||
    !HABITAT_TYPES.some((habitat) => habitat === value.activeHabitat) ||
    !Array.isArray(value.players) ||
    value.players.length < 2 ||
    value.players.length > 4 ||
    !value.players.every(isStoredPlayer)
  ) {
    return false
  }

  const playerIds = value.players.map((player) => player.id)
  return new Set(playerIds).size === playerIds.length
}

function migrateSchemaV1ToV2(game: UnknownRecord): Game | null {
  const migrated = {
    ...game,
    schemaVersion: GAME_SCHEMA_VERSION,
    // Schema v1 only had updatedAt. It is the best available creation-time
    // approximation and preserves the original timestamp without inventing "now".
    createdAt: game.updatedAt,
  }

  return isStoredGame(migrated) ? migrated : null
}

function migrateGame(value: unknown): Game | null {
  if (!isRecord(value)) return null

  switch (value.schemaVersion) {
    case GAME_SCHEMA_VERSION:
      return isStoredGame(value) ? value : null

    case 1:
      return migrateSchemaV1ToV2(value)

    case undefined:
      // Builds released before schema versioning used the v1 shape but omitted
      // schemaVersion. Treat only that exact absence as v1, then fully validate.
      return migrateSchemaV1ToV2({ ...value, schemaVersion: 1 })

    default:
      // Unknown, malformed, or newer versions must not be guessed at.
      return null
  }
}

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadGame(storage: StorageLike | null = browserStorage()): Game | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(GAME_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return migrateGame(parsed)
  } catch {
    return null
  }
}

export function saveGame(game: Game, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(GAME_STORAGE_KEY, JSON.stringify(game))
    return true
  } catch {
    return false
  }
}

export function clearGame(storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    storage.removeItem(GAME_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
