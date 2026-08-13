import {
  HABITAT_TYPES,
  WILDLIFE_TYPES,
  type Game,
  type HabitatType,
  type Player,
} from './types'

export type BonusMap = Record<string, number>

export interface PlayerScore {
  playerId: string
  wildlife: number
  corridors: number
  habitatBonuses: number
  natureTokens: number
  total: number
}

export interface RankedScore extends PlayerScore {
  rank: number
  player: Player
}

export interface ScoringProgress {
  wildlife: number
  habitats: number
  tokens: boolean
  complete: number
  total: 11
}

function emptyBonuses(players: Player[]): BonusMap {
  return Object.fromEntries(players.map((player) => [player.id, 0]))
}

/** Official base-game habitat-majority rules for 2–4 players. */
export function calculateHabitatBonuses(
  players: Player[],
  habitat: HabitatType,
): BonusMap {
  const bonuses = emptyBonuses(players)
  if (players.length < 2 || players.some((player) => player.habitatCorridors[habitat] === null)) {
    return bonuses
  }

  const groups = new Map<number, Player[]>()
  for (const player of players) {
    const value = player.habitatCorridors[habitat] as number
    groups.set(value, [...(groups.get(value) ?? []), player])
  }

  const orderedGroups = [...groups.entries()].sort(([a], [b]) => b - a).map(([, tied]) => tied)
  const leaders = orderedGroups[0]

  if (players.length === 2) {
    if (leaders.length === 2) {
      leaders.forEach((player) => (bonuses[player.id] = 1))
    } else {
      bonuses[leaders[0].id] = 2
    }
    return bonuses
  }

  if (leaders.length === 1) {
    bonuses[leaders[0].id] = 3
    const runnersUp = orderedGroups[1] ?? []
    if (runnersUp.length === 1) bonuses[runnersUp[0].id] = 1
  } else if (leaders.length === 2) {
    leaders.forEach((player) => (bonuses[player.id] = 2))
  } else {
    leaders.forEach((player) => (bonuses[player.id] = 1))
  }

  return bonuses
}

export function wildlifeSubtotal(player: Player): number {
  return WILDLIFE_TYPES.reduce((sum, wildlife) => sum + (player.wildlifeScores[wildlife] ?? 0), 0)
}

export function corridorSubtotal(player: Player): number {
  return HABITAT_TYPES.reduce((sum, habitat) => sum + (player.habitatCorridors[habitat] ?? 0), 0)
}

export function allHabitatBonuses(players: Player[]): Record<HabitatType, BonusMap> {
  return Object.fromEntries(
    HABITAT_TYPES.map((habitat) => [habitat, calculateHabitatBonuses(players, habitat)]),
  ) as Record<HabitatType, BonusMap>
}

export function scorePlayer(player: Player, players: Player[]): PlayerScore {
  const bonusesByHabitat = allHabitatBonuses(players)
  const habitatBonuses = HABITAT_TYPES.reduce(
    (sum, habitat) => sum + bonusesByHabitat[habitat][player.id],
    0,
  )
  const wildlife = wildlifeSubtotal(player)
  const corridors = corridorSubtotal(player)
  const natureTokens = player.natureTokens ?? 0

  return {
    playerId: player.id,
    wildlife,
    corridors,
    habitatBonuses,
    natureTokens,
    total: wildlife + corridors + habitatBonuses + natureTokens,
  }
}

export function rankPlayers(players: Player[]): RankedScore[] {
  const order = new Map(players.map((player, index) => [player.id, index]))
  const sorted = players
    .map((player) => ({ player, ...scorePlayer(player, players) }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.natureTokens - a.natureTokens ||
        (order.get(a.playerId) ?? 0) - (order.get(b.playerId) ?? 0),
    )

  const ranked: RankedScore[] = []
  for (const [index, entry] of sorted.entries()) {
    const previous = sorted[index - 1]
    const shared =
      previous &&
      previous.total === entry.total &&
      previous.natureTokens === entry.natureTokens
    ranked.push({ ...entry, rank: shared ? ranked[index - 1].rank : index + 1 })
  }
  return ranked
}

export function isWildlifeComplete(players: Player[], wildlife: (typeof WILDLIFE_TYPES)[number]) {
  return players.length > 0 && players.every((player) => player.wildlifeScores[wildlife] !== null)
}

export function isHabitatComplete(players: Player[], habitat: HabitatType) {
  return players.length > 0 && players.every((player) => player.habitatCorridors[habitat] !== null)
}

export function getScoringProgress(game: Game): ScoringProgress {
  const wildlife = WILDLIFE_TYPES.filter((type) => isWildlifeComplete(game.players, type)).length
  const habitats = HABITAT_TYPES.filter((type) => isHabitatComplete(game.players, type)).length
  const tokens = game.players.length > 0 && game.players.every((player) => player.natureTokens !== null)
  return { wildlife, habitats, tokens, complete: wildlife + habitats + Number(tokens), total: 11 }
}

export function isScoringComplete(game: Game): boolean {
  return getScoringProgress(game).complete === 11
}
