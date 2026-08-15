import { describe, expect, it } from 'vitest'
import { GAME_SCHEMA_VERSION, createGame, touchGame, type Game, type Player } from './domain/types'
import { clearGame, GAME_STORAGE_KEY, loadGame, saveGame } from './persistence'

class MemoryStorage implements Storage {
  protected values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

class ThrowingStorage extends MemoryStorage {
  constructor(private operation: 'get' | 'set' | 'remove') {
    super()
  }

  override getItem(key: string): string | null {
    if (this.operation === 'get') throw new DOMException('Storage blocked')
    return super.getItem(key)
  }

  override setItem(key: string, value: string): void {
    if (this.operation === 'set') throw new DOMException('Quota exceeded')
    super.setItem(key, value)
  }

  override removeItem(key: string): void {
    if (this.operation === 'remove') throw new DOMException('Storage blocked')
    super.removeItem(key)
  }
}

const now = new Date('2026-08-13T08:00:00.000Z')

function validGame(): Game {
  const game = createGame(['Ada', 'Grace'], now)
  game.players[0].wildlifeScores.bear = 18
  game.players[0].habitatCorridors.mountain = 7
  game.players[0].natureTokens = 2
  return game
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function storeValue(storage: Storage, value: unknown): void {
  storage.setItem(GAME_STORAGE_KEY, JSON.stringify(value))
}

describe('game persistence', () => {
  describe('saving and clearing', () => {
    it('round-trips a valid game without changing it', () => {
      const storage = new MemoryStorage()
      const game = validGame()
      const before = clone(game)

      expect(saveGame(game, storage)).toBe(true)
      expect(game).toEqual(before)
      expect(loadGame(storage)).toEqual(game)
    })

    it('writes to the stable game storage key', () => {
      const storage = new MemoryStorage()
      const game = validGame()

      saveGame(game, storage)

      expect(storage.length).toBe(1)
      expect(storage.getItem(GAME_STORAGE_KEY)).toBe(JSON.stringify(game))
    })

    it('clears a stored game and reports success', () => {
      const storage = new MemoryStorage()
      saveGame(validGame(), storage)

      expect(clearGame(storage)).toBe(true)
      expect(loadGame(storage)).toBeNull()
    })

    it('returns false instead of throwing when a save fails', () => {
      expect(saveGame(validGame(), new ThrowingStorage('set'))).toBe(false)
    })

    it('returns false instead of throwing when clearing fails', () => {
      expect(clearGame(new ThrowingStorage('remove'))).toBe(false)
    })
  })

  describe('loading defensively', () => {
    it('returns null when no saved game exists', () => {
      expect(loadGame(new MemoryStorage())).toBeNull()
    })

    it('returns null when storage access fails', () => {
      expect(loadGame(new ThrowingStorage('get'))).toBeNull()
    })

    it.each([
      ['malformed JSON', '{not json'],
      ['JSON null', 'null'],
      ['a primitive', '42'],
      ['an array', '[]'],
    ])('rejects %s', (_label, raw) => {
      const storage = new MemoryStorage()
      storage.setItem(GAME_STORAGE_KEY, raw)
      expect(loadGame(storage)).toBeNull()
    })

    it.each([
      ['an unknown older version', 0],
      ['a newer version', GAME_SCHEMA_VERSION + 1],
      ['a malformed version', '2'],
      ['a null version', null],
    ])('rejects %s', (_label, schemaVersion) => {
      const storage = new MemoryStorage()
      storeValue(storage, { ...validGame(), schemaVersion })
      expect(loadGame(storage)).toBeNull()
    })
  })

  describe('schema migration', () => {
    it('migrates an explicit schema-v1 game to the current schema', () => {
      const storage = new MemoryStorage()
      const current = validGame()
      const { schemaVersion: _schemaVersion, createdAt: _createdAt, ...v1Fields } = current
      const v1Game = { ...v1Fields, schemaVersion: 1 }
      storeValue(storage, v1Game)

      const loaded = loadGame(storage)

      expect(loaded).toEqual({
        ...v1Game,
        schemaVersion: GAME_SCHEMA_VERSION,
        createdAt: current.updatedAt,
      })
    })

    it('migrates saves from releases that omitted schemaVersion', () => {
      const storage = new MemoryStorage()
      const current = validGame()
      const { schemaVersion: _schemaVersion, createdAt: _createdAt, ...unversionedGame } = current
      storeValue(storage, unversionedGame)

      const loaded = loadGame(storage)

      expect(loaded?.schemaVersion).toBe(GAME_SCHEMA_VERSION)
      expect(loaded?.createdAt).toBe(current.updatedAt)
      expect(loaded?.players).toEqual(current.players)
    })

    it('preserves all entered scores and UI state during migration', () => {
      const storage = new MemoryStorage()
      const current = validGame()
      current.stage = 'results'
      current.activeSection = 'habitats'
      current.activeWildlife = 'fox'
      current.activeHabitat = 'river'
      const { schemaVersion: _schemaVersion, createdAt: _createdAt, ...unversionedGame } = current
      storeValue(storage, unversionedGame)

      expect(loadGame(storage)).toMatchObject({
        stage: 'results',
        activeSection: 'habitats',
        activeWildlife: 'fox',
        activeHabitat: 'river',
        players: current.players,
      })
    })

    it('rejects a malformed legacy game after attempting migration', () => {
      const storage = new MemoryStorage()
      const current = validGame()
      const { schemaVersion: _schemaVersion, createdAt: _createdAt, ...unversionedGame } = current
      storeValue(storage, { ...unversionedGame, updatedAt: 'not-a-date' })

      expect(loadGame(storage)).toBeNull()
    })
  })

  describe('current-schema validation', () => {
    it.each<[string, (game: Record<string, unknown>) => void]>([
      ['an empty game ID', (game) => (game.id = '')],
      ['an invalid creation timestamp', (game) => (game.createdAt = 'yesterday')],
      ['an invalid update timestamp', (game) => (game.updatedAt = 'soon')],
      ['an unknown stage', (game) => (game.stage = 'setup')],
      ['an unknown active section', (game) => (game.activeSection = 'results')],
      ['an unknown active wildlife category', (game) => (game.activeWildlife = 'wolf')],
      ['an unknown active habitat category', (game) => (game.activeHabitat = 'desert')],
      ['fewer than two players', (game) => (game.players = [validGame().players[0]])],
      [
        'more than four players',
        (game) => {
          game.players = [
            ...validGame().players,
            ...createGame(['Linus', 'Margaret', 'Edsger'], now).players,
          ]
        },
      ],
      [
        'duplicate player IDs',
        (game) => {
          const players = game.players as Player[]
          players[1].id = players[0].id
        },
      ],
    ])('rejects a game with %s', (_label, mutate) => {
      const storage = new MemoryStorage()
      const candidate = clone(validGame()) as unknown as Record<string, unknown>
      mutate(candidate)
      storeValue(storage, candidate)

      expect(loadGame(storage)).toBeNull()
    })

    it.each<[string, (player: Record<string, unknown>) => void]>([
      ['an empty ID', (player) => (player.id = '')],
      ['a blank name', (player) => (player.name = '   ')],
      ['missing wildlife scores', (player) => delete player.wildlifeScores],
      [
        'a missing wildlife category',
        (player) => delete (player.wildlifeScores as Record<string, unknown>).hawk,
      ],
      [
        'a negative wildlife score',
        (player) => ((player.wildlifeScores as Record<string, unknown>).bear = -1),
      ],
      [
        'a fractional wildlife score',
        (player) => ((player.wildlifeScores as Record<string, unknown>).elk = 1.5),
      ],
      ['missing habitat corridors', (player) => delete player.habitatCorridors],
      [
        'a missing habitat category',
        (player) => delete (player.habitatCorridors as Record<string, unknown>).wetland,
      ],
      [
        'a negative habitat corridor',
        (player) => ((player.habitatCorridors as Record<string, unknown>).river = -2),
      ],
      ['a negative Nature Token count', (player) => (player.natureTokens = -1)],
      ['a fractional Nature Token count', (player) => (player.natureTokens = 1.5)],
      ['an absent Nature Token count', (player) => delete player.natureTokens],
    ])('rejects a player with %s', (_label, mutate) => {
      const storage = new MemoryStorage()
      const candidate = clone(validGame()) as unknown as Record<string, unknown>
      const player = (candidate.players as Record<string, unknown>[])[0]
      mutate(player)
      storeValue(storage, candidate)

      expect(loadGame(storage)).toBeNull()
    })

    it('accepts zeroes and nulls as intentional score states', () => {
      const storage = new MemoryStorage()
      const game = validGame()
      game.players[0].wildlifeScores.bear = 0
      game.players[0].habitatCorridors.mountain = 0
      game.players[0].natureTokens = 0
      game.players[1].wildlifeScores.bear = null
      game.players[1].habitatCorridors.mountain = null
      game.players[1].natureTokens = null

      saveGame(game, storage)

      expect(loadGame(storage)).toEqual(game)
    })
  })

  describe('domain timestamps', () => {
    it('requires 2 to 4 uniquely named players', () => {
      expect(() => createGame(['Solo'], now)).toThrow()
      expect(() => createGame(['Ada', 'ada'], now)).toThrow()
      expect(() => createGame(['A', 'B', 'C', 'D', 'E'], now)).toThrow()
    })

    it('creates games with the current schema and matching timestamps', () => {
      const game = createGame(['Ada', 'Grace'], now)

      expect(game.schemaVersion).toBe(GAME_SCHEMA_VERSION)
      expect(game.createdAt).toBe(now.toISOString())
      expect(game.updatedAt).toBe(now.toISOString())
    })

    it('touches updatedAt without changing createdAt', () => {
      const game = createGame(['Ada', 'Grace'], now)
      const later = new Date('2026-08-13T09:30:00.000Z')

      touchGame(game, later)

      expect(game.createdAt).toBe(now.toISOString())
      expect(game.updatedAt).toBe(later.toISOString())
    })
  })
})
