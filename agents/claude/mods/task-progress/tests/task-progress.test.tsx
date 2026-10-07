import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const TOOL = 'mcp__task-progress__plan'
const TITLE = 'Migrar auth a JWT'
const START = 1_700_000_000_000
const WIDE = { columns: 150, rows: 40 }
const NARROW = { columns: 80, rows: 40 }
const ENGINE_OWN = 'engine-own'

const stepsWith = (done: number, total = 6) =>
  Array.from({ length: total }, (_, index) => ({
    label: `Paso ${index + 1}`,
    status: index < done ? 'done' : index === done ? 'active' : 'pending',
  }))

/** Stands for the engine beneath the plugin and hands back the clock the test moves. */
function engineBeneath(on: On) {
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: 'ran' }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box key={ENGINE_OWN}>
        <Text>{e.props.modes.join(' & ')}</Text>
      </Box>
    )
  })

  return mock.clock(on, { now: START })
}

const startTurn = ($: Engine) => $.turn.start({ text: 'go', turnId: 'turn-1' })

const endTurn = ($: Engine) =>
  $.turn.complete({
    answer: 'done',
    durationMs: 1000,
    isAborted: false,
    turnId: 'turn-1',
    reason: 'answer',
  })

const submit = ($: Engine, text: string) =>
  $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

const declare = ($: Engine, done: number, total = 6) =>
  $.tool.call({ tool: TOOL, title: TITLE, steps: stepsWith(done, total) })

const mountFooter = ($: Engine, viewport = WIDE, modes: readonly string[] = []) =>
  $.ui.mount({
    plugin: 'task-progress',
    surface: 'terminal',
    component: 'SessionMode',
    props: { modes },
    viewport,
  })

async function textsOf($: Engine, viewport = WIDE, modes: readonly string[] = []) {
  const ui = await mountFooter($, viewport, modes)
  const texts = (await ui.findAll({ type: 'Text' })).map(found => found.text)
  await ui.unmount()

  return texts
}

/** What the footer reads when the plugin passes: the engine's own labels, or undefined. */
async function engineOwnText($: Engine, modes: readonly string[] = []) {
  const ui = await mountFooter($, WIDE, modes)
  const own = await ui.find({ key: ENGINE_OWN })
  await ui.unmount()

  return own?.text
}

test('a running plan shows its title, percent, gauge and active step', async ($, on) => {
  const clock = engineBeneath(on)
  await startTurn($)
  await declare($, 4)
  await clock.advance(134_000)

  const texts = await textsOf($)

  expect(texts).toContain(TITLE)
  expect(texts).toContain(' ◆')
  expect(texts).toContain('████████')
  expect(texts).toContain('⣿⣿⣿⣿')
  expect(texts).toContain(' 67%')
  expect(texts).toContain('4/6 · Paso 5 · 2m 14s')
})

test('a narrow terminal drops the step label and shortens the title', async ($, on) => {
  const clock = engineBeneath(on)
  await startTurn($)
  await declare($, 4)
  await clock.advance(134_000)

  const texts = await textsOf($, NARROW)

  expect(texts).toContain('Migrar auth a …')
  expect(texts).toContain('4/6 · 2m 14s')
  expect(texts).toContain(' 67%')
})

test('a plan whose steps are all done reads 100% and how long it took', async ($, on) => {
  const clock = engineBeneath(on)
  await startTurn($)
  await declare($, 0)
  await clock.advance(542_000)
  await declare($, 6)
  await clock.advance(60_000)

  const texts = await textsOf($)

  expect(texts).toContain(' ✔')
  expect(texts).toContain(' 100%')
  expect(texts).toContain('████████████')
  expect(texts).toContain('6/6 · listo en 9m 2s')
})

test('a plan with one step left of thirty stays under 100%', async ($, on) => {
  engineBeneath(on)
  await startTurn($)
  await declare($, 29, 30)

  expect(await textsOf($)).toContain(' 97%')
})

test('a turn that ends with steps left says the session needs the person', async ($, on) => {
  engineBeneath(on)
  await startTurn($)
  await declare($, 4)
  await endTurn($)

  const texts = await textsOf($)

  expect(texts).toContain(' ▲')
  expect(texts).toContain('te necesita · en pausa (4/6)')
})

test('a turn without a plan shows its tool calls and time, never a percent', async ($, on) => {
  const clock = engineBeneath(on)
  await startTurn($)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })
  await clock.advance(41_000)

  const texts = await textsOf($)

  expect(texts).toContain('sin plan de pasos')
  expect(texts).toContain(' —%')
  expect(texts).toContain('2 tools · 41s')
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

test('the engine draws its own mode labels while there is nothing to show', async ($, on) => {
  engineBeneath(on)

  expect(await engineOwnText($, ['focus'])).toBe('focus')
})

test('the mode labels the engine shows are kept under the block', async ($, on) => {
  engineBeneath(on)
  await startTurn($)
  await declare($, 1)

  expect(await textsOf($, WIDE, ['focus', 'memory paused'])).toContain('focus & memory paused')
})

test('a finished plan leaves with the next prompt, an unfinished one stays', async ($, on) => {
  engineBeneath(on)
  await startTurn($)
  await declare($, 3)
  await endTurn($)
  await submit($, 'sigue')

  expect(await textsOf($)).toContain(TITLE)

  await startTurn($)
  await declare($, 6)
  await endTurn($)
  await submit($, 'otra cosa')

  expect(await engineOwnText($)).toBe('')
})

test('an empty step list clears the plan', async ($, on) => {
  engineBeneath(on)
  await declare($, 2)
  const cleared = await $.tool.call({ tool: TOOL, title: '', steps: [] })

  expect(cleared.result).toBe('Recorded: 0/0 steps done.')
  expect(await engineOwnText($)).toBe('')
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
  const noTitle = await $.tool.call({ tool: TOOL, steps: stepsWith(1) })

  expect(noList.deny).toMatch(/steps must be an array/)
  expect(badStatus.deny).toMatch(/steps\[0\]\.status must be one of pending, active, done/)
  expect(noTitle.deny).toMatch(/title must be a non-empty string/)
  expect(await textsOf($)).toContain('te necesita · en pausa (2/6)')
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

test('the session start registers the tool and forgets a stale turn', async ($, on) => {
  engineBeneath(on)
  const registered: unknown[] = []
  on('tool.register', (_, e) => {
    registered.push(e)

    return { value: { tool: TOOL } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await startTurn($)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  expect(registered).toHaveLength(1)
  expect(registered[0]).toMatchObject({ name: 'plan', isDeferred: false })
  expect(await engineOwnText($)).toBe('')
})
