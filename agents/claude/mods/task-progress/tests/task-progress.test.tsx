import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { describeAction } from '../hooks/agents'
import { fitLine } from '../hooks/lines'
import { cleanItem, mentionsRepo, parseRecent, parseRoadmap, pickNote } from '../hooks/project'

const TOOL = 'mcp__task-progress__plan'
const TITLE = 'Migrar auth a JWT'
const START = 1_700_000_000_000
const PANE = 'task-progress'
const ENGINE_OWN = 'engine-own'
const HOME = '/home/me'
const REPO = `${HOME}/projects/shop`
const PROJECTS = '/vault/1. Projects'
const IDLE = ['sin actividad todavía']

const ROADMAP = `# Shop - Roadmap

## Estado
- **Repo:** [owner/shop](https://github.com/owner/shop)

## Roadmap vigente
- [x] **Precios** en la lista de productos
- [ ] Confirmar \`semana\` entre meses
- [ ] Mergear el PR #113
- [ ] Ver [[Shop - Datos|el esquema]]
- [ ] Cargar descuentos
- [ ] Quinto pendiente

## Completado
- [x] Algo viejo
`

const GIT_LOG =
  'Merge pull request #111 from me/feat/menu\x1ffeat(nav): group the menu\n\x1e\n' +
  'fix: keep dates in UTC\x1f\x1e\n' +
  'Merge pull request #109 from me/feat/x\x1f\x1e\n'

type Entry = { name: string; kind: 'file' | 'dir' }
type Pane = { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }

/** The machine beneath the plugin: its commands, the vault's files and the open panes. */
type World = {
  cwd: string
  commands: Record<string, string | null>
  dirs: Record<string, Entry[]>
  files: Record<string, string>
  panes: Pane[]
  opened: string[]
  placesOnOpen: boolean
  /** What another mod draws in the band above the prompt; null leaves the band empty. */
  band: string | null
  toolsRegistered: unknown[]
  commandsRegistered: string[]
}

function shop(): World {
  return {
    cwd: REPO,
    commands: {
      'git rev-parse --path-format=absolute --git-common-dir': `${REPO}/.git\n`,
      'git log -3 --first-parent --format=%s%x1f%b%x1e origin/HEAD': GIT_LOG,
      'vault-write --where': 'vault: /vault\nnote:  2. Areas/Sistema.md\n',
    },
    dirs: {
      [PROJECTS]: [
        { name: 'Shop - Roadmap.md', kind: 'file' },
        { name: 'Shop - Datos.md', kind: 'file' },
        { name: 'Otro Proyecto', kind: 'dir' },
      ],
      [`${PROJECTS}/Otro Proyecto`]: [{ name: 'Otro Proyecto.md', kind: 'file' }],
    },
    files: { [`${PROJECTS}/Shop - Roadmap.md`]: ROADMAP },
    panes: [],
    opened: [],
    placesOnOpen: true,
    band: null,
    toolsRegistered: [],
    commandsRegistered: [],
  }
}

/** Stands for the engine beneath the plugin and hands back the clock the test moves. */
function engineBeneath(on: On, world: World = shop()) {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: 'ran' }))
  on('tool.register', (_, e) => {
    world.toolsRegistered.push(e)

    return { value: { tool: TOOL } }
  })
  on('command.register', (_, e) => {
    world.commandsRegistered.push(e.name)

    return { value: { command: e.name } }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('process.run', (_, e) => {
    const stdout = world.commands[e.argv.join(' ')]

    return {
      value: {
        exitCode: stdout === undefined || stdout === null ? 1 : 0,
        stdout: stdout ?? '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('fs.list', (_, e) => ({
    value: (world.dirs[e.path] ?? []).map(entry => ({
      ...entry,
      size: 0,
      mtimeMs: 0,
      isLink: false,
    })),
  }))
  on('fs.read', (_, e) => {
    const text = world.files[e.path]

    if (text === undefined) {
      throw new Error(`no such file: ${e.path}`)
    }

    return { value: text }
  })
  on('ui.panes', () => ({ value: world.panes }))
  on('ui.open', (_, e) => {
    world.opened.push(e.id)
    world.panes = [
      {
        id: e.id,
        title: e.title ?? e.id,
        isShown: true,
        isFocused: false,
        isPlaced: world.placesOnOpen,
      },
    ]

    return {
      value: world.placesOnOpen
        ? { isPlaced: true as const }
        : { isPlaced: false as const, reason: '110 columns, the terminal has 90' },
    }
  })
  on('ui.close', (_, e) => {
    world.panes = world.panes.filter(pane => pane.id !== e.id)

    return { value: undefined }
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    return <Box key={ENGINE_OWN}>{world.band === null ? [] : [<Text>{world.band}</Text>]}</Box>
  })
  mock.env(on, { HOME })

  return mock.clock(on, { now: START })
}

const stepsWith = (done: number, total = 6) =>
  Array.from({ length: total }, (_, index) => ({
    label: `Paso ${index + 1}`,
    status: index < done ? 'done' : index === done ? 'active' : 'pending',
  }))

const startTurn = ($: Engine, agentId?: string) =>
  $.turn.start({ text: 'go', turnId: 'turn-1', ...(agentId === undefined ? {} : { agentId }) })

const endTurn = ($: Engine, agentId?: string) =>
  $.turn.complete({
    answer: 'done',
    durationMs: 1000,
    isAborted: false,
    turnId: 'turn-1',
    reason: 'answer',
    ...(agentId === undefined ? {} : { agentId }),
  })

const submit = ($: Engine, text: string) =>
  $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

const declare = ($: Engine, done: number, total = 6) =>
  $.tool.call({ tool: TOOL, title: TITLE, steps: stepsWith(done, total) })

const runCommand = ($: Engine, command: string, args = '') =>
  $.command.run({
    command,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })

const startSession = ($: Engine, world: World) =>
  $.session.start({ cwd: world.cwd, surface: 'terminal', isInteractive: true })

/** Starts the session and lets the project load, which happens once the start has ended. */
async function startIn($: Engine, clock: { advance: (ms: number) => Promise<void> }, world: World) {
  await startSession($, world)
  await clock.advance(1)
}

const spawn = ($: Engine, description: string, subagentType: string) =>
  $.agent.spawn({
    tool_use_id: 'toolu_review',
    prompt: 'review',
    description,
    subagentType,
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })

type ToolCall = Parameters<Engine['tool']['call']>[0]

/** A tool call made inside agent `agentId`'s loop, as the engine raises it. */
const agentCall = ($: Engine, agentId: string, call: Record<string, unknown>) =>
  $.tool.call({ ...call, agentId } as unknown as ToolCall)

type Drawing = {
  findAll: (query: { type: string }) => Promise<{ key: string | undefined; text: string }[]>
}

/** Each drawn line as `left | right`, or `left` alone. */
async function rowsOf(ui: Drawing): Promise<string[]> {
  const parts = new Map<string, string>()

  for (const box of await ui.findAll({ type: 'Box' })) {
    if (box.key?.startsWith('line:') === true) {
      parts.set(box.key, box.text)
    }
  }

  const rows: string[] = []

  for (let row = 0; parts.has(`line:${row}`); row += 1) {
    const left = (parts.get(`line:${row}:l`) ?? '').trimEnd()
    const right = parts.get(`line:${row}:r`)
    rows.push(right === undefined ? left : `${left} | ${right}`)
  }

  return rows
}

async function column($: Engine, placement: 'dock' | 'inline' = 'dock', bodyColumns = 40) {
  const ui = await $.ui.mount({
    plugin: 'task-progress',
    surface: 'terminal',
    component: 'Pane',
    requestId: PANE,
    props: {
      title: 'Sesión',
      isFocused: false,
      bodyColumns,
      placement,
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
    viewport: { columns: 200, rows: 50, isFullscreen: true },
  })
  const rows = await rowsOf(ui)
  await ui.unmount()

  return rows
}

/** The band above the prompt: the header's rows, or `beneath: <text>` when it lets it be. */
async function header($: Engine, isFullscreen = false, bodyColumns = 120) {
  const ui = await $.ui.mount({
    plugin: 'task-progress',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking: true,
      maxRows: 6,
      bodyColumns,
      scroll: { offset: 0, bodyRows: 5 },
      view: {},
    },
    viewport: { columns: bodyColumns + 5, rows: 40, isFullscreen },
  })
  const own = await ui.find({ key: ENGINE_OWN })
  const rows = await rowsOf(ui)
  await ui.unmount()

  return own === undefined ? rows : [`beneath: ${own.text}`]
}

// ── The task ──────────────────────────────────────────────────────────────────────────────

test('a running plan shows its title, count, gauge, step, time and time left', async ($, on) => {
  const clock = engineBeneath(on)
  await startTurn($)
  await declare($, 4)
  await clock.advance(134_000)

  expect(await column($)).toEqual([
    'AHORA',
    `◆ ${TITLE} | 4/6`,
    '  ████████⣿⣿⣿⣿ 67%',
    '  Paso 5 · 2m 14s · ~1m',
  ])
})

test('a plan whose steps are all done reads 100% and how long it took', async ($, on) => {
  const clock = engineBeneath(on)
  await startTurn($)
  await declare($, 0)
  await clock.advance(542_000)
  await declare($, 6)
  await clock.advance(60_000)

  expect(await column($)).toEqual([
    'AHORA',
    `✔ ${TITLE} | 6/6`,
    '  ████████████ 100%',
    '  listo en 9m 2s',
  ])
})

test('a turn that ends with steps left says the session needs the person', async ($, on) => {
  engineBeneath(on)
  await startTurn($)
  await declare($, 4)
  await endTurn($)

  expect(await column($)).toEqual([
    'AHORA',
    `▲ ${TITLE} | 4/6`,
    '  ████████⣿⣿⣿⣿ 67%',
    '  te necesita · en pausa',
  ])
})

test('a turn without a plan shows its tool calls and time, never a percent', async ($, on) => {
  const clock = engineBeneath(on)
  await startTurn($)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })
  await clock.advance(41_000)

  expect(await column($)).toEqual(['AHORA', '◇ sin plan de pasos', '  2 herramientas · 41s'])
})

test('sized steps weigh the percent: S, M and L count 1, 2 and 3', async ($, on) => {
  engineBeneath(on)
  await startTurn($)
  await $.tool.call({
    tool: TOOL,
    title: TITLE,
    steps: [
      { label: 'Leer', status: 'done', size: 'S' },
      { label: 'Migrar', status: 'active', size: 'L' },
      { label: 'Probar', status: 'pending' },
    ],
  })

  expect(await column($)).toContain('  ██⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿ 17%')
})

test("the time left shows only once two steps are done, at the plan's own pace", async ($, on) => {
  const clock = engineBeneath(on)
  await startTurn($)
  await declare($, 0)
  await clock.advance(60_000)
  await declare($, 1)

  expect(await column($)).toContain('  Paso 2 · 1m 0s')

  await clock.advance(60_000)
  await declare($, 2)

  // Two of six equal steps took 2 minutes, so four more take about 4.
  expect(await column($)).toContain('  Paso 3 · 2m 0s · ~4m')
})

test('a plan that grows past its first version says by how much', async ($, on) => {
  engineBeneath(on)
  await startTurn($)
  await declare($, 1, 6)
  await declare($, 1, 8)

  expect(await column($)).toContain(`◆ ${TITLE} | 1/8 (+2)`)
})

test('a finished plan leaves with the next prompt, an unfinished one stays', async ($, on) => {
  engineBeneath(on)
  await startTurn($)
  await declare($, 3)
  await endTurn($)
  await submit($, 'sigue')

  expect(await column($)).toContain(`▲ ${TITLE} | 3/6`)

  await startTurn($)
  await declare($, 6)
  await endTurn($)
  await submit($, 'otra cosa')

  expect(await column($)).toEqual(IDLE)
})

test('an empty step list clears the plan', async ($, on) => {
  engineBeneath(on)
  await declare($, 2)
  const cleared = await $.tool.call({ tool: TOOL, title: '', steps: [] })

  expect(cleared.result).toBe('Recorded: 0/0 steps done.')
  expect(await column($)).toEqual(IDLE)
})

test('arguments that are no plan are refused with the reason and change nothing', async ($, on) => {
  engineBeneath(on)
  await declare($, 2)

  const noList = await $.tool.call({ tool: TOOL, title: TITLE, steps: 'three' })
  const badStatus = await $.tool.call({
    tool: TOOL,
    title: TITLE,
    steps: [{ label: 'Leer', status: 'started' }],
  })
  const badSize = await $.tool.call({
    tool: TOOL,
    title: TITLE,
    steps: [{ label: 'Leer', status: 'active', size: 'XL' }],
  })
  const noTitle = await $.tool.call({ tool: TOOL, steps: stepsWith(1) })

  expect(noList.deny).toMatch(/steps must be an array/)
  expect(badStatus.deny).toMatch(/steps\[0\]\.status must be one of pending, active, done/)
  expect(badSize.deny).toMatch(/steps\[0\]\.size must be one of S, M, L/)
  expect(noTitle.deny).toMatch(/title must be a non-empty string/)
  expect(await column($)).toContain(`▲ ${TITLE} | 2/6`)
})

test('a plan a subagent sends is ignored', async ($, on) => {
  engineBeneath(on)
  const ran = await agentCall($, 'a1', { tool: TOOL, title: TITLE, steps: stepsWith(1) })

  expect(ran.result).toBe('Ignored: only the main conversation reports the plan.')
  expect(await column($)).toEqual(IDLE)
})

test('the third tool call of a turn without a plan asks once for one', async ($, on) => {
  engineBeneath(on)
  await startTurn($)
  const bash = () => $.tool.call({ tool: 'Bash', command: 'ls' })
  const results = [await bash(), await bash(), await bash(), await bash()]

  expect(results.map(ran => ran.context?.length ?? 0)).toEqual([0, 0, 1, 0])
  expect(results[2]?.context?.[0]).toMatch(/declare them now with mcp__task-progress__plan/)
})

test('a turn that already has a plan is never asked for one', async ($, on) => {
  engineBeneath(on)
  await startTurn($)
  await declare($, 0)
  const bash = () => $.tool.call({ tool: 'Bash', command: 'ls' })
  const results = [await bash(), await bash(), await bash()]

  expect(results.map(ran => ran.context?.length ?? 0)).toEqual([0, 0, 0])
})

test('the instructions reach only a prompt that offers the tool', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'Hello.', scope: 'shared' }] }))
  const request = {
    model: 'claude-opus-5-5',
    promptModel: 'claude-opus-5-5',
    surfaces: ['terminal'],
    outputStyle: null,
    traits: [],
  } as const

  const offered = await $.prompt.compose({ ...request, tools: ['Bash', TOOL] })
  const withheld = await $.prompt.compose({ ...request, tools: ['Bash'] })

  expect(offered.sections.map(section => section.id)).toEqual([
    'intro',
    'task-progress:instructions',
  ])
  expect(offered.sections[1]?.scope).toBe('session')
  expect(withheld.sections.map(section => section.id)).toEqual(['intro'])
})

test('the session start registers the tool and commands, forgets a stale turn', async ($, on) => {
  const world = shop()
  engineBeneath(on, world)
  await startTurn($)
  await startSession($, world)

  expect(world.toolsRegistered).toHaveLength(1)
  expect(world.toolsRegistered[0]).toMatchObject({ name: 'plan', isDeferred: false })
  expect(world.commandsRegistered).toEqual(['progress', 'columna'])
  expect(await column($)).toEqual(IDLE)
})

test('/progress lists every step with its size, the percent and the growth', async ($, on) => {
  const clock = engineBeneath(on)
  await startTurn($)
  await declare($, 0, 2)
  await $.tool.call({
    tool: TOOL,
    title: TITLE,
    steps: [
      { label: 'Leer', status: 'done', size: 'S' },
      { label: 'Migrar', status: 'active', size: 'L' },
      { label: 'Probar', status: 'pending' },
    ],
  })
  await clock.advance(90_000)

  const shown = await runCommand($, 'progress')

  expect(shown.text).toBe(
    [
      `${TITLE} · 1/3 (+1) · 17% · 1m 30s`,
      'El plan creció de 2 a 3 pasos.',
      '✔ S  Leer',
      '◆ L  Migrar',
      '○ M  Probar',
    ].join('\n'),
  )
})

test('/progress without a plan says so', async ($, on) => {
  engineBeneath(on)

  expect((await runCommand($, 'progress')).text).toBe('Sin plan de pasos en curso.')
})

test('/goal asks Claude for a sized plan, and stopping a goal does not', async ($, on) => {
  engineBeneath(on)
  on('command.run', { command: 'goal' }, () => ({ text: 'Goal set.' }))

  const started = await runCommand($, 'goal', 'all tests pass')
  const stopped = await runCommand($, 'goal', 'clear')

  expect(started.text).toBe('Goal set.')
  expect(started.context?.[0]).toMatch(/A \/goal just started.*sized S, M or L/)
  expect(stopped.context ?? []).toEqual([])
})

// ── The project ───────────────────────────────────────────────────────────────────────────

test('the board shows the roadmap of the project and its last merges', async ($, on) => {
  const world = shop()
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)

  expect(await column($)).toEqual([
    'shop | Shop - Roadmap',
    '',
    'SIGUE | 1/6 hechas',
    '○ Confirmar semana entre meses',
    '○ Mergear el PR #113',
    '○ Ver el esquema',
    '○ Cargar descuentos',
    '',
    'LO ÚLTIMO',
    '✔ #111 group the menu',
    '✔ keep dates in UTC',
    '✔ #109',
  ])
})

test('a worktree of the repository finds the same note', async ($, on) => {
  const world = shop()
  world.cwd = `${HOME}/projects/shop-wt/feat-x`
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)

  expect((await column($))[0]).toBe('shop | Shop - Roadmap')
})

test("a note whose Repo row names the repository is the project's note", async ($, on) => {
  const world = shop()
  const portfolio = `${HOME}/projects/blog`
  world.cwd = portfolio
  world.commands['git rev-parse --path-format=absolute --git-common-dir'] = `${portfolio}/.git`
  world.dirs[PROJECTS] = [
    { name: 'Old Site.md', kind: 'file' },
    { name: 'Blog Personal.md', kind: 'file' },
  ]
  world.files[`${PROJECTS}/Old Site.md`] =
    '| Repo | `~/projects/blog-old` |\n- [ ] No es este\n'
  world.files[`${PROJECTS}/Blog Personal.md`] =
    '| Repo | `~/projects/blog/` · privado |\n' +
    '## Roadmap\n- [x] Hecho\n- [ ] Sí es este\n'
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)

  const rows = await column($)

  expect(rows[0]).toBe('blog | Blog Personal')
  expect(rows).toContain('○ Sí es este')
})

test('an unreachable vault is said in place of the roadmap', async ($, on) => {
  const world = shop()
  world.commands['vault-write --where'] = null
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)

  expect((await column($)).slice(0, 4)).toEqual(['shop', '', 'SIGUE', 'vault no disponible'])
})

test('a project without a note says so', async ($, on) => {
  const world = shop()
  world.dirs[PROJECTS] = [{ name: 'Otro.md', kind: 'file' }]
  world.files[`${PROJECTS}/Otro.md`] = '- [ ] nada\n'
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)

  expect((await column($)).slice(0, 4)).toEqual(['shop', '', 'SIGUE', 'sin nota en el vault'])
})

test('outside a repository the board names the folder and lists no merges', async ($, on) => {
  const world = shop()
  world.cwd = `${HOME}/notes/shop`
  world.commands['git rev-parse --path-format=absolute --git-common-dir'] = null
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)

  const rows = await column($)

  expect(rows[0]).toBe('shop | Shop - Roadmap')
  expect(rows).not.toContain('LO ÚLTIMO')
})

test('the roadmap is read again when a turn ends', async ($, on) => {
  const world = shop()
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)
  const roadmap = `${PROJECTS}/Shop - Roadmap.md`
  world.files[roadmap] = ROADMAP.replace('- [ ] Confirmar', '- [x] Confirmar')
  await startTurn($)
  await endTurn($)
  await clock.advance(1)

  expect(await column($)).toContain('SIGUE | 2/6 hechas')
})

// ── The agents ────────────────────────────────────────────────────────────────────────────

/** Two agents of a review, the second already finished, beside a plan of the main turn. */
async function review($: Engine, on: On, world = shop()) {
  const ids = ['a1', 'a2']
  const clock = engineBeneath(on, world)
  on('agent.spawn', () => ({ model: 'sonnet', agentId: ids.shift() ?? 'a9' }))
  await startTurn($)
  await declare($, 2, 5)
  await spawn($, 'review:bugs', 'Explore')
  await spawn($, 'review:perf', 'general-purpose')
  await agentCall($, 'a1', { tool: 'Read', file_path: `${REPO}/src/cars/page.tsx` })
  await agentCall($, 'a2', { tool: 'Bash', command: 'pnpm test cars\necho done' })
  await clock.advance(30_000)
  await endTurn($, 'a2')

  return clock
}

test('while agents run the column lists each one, its last action and the task', async ($, on) => {
  await review($, on)

  expect(await column($)).toEqual([
    'AGENTES | 1 de 2 listos',
    '██████⣿⣿⣿⣿⣿⣿',
    '',
    '◆ review:bugs | 30s',
    '  Explore · 1 herramienta',
    '  ⎿ Read page.tsx',
    '',
    '✔ review:perf | 30s',
    '  listo · 1 herramienta',
    '',
    `◆ ${TITLE} | 2/5`,
  ])
})

test('the column goes back to the board ten seconds after the last agent ends', async ($, on) => {
  const clock = await review($, on)
  await endTurn($, 'a1')
  await clock.advance(9_000)

  expect((await column($))[0]).toBe('AGENTES | 2 de 2 listos')

  await clock.advance(2_000)

  expect((await column($))[0]).toBe('AHORA')
})

test('finished agents leave with the next prompt, running ones stay', async ($, on) => {
  const clock = await review($, on)
  await submit($, 'sigue')

  expect((await column($))[0]).toBe('AGENTES | 1 de 2 listos')

  await endTurn($, 'a1')
  await submit($, 'otra')
  await clock.advance(1)

  expect((await column($))[0]).toBe('AHORA')
})

test("an agent's own turn does not restart the main turn's clock or count", async ($, on) => {
  const clock = engineBeneath(on)
  await startTurn($)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(41_000)
  await startTurn($, 'a1')

  expect(await column($)).toContain('  1 herramienta · 41s')
})

// ── The header and the column's place ─────────────────────────────────────────────────────

test('a tab with no room for the column shows the task and roadmap header', async ($, on) => {
  const world = shop()
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)
  await startTurn($)
  await declare($, 4)
  await clock.advance(134_000)

  expect(await header($)).toEqual([
    `◆ ${TITLE} ████████⣿⣿⣿⣿ 4/6 | 2m 14s · ~1m`,
    'sigue ○ Confirmar semana entre meses · ○ Mergear el PR #113 | 1/6',
  ])
  expect(world.opened).toEqual([])
})

test('while agents run the header lists them under the task', async ($, on) => {
  await review($, on)

  expect(await header($)).toEqual([
    `◆ ${TITLE} ████▊⣿⣿⣿⣿⣿⣿⣿ 2/5 | 30s · ~1m`,
    'agentes ◆ review:bugs ✔ review:perf | 1 de 2 listos',
  ])
})

test('a narrow header cuts the left part and keeps the right whole', async ($, on) => {
  const world = shop()
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)
  await startTurn($)
  await declare($, 4)
  await clock.advance(134_000)

  const rows = await header($, false, 40)

  expect(rows[0]).toBe(`◆ ${TITLE} ██████… | 2m 14s · ~1m`)
  expect(rows.every(row => row.replace(' | ', ' ').length <= 40)).toBe(true)
})

test('in the fullscreen layout the header opens the column, then steps aside', async ($, on) => {
  const world = shop()
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)
  await startTurn($)
  await declare($, 1)

  await header($, true)

  expect(world.opened).toEqual([PANE])
  expect(await header($, true)).toEqual(['beneath: '])
})

test("another mod's band above the prompt, like a held command, wins", async ($, on) => {
  const world = shop()
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)
  await startTurn($)
  await declare($, 1)
  world.band = '⚠ Blast Radius · rm -rf · Proceed / Cancel'

  expect(await header($)).toEqual(['beneath: ⚠ Blast Radius · rm -rf · Proceed / Cancel'])

  world.band = null

  expect((await header($))[0]).toMatch(/^◆ /)
})

test('a column waiting for a wider terminal leaves the header up', async ($, on) => {
  const world = shop()
  world.placesOnOpen = false
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)

  await header($, true)
  const rows = await header($, true)

  expect(world.opened).toEqual([PANE])
  expect(rows[0]).toBe('sigue ○ Confirmar semana entre meses · ○ Mergear el PR #113 | 1/6')
})

test('/columna closes a shown column for good and opens it again', async ($, on) => {
  const world = shop()
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)
  await header($, true)

  const closed = await runCommand($, 'columna')
  const rows = await header($, true)

  expect(closed.text).toBe('Columna cerrada: el resumen queda arriba del cuadro de texto.')
  expect(world.opened).toEqual([PANE])
  expect(rows[0]).toMatch(/^sigue/)

  const opened = await runCommand($, 'columna')

  expect(opened.text).toBe('Columna abierta.')
  expect(world.opened).toEqual([PANE, PANE])
})

test('/columna on a narrow terminal says why the column waits', async ($, on) => {
  const world = shop()
  world.placesOnOpen = false
  engineBeneath(on, world)

  const ran = await runCommand($, 'columna')

  expect(ran.text).toBe('La columna espera: 110 columns, the terminal has 90')
})

test('a column placed above the prompt draws the two rows of the header', async ($, on) => {
  const world = shop()
  const clock = engineBeneath(on, world)
  await startIn($, clock, world)

  expect(await column($, 'inline', 100)).toEqual([
    'sigue ○ Confirmar semana entre meses · ○ Mergear el PR #113 | 1/6',
  ])
})

// ── The parts ─────────────────────────────────────────────────────────────────────────────

test('the roadmap is the first section with an open item, and plain text', () => {
  expect(parseRoadmap(ROADMAP)).toEqual({
    done: 1,
    total: 6,
    next: [
      'Confirmar semana entre meses',
      'Mergear el PR #113',
      'Ver el esquema',
      'Cargar descuentos',
    ],
  })
  expect(cleanItem('**Pagar** `deuda` en [[Nota|la nota]] y [docs](https://x.y)')).toBe(
    'Pagar deuda en la nota y docs',
  )
})

test('a roadmap with every item done counts them all, and a note without items counts none', () => {
  const allDone = '## A\n- [x] uno\n## B\n- [X] dos\n'

  expect(parseRoadmap(allDone)).toEqual({ done: 2, total: 2, next: [] })
  expect(parseRoadmap('# Nota\nTexto\n')).toEqual({ done: 0, total: 0, next: [] })
})

test('merges read as their pull request and title, other commits as their subject', () => {
  expect(parseRecent(GIT_LOG)).toEqual(['#111 group the menu', 'keep dates in UTC', '#109'])
  expect(parseRecent('')).toEqual([])
})

test('a Repo row matches a whole path, never a longer one that starts the same', () => {
  const row = '| Repo | `~/projects/app/` · privado |'

  expect(mentionsRepo(row, ['~/projects/app'])).toBe(true)
  expect(mentionsRepo('| Repo | `~/projects/app-old` |', ['~/projects/app'])).toBe(false)
  expect(mentionsRepo('Repo: ~/projects/app', ['~/projects/app'])).toBe(false)
})

test("a project's roadmap note comes before its main note and its other notes", () => {
  const note = (title: string, key: string) => ({ path: `/v/${title}.md`, title, key })
  const notes = [note('App - Datos', 'App'), note('App', 'App'), note('App - Roadmap', 'App')]

  expect(pickNote(notes, 'app')?.title).toBe('App - Roadmap')
  expect(pickNote(notes.slice(0, 2), 'APP')?.title).toBe('App')
  expect(pickNote(notes.slice(0, 1), 'app')?.title).toBe('App - Datos')
  expect(pickNote(notes, 'other')).toBeUndefined()
})

test('an action names the tool and what it touched', () => {
  expect(describeAction('Read', { file_path: '/a/b/page.tsx' })).toBe('Read page.tsx')
  expect(describeAction('Bash', { command: 'pnpm test\nmore' })).toBe('Bash pnpm test')
  expect(describeAction('TodoWrite', { todos: [] })).toBe('TodoWrite')
})

test('a line keeps its right part and cuts its left with an ellipsis', () => {
  const line = { left: [{ text: 'abcdef' }, { text: 'ghij' }], right: [{ text: '9s' }] }

  expect(fitLine(line, 8).left.map(seg => seg.text)).toEqual(['abcd…'])
  expect(fitLine(line, 13)).toEqual(line)
})
