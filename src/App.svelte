<script lang="ts">
  import { onMount } from 'svelte'
  import { AlertDialog } from 'bits-ui'
  import { registerSW } from 'virtual:pwa-register'
  import {
    HABITAT_LABELS,
    HABITAT_TYPES,
    WILDLIFE_LABELS,
    WILDLIFE_SYMBOLS,
    WILDLIFE_TYPES,
    createGame,
    touchGame,
    type Game,
    type HabitatType,
    type ScoreSection,
    type WildlifeType,
  } from './lib/domain/types'
  import {
    calculateHabitatBonuses,
    getScoringProgress,
    isHabitatComplete,
    isScoringComplete,
    isWildlifeComplete,
    rankPlayers,
    scorePlayer,
  } from './lib/domain/scoring'
  import { clearGame, loadGame, saveGame } from './lib/persistence'

  type AppScreen = 'home' | 'setup' | 'game'

  let game = $state<Game | null>(loadGame())
  let screen = $state<AppScreen>('home')
  let setupNames = $state(['', ''])
  let trayOpen = $state(false)
  let detailPlayerId = $state<string | null>(null)
  let confirmNew = $state(false)
  let updateAvailable = $state(false)
  let offlineReady = $state(false)
  let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined

  onMount(() => {
    updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => (updateAvailable = true),
      onOfflineReady: () => {
        offlineReady = true
        window.setTimeout(() => (offlineReady = false), 3500)
      },
      onRegisterError: () => {
        // A failed update check must never interrupt an active local game.
      },
    })
  })

  function beginNewGame() {
    clearGame()
    game = null
    setupNames = ['', '']
    trayOpen = false
    detailPlayerId = null
    screen = 'setup'
  }

  function requestNewGame() {
    if (game) confirmNew = true
    else beginNewGame()
  }

  function continueGame() {
    screen = 'game'
  }

  function startScoring() {
    const names = setupNames.map((name) => name.trim()).filter(Boolean)
    if (names.length < 2) return
    game = createGame(names)
    saveGame(game)
    screen = 'game'
  }

  function addPlayer() {
    if (setupNames.length < 4) setupNames.push('')
  }

  function removePlayer(index: number) {
    if (setupNames.length > 2) setupNames.splice(index, 1)
  }

  function persist() {
    if (game) {
      touchGame(game)
      saveGame(game)
    }
  }

  function setSection(section: ScoreSection) {
    if (!game) return
    game.activeSection = section
    persist()
  }

  function setWildlife(wildlife: WildlifeType) {
    if (!game) return
    game.activeWildlife = wildlife
    persist()
  }

  function setHabitat(habitat: HabitatType) {
    if (!game) return
    game.activeHabitat = habitat
    persist()
  }

  function parseScore(value: string): number | null {
    if (value.trim() === '') return null
    const number = Number(value)
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : null
  }

  function updateWildlife(playerId: string, value: string) {
    if (!game) return
    const player = game.players.find((candidate) => candidate.id === playerId)
    if (!player) return
    player.wildlifeScores[game.activeWildlife] = parseScore(value)
    persist()
  }

  function updateHabitat(playerId: string, value: string) {
    if (!game) return
    const player = game.players.find((candidate) => candidate.id === playerId)
    if (!player) return
    player.habitatCorridors[game.activeHabitat] = parseScore(value)
    persist()
  }

  function updateTokens(playerId: string, value: string) {
    if (!game) return
    const player = game.players.find((candidate) => candidate.id === playerId)
    if (!player) return
    player.natureTokens = parseScore(value)
    persist()
  }

  function focusNext(event: KeyboardEvent) {
    if (event.key !== 'Enter') return
    const inputs = [...document.querySelectorAll<HTMLInputElement>('[data-score-input]')]
    const current = event.currentTarget as HTMLInputElement
    const next = inputs[inputs.indexOf(current) + 1]
    if (next) {
      event.preventDefault()
      next.focus()
      next.select()
    } else {
      current.blur()
    }
  }

  function showResults() {
    if (!game || !isScoringComplete(game)) return
    game.stage = 'results'
    trayOpen = false
    persist()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function editScores() {
    if (!game) return
    game.stage = 'scoring'
    persist()
  }

  function openBreakdown(playerId: string) {
    detailPlayerId = detailPlayerId === playerId ? null : playerId
  }

  async function applyUpdate() {
    persist()
    await updateServiceWorker?.(true)
  }
</script>

<svelte:head>
  <title>Cascadia Scorekeeper</title>
  <meta
    name="description"
    content="A fast, offline scorekeeper for the Cascadia board game."
  />
  <meta name="theme-color" content="#f5f1e8" />
</svelte:head>

{#if screen === 'home'}
  <main class="landing shell">
    <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
    <p class="eyebrow">Offline scorekeeper</p>
    <h1>Cascadia</h1>
    <p class="hero-copy">Add the scores from your table. We’ll handle habitat bonuses and final standings.</p>

    <div class="home-actions">
      {#if game}
        <button class="primary large" onclick={continueGame}>
          <span>Continue game</span>
          <small>{game.players.length} players · {getScoringProgress(game).complete}/11 scored</small>
        </button>
        <button class="secondary" onclick={requestNewGame}>Start a new game</button>
      {:else}
        <button class="primary large" onclick={beginNewGame}>New game</button>
      {/if}
    </div>

    <p class="local-note"><span aria-hidden="true">●</span> Saved only on this device</p>
  </main>
{:else if screen === 'setup'}
  <main class="setup shell">
    <button class="back-button" aria-label="Back to home" onclick={() => (screen = 'home')}>←</button>
    <p class="eyebrow">New game</p>
    <h1>Who’s playing?</h1>
    <p class="supporting">Add 2–4 players in the order they’re sitting.</p>

    <div class="player-setup-list">
      {#each setupNames as name, index}
        <label class="name-field">
          <span>Player {index + 1}</span>
          <div>
            <input
              type="text"
              maxlength="24"
              placeholder={index === 0 ? 'e.g. Alice' : index === 1 ? 'e.g. Bob' : 'Player name'}
              bind:value={setupNames[index]}
              autocomplete="off"
            />
            {#if setupNames.length > 2}
              <button
                class="remove-player"
                aria-label={`Remove player ${index + 1}`}
                onclick={() => removePlayer(index)}
              >×</button>
            {/if}
          </div>
        </label>
      {/each}
    </div>

    {#if setupNames.length < 4}
      <button class="add-player" onclick={addPlayer}><span>+</span> Add player</button>
    {/if}

    <button
      class="primary start-scoring"
      disabled={setupNames.filter((name) => name.trim()).length < 2}
      onclick={startScoring}
    >Start scoring <span aria-hidden="true">→</span></button>
  </main>
{:else if game && game.stage === 'results'}
  <main class="results shell-wide">
    <div class="result-header">
      <p class="eyebrow">Game complete</p>
      <h1>Final scores</h1>
      <p>{rankPlayers(game.players)[0]?.rank === rankPlayers(game.players)[1]?.rank ? 'Shared victory' : 'A winner emerges'}</p>
    </div>

    <div class="podium-list">
      {#each rankPlayers(game.players) as entry}
        <button class:champion={entry.rank === 1} onclick={() => openBreakdown(entry.playerId)}>
          <span class="result-rank">{entry.rank}</span>
          <span class="result-name">
            <strong>{entry.player.name}</strong>
            <small>{entry.natureTokens} Nature {entry.natureTokens === 1 ? 'Token' : 'Tokens'}</small>
          </span>
          <strong class="result-total">{entry.total}</strong>
        </button>

        {#if detailPlayerId === entry.playerId}
          {@const breakdown = scorePlayer(entry.player, game.players)}
          <div class="result-breakdown">
            <span>Wildlife <strong>{breakdown.wildlife}</strong></span>
            <span>Corridors <strong>{breakdown.corridors}</strong></span>
            <span>Habitat bonuses <strong>{breakdown.habitatBonuses}</strong></span>
            <span>Nature Tokens <strong>{breakdown.natureTokens}</strong></span>
          </div>
        {/if}
      {/each}
    </div>

    <div class="result-actions">
      <button class="primary" onclick={editScores}>Edit scores</button>
      <button class="secondary" onclick={requestNewGame}>New game</button>
    </div>
  </main>
{:else if game}
  {@const progress = getScoringProgress(game)}
  <div class:tray-open={trayOpen} class="scoring-app">
    <header class="app-header shell-wide">
      <button class="wordmark" onclick={() => (screen = 'home')} aria-label="Return to home">
        <span aria-hidden="true">▲</span> Cascadia
      </button>
      <button class="new-game-link" onclick={requestNewGame}>New game</button>
    </header>

    <main class="score-main shell-wide">
      <div class="score-intro">
        <div>
          <p class="eyebrow">Final scoring</p>
          <h1>Score the table</h1>
        </div>
        <span class="progress-pill">{progress.complete} / 11</span>
      </div>

      <nav class="section-tabs" aria-label="Scoring sections">
        <button class:active={game.activeSection === 'wildlife'} onclick={() => setSection('wildlife')}>
          Wildlife <span>{progress.wildlife}/5</span>
        </button>
        <button class:active={game.activeSection === 'habitats'} onclick={() => setSection('habitats')}>
          Habitats <span>{progress.habitats}/5</span>
        </button>
        <button class:active={game.activeSection === 'tokens'} onclick={() => setSection('tokens')}>
          Tokens <span>{progress.tokens ? '✓' : '—'}</span>
        </button>
      </nav>

      {#if game.activeSection === 'wildlife'}
        <section class="score-panel" aria-labelledby="wildlife-heading">
          <div class="category-scroll" aria-label="Wildlife category">
            {#each WILDLIFE_TYPES as wildlife}
              <button
                class:active={game.activeWildlife === wildlife}
                class:complete={isWildlifeComplete(game.players, wildlife)}
                onclick={() => setWildlife(wildlife)}
              >
                <span class="category-symbol" aria-hidden="true">{WILDLIFE_SYMBOLS[wildlife]}</span>
                <span>{WILDLIFE_LABELS[wildlife]}</span>
                {#if isWildlifeComplete(game.players, wildlife)}<b aria-label="Complete">✓</b>{/if}
              </button>
            {/each}
          </div>

          <div class="panel-heading">
            <div>
              <p class="overline">Wildlife score</p>
              <h2 id="wildlife-heading">{WILDLIFE_LABELS[game.activeWildlife]}</h2>
            </div>
            <p>Enter each player’s score from the card.</p>
          </div>

          <div class="score-input-list">
            {#each game.players as player}
              <label class="score-row">
                <span>{player.name}</span>
                <input
                  data-score-input
                  aria-label={`${player.name} ${WILDLIFE_LABELS[game.activeWildlife]} score`}
                  type="number"
                  inputmode="numeric"
                  enterkeyhint="next"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={player.wildlifeScores[game.activeWildlife] ?? ''}
                  oninput={(event) => updateWildlife(player.id, event.currentTarget.value)}
                  onkeydown={focusNext}
                />
              </label>
            {/each}
          </div>
        </section>
      {:else if game.activeSection === 'habitats'}
        {@const activeBonuses = calculateHabitatBonuses(game.players, game.activeHabitat)}
        <section class="score-panel" aria-labelledby="habitat-heading">
          <div class="category-scroll habitats" aria-label="Habitat category">
            {#each HABITAT_TYPES as habitat}
              <button
                class:active={game.activeHabitat === habitat}
                class:complete={isHabitatComplete(game.players, habitat)}
                onclick={() => setHabitat(habitat)}
              >
                <span>{HABITAT_LABELS[habitat]}</span>
                {#if isHabitatComplete(game.players, habitat)}<b aria-label="Complete">✓</b>{/if}
              </button>
            {/each}
          </div>

          <div class="panel-heading">
            <div>
              <p class="overline">Largest corridor</p>
              <h2 id="habitat-heading">{HABITAT_LABELS[game.activeHabitat]}</h2>
            </div>
            <p>Enter the largest connected group. Bonuses update automatically.</p>
          </div>

          <div class="habitat-labels" aria-hidden="true"><span>Player</span><span>Group</span><span>Bonus</span></div>
          <div class="score-input-list habitat-list">
            {#each game.players as player}
              <label class="score-row habitat-row">
                <span>{player.name}</span>
                <input
                  data-score-input
                  aria-label={`${player.name} ${HABITAT_LABELS[game.activeHabitat]} largest group`}
                  type="number"
                  inputmode="numeric"
                  enterkeyhint="next"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={player.habitatCorridors[game.activeHabitat] ?? ''}
                  oninput={(event) => updateHabitat(player.id, event.currentTarget.value)}
                  onkeydown={focusNext}
                />
                <strong class:has-bonus={activeBonuses[player.id] > 0}>+{activeBonuses[player.id]}</strong>
              </label>
            {/each}
          </div>
        </section>
      {:else}
        <section class="score-panel tokens-panel" aria-labelledby="tokens-heading">
          <div class="token-icon" aria-hidden="true">✦</div>
          <div class="panel-heading">
            <div>
              <p class="overline">One point each</p>
              <h2 id="tokens-heading">Nature Tokens</h2>
            </div>
            <p>Enter each player’s unused tokens. They also break final-score ties.</p>
          </div>

          <div class="score-input-list">
            {#each game.players as player}
              <label class="score-row">
                <span>{player.name}</span>
                <input
                  data-score-input
                  aria-label={`${player.name} unused Nature Tokens`}
                  type="number"
                  inputmode="numeric"
                  enterkeyhint="next"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={player.natureTokens ?? ''}
                  oninput={(event) => updateTokens(player.id, event.currentTarget.value)}
                  onkeydown={focusNext}
                />
              </label>
            {/each}
          </div>
        </section>
      {/if}
    </main>

    <aside class:expanded={trayOpen} class="score-tray" aria-label="Live scores">
      <button class="tray-summary" onclick={() => (trayOpen = !trayOpen)} aria-expanded={trayOpen}>
        <span class="tray-handle" aria-hidden="true"></span>
        <span class="live-label">Live scores</span>
        <span class="mini-scores">
          {#each game.players as player}
            <span><small>{player.name}</small><strong>{scorePlayer(player, game.players).total}</strong></span>
          {/each}
        </span>
        <span class="tray-chevron" aria-hidden="true">{trayOpen ? '↓' : '↑'}</span>
      </button>

      {#if trayOpen}
        <div class="tray-content">
          <div class="standings-title">
            <div><p class="overline">Live totals</p><h2>Current standings</h2></div>
            <span>{progress.complete}/11 complete</span>
          </div>

          <div class="standings-list">
            {#each rankPlayers(game.players) as entry}
              <button onclick={() => openBreakdown(entry.playerId)} aria-expanded={detailPlayerId === entry.playerId}>
                <span class="rank">{entry.rank}</span>
                <span class="standing-name">{entry.player.name}</span>
                <strong>{entry.total}</strong>
                <span aria-hidden="true">›</span>
              </button>

              {#if detailPlayerId === entry.playerId}
                <div class="score-breakdown">
                  <div><span>Wildlife</span><strong>{entry.wildlife}</strong></div>
                  {#each WILDLIFE_TYPES as wildlife}
                    <small><span>{WILDLIFE_LABELS[wildlife]}</span><span>{entry.player.wildlifeScores[wildlife] ?? '—'}</span></small>
                  {/each}
                  <div><span>Corridors</span><strong>{entry.corridors}</strong></div>
                  {#each HABITAT_TYPES as habitat}
                    <small><span>{HABITAT_LABELS[habitat]}</span><span>{entry.player.habitatCorridors[habitat] ?? '—'}</span></small>
                  {/each}
                  <div><span>Habitat bonuses</span><strong>{entry.habitatBonuses}</strong></div>
                  <div><span>Nature Tokens</span><strong>{entry.natureTokens}</strong></div>
                  <div class="breakdown-total"><span>Total</span><strong>{entry.total}</strong></div>
                </div>
              {/if}
            {/each}
          </div>

          <div class="progress-grid">
            <span>Wildlife <strong>{progress.wildlife}/5</strong></span>
            <span>Habitats <strong>{progress.habitats}/5</strong></span>
            <span>Tokens <strong>{progress.tokens ? '✓' : '—'}</strong></span>
          </div>

          <button class="primary results-button" disabled={!isScoringComplete(game)} onclick={showResults}>
            {isScoringComplete(game) ? 'View final results' : `${11 - progress.complete} categories remaining`}
          </button>
        </div>
      {/if}
    </aside>
  </div>
{/if}

<AlertDialog.Root bind:open={confirmNew}>
  <AlertDialog.Portal>
    <AlertDialog.Overlay class="dialog-overlay" />
    <AlertDialog.Content class="confirm-dialog">
      <AlertDialog.Title>Start a new game?</AlertDialog.Title>
      <AlertDialog.Description>
        This clears the current game and its scores from this device.
      </AlertDialog.Description>
      <div class="dialog-actions">
        <AlertDialog.Cancel class="secondary">Keep this game</AlertDialog.Cancel>
        <AlertDialog.Action class="danger" onclick={beginNewGame}>Clear & start new</AlertDialog.Action>
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>

{#if updateAvailable}
  <div class="update-toast" role="status">
    <span>A new version is available.</span>
    <button onclick={applyUpdate}>Update</button>
  </div>
{:else if offlineReady}
  <div class="update-toast" role="status"><span>Ready to use offline.</span></div>
{/if}
