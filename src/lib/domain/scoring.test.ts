import { describe, expect, it } from 'vitest'
import {
  calculateHabitatBonuses,
  rankPlayers,
  scorePlayer,
  wildlifeSubtotal,
} from './scoring'
import { createPlayer, type Player } from './types'

function playersWithCorridors(values: number[]): Player[] {
  return values.map((value, index) => {
    const player = createPlayer(`Player ${index + 1}`)
    player.habitatCorridors.mountain = value
    return player
  })
}

function bonuses(values: number[]) {
  const players = playersWithCorridors(values)
  const result = calculateHabitatBonuses(players, 'mountain')
  return players.map((player) => result[player.id])
}

describe('wildlife scoring', () => {
  it('sums entered wildlife scores without treating missing values as entered', () => {
    const player = createPlayer('Alice')
    player.wildlifeScores.bear = 18
    player.wildlifeScores.elk = 12
    expect(wildlifeSubtotal(player)).toBe(30)
    expect(player.wildlifeScores.salmon).toBeNull()
  })
})

describe('habitat majority bonuses', () => {
  it('awards +2 to the winner in a 2-player game', () => {
    expect(bonuses([7, 5])).toEqual([2, 0])
  })

  it('awards +1 each for a 2-player tie', () => {
    expect(bonuses([7, 7])).toEqual([1, 1])
  })

  it('awards +3 to first and +1 to a unique second', () => {
    expect(bonuses([7, 6, 5])).toEqual([3, 1, 0])
    expect(bonuses([8, 7, 6, 5])).toEqual([3, 1, 0, 0])
  })

  it('awards +2 each for an exact two-way tie for first', () => {
    expect(bonuses([7, 7, 5])).toEqual([2, 2, 0])
  })

  it('awards +1 each for a three- or four-way tie for first', () => {
    expect(bonuses([7, 7, 7])).toEqual([1, 1, 1])
    expect(bonuses([7, 7, 7, 7])).toEqual([1, 1, 1, 1])
  })

  it('does not award a second-place bonus when second is tied', () => {
    expect(bonuses([8, 6, 6, 4])).toEqual([3, 0, 0, 0])
  })

  it('recalculates every bonus when a value changes', () => {
    const players = playersWithCorridors([7, 5, 6])
    expect(players.map((player) => calculateHabitatBonuses(players, 'mountain')[player.id])).toEqual([
      3, 0, 1,
    ])
    players[2].habitatCorridors.mountain = 7
    expect(players.map((player) => calculateHabitatBonuses(players, 'mountain')[player.id])).toEqual([
      2, 0, 2,
    ])
  })

  it('waits for every player before awarding a majority bonus', () => {
    const players = playersWithCorridors([7, 5])
    players[1].habitatCorridors.mountain = null
    expect(calculateHabitatBonuses(players, 'mountain')).toEqual({
      [players[0].id]: 0,
      [players[1].id]: 0,
    })
  })

  it('adds corridors, bonuses, and tokens to the total', () => {
    const players = playersWithCorridors([7, 5])
    players[0].natureTokens = 2
    expect(scorePlayer(players[0], players)).toMatchObject({
      corridors: 7,
      habitatBonuses: 2,
      natureTokens: 2,
      total: 11,
    })
  })
})

describe('final ranking', () => {
  function scoredPlayer(name: string, score: number, tokens: number) {
    const player = createPlayer(name)
    player.wildlifeScores.bear = score - tokens
    player.natureTokens = tokens
    return player
  }

  it('ranks higher final scores first', () => {
    const ranked = rankPlayers([scoredPlayer('Bob', 80, 0), scoredPlayer('Alice', 90, 0)])
    expect(ranked.map((entry) => entry.player.name)).toEqual(['Alice', 'Bob'])
  })

  it('uses Nature Tokens as the first tie-breaker', () => {
    const ranked = rankPlayers([scoredPlayer('Bob', 90, 1), scoredPlayer('Alice', 90, 3)])
    expect(ranked.map((entry) => entry.player.name)).toEqual(['Alice', 'Bob'])
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2])
  })

  it('preserves shared positions when score and tokens are both tied', () => {
    const ranked = rankPlayers([
      scoredPlayer('Alice', 90, 2),
      scoredPlayer('Bob', 90, 2),
      scoredPlayer('Charlie', 80, 0),
    ])
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1, 3])
  })
})
