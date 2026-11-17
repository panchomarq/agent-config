import type { ElementTable, EngineInterface, On, RenderNode } from 'claude-code'

import { bandLines, columnLines, fitLine } from './lines'
import type { Line, Seg } from './lines'
import { readDismissed, setDismissed, viewOf } from './state'

export const PANE = 'task-progress'
export const COMMAND = 'columna'

const PANE_TITLE = 'Sesión'
const HEADER_ROWS = 2
const IDLE: Line = { left: [{ text: 'sin actividad todavía', dim: true }] }

type Ui = Pick<ElementTable, 'Box' | 'Text'>

function segText({ Text }: Ui, seg: Seg, key: string) {
  return (
    <Text
      key={key}
      {...(seg.color === undefined ? {} : { color: seg.color })}
      {...(seg.dim === true ? { dimColor: true } : {})}
      {...(seg.bold === true ? { bold: true } : {})}
    >
      {seg.text}
    </Text>
  )
}

/** Each line in one row of `width` cells: its left part from the start, its right at the end. */
export function drawLines(ui: Ui, lines: readonly Line[], width: number) {
  const { Box, Text } = ui
  const shown = lines.length === 0 ? [IDLE] : lines

  return (
    <Box flexDirection="column">
      {shown.map((line, row) => {
        const { left, right } = fitLine(line, width)

        return (
          <Box key={`line:${row}`} justifyContent="space-between">
            <Box key={`line:${row}:l`}>
              {left.length === 0 ? <Text> </Text> : left.map((seg, i) => segText(ui, seg, `${i}`))}
            </Box>
            {right !== undefined && (
              <Box key={`line:${row}:r`}>{right.map((seg, i) => segText(ui, seg, `${i}`))}</Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

/** True when a drawing shows nothing: no text and no control anywhere in it. */
export function isBlank(node: RenderNode | null | undefined): boolean {
  if (node === null || node === undefined) {
    return true
  }

  if (typeof node === 'string') {
    return node.trim() === ''
  }

  if (node.type === 'Box' || node.type === 'Text') {
    return (node.children ?? []).every(isBlank)
  }

  return false
}

async function openColumn($: EngineInterface) {
  return $.ui.open({ id: PANE, title: PANE_TITLE })
}

type Column = { isOpen: boolean; isShown: boolean }

/** Whether the column is open, and whether it is drawn and on show so the header steps aside. */
async function columnOf($: EngineInterface): Promise<Column> {
  const pane = (await $.ui.panes()).find(open => open.id === PANE)

  if (pane === undefined) {
    return { isOpen: false, isShown: false }
  }

  return { isOpen: true, isShown: pane.isPlaced && pane.isShown }
}

export const COLUMN_COMMAND = {
  name: COMMAND,
  description: 'Shows the session column beside the conversation, or hides it',
}

function serveCommand(on: On): void {
  on('command.run', { command: COMMAND }, async $ => {
    if ((await columnOf($)).isShown) {
      await setDismissed($, true)
      await $.ui.close({ id: PANE })
      $.ui.invalidate('ui.render')

      return { text: 'Columna cerrada: el resumen queda arriba del cuadro de texto.' }
    }

    await setDismissed($, false)
    const opened = await openColumn($)
    $.ui.invalidate('ui.render')

    return { text: opened.isPlaced ? 'Columna abierta.' : `La columna espera: ${opened.reason}` }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && e.origin.kind === 'person') {
      await setDismissed($, true)
    }

    return next(e)
  })
}

export function drawColumn(on: On): void {
  serveCommand(on)

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const view = await viewOf($)
    const lines = e.props.placement === 'inline' ? bandLines(view, HEADER_ROWS) : columnLines(view)

    return drawLines($.ui.resolve(e), lines, e.props.bodyColumns)
  })

  // The header: the column's summary in this mod's row of the band above the prompt, wherever
  // the column is not drawn. In the fullscreen layout it also opens the column, which the
  // terminal docks once it is wide enough; the person closing it keeps it closed until /columna.
  // A survey holding the band keeps the row empty.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { isOpen, isShown } = await columnOf($)

    if (!isOpen && e.viewport?.isFullscreen === true && !(await readDismissed($))) {
      void openColumn($).then(
        () => $.ui.invalidate('ui.render'),
        (error: unknown) => $.ui.log(`task-progress: the column did not open: ${String(error)}`),
      )
    }

    if (e.props.hasSurvey || isShown) {
      return next(e)
    }

    const lines = bandLines(await viewOf($), Math.min(HEADER_ROWS, e.props.maxRows))

    return lines.length === 0 ? next(e) : drawLines($.ui.resolve(e), lines, e.props.bodyColumns)
  })

  // The band goes first to another mod's row (a held command with its Proceed and Cancel): the
  // header leaves its own row out while any other row shows something.
  on('ui.render', { component: 'AbovePromptList' }, ($, e, next) => {
    const others = e.props.rows.filter(row => row.plugin !== $.plugin.name)

    if (!others.some(row => !isBlank(row.tree))) {
      return next(e)
    }

    return next({ ...e, props: { ...e.props, rows: others } })
  })
}
