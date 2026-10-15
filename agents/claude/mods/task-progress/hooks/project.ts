import type { EngineInterface } from 'claude-code'

import type { Project } from '../types'

const PROJECTS_FOLDER = '1. Projects'
const NEXT_ITEMS = 4
const RECENT_CHANGES = 3
// Where the merges people see live: the remote's default branch, then the local main, then here.
const HISTORY_REFS = ['origin/HEAD', 'main', 'HEAD']
const ITEM = /^\s*[-*] \[([ xX])\]\s+(.*)$/
const MERGE = /^Merge pull request #(\d+)/
const CONVENTIONAL = /^\w+(\([^)]*\))?!?:\s*/

export const VAULT_UNAVAILABLE = 'vault no disponible'

/** A note of the vault's projects folder; `key` names its project (a folder, or the title). */
export type Note = { path: string; title: string; key: string }

export type Roadmap = { done: number; total: number; next: string[] }

type Item = { isDone: boolean; text: string }

export const normalize = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '')

const lastPart = (path: string): string => path.split('/').filter(Boolean).pop() ?? path

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A roadmap item's first line as plain text: no emphasis, code marks or link syntax. */
export function cleanItem(text: string): string {
  return text
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function itemsOf(lines: readonly string[]): Item[] {
  const items: Item[] = []

  for (const line of lines) {
    const match = ITEM.exec(line)

    if (match !== null) {
      items.push({ isDone: match[1] !== ' ', text: cleanItem(match[2] ?? '') })
    }
  }

  return items
}

/**
 * The roadmap of a note: the checkboxes of its first `## ` section that still has one unchecked,
 * or all of them once every one is checked. Long notes keep finished phases and old sessions
 * below the current one, so the first open section is where the work is.
 */
export function parseRoadmap(text: string): Roadmap {
  const sections: string[][] = [[]]

  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      sections.push([])
    }

    sections[sections.length - 1]?.push(line)
  }

  const bySection = sections.map(itemsOf)
  const open = bySection.find(items => items.some(item => !item.isDone)) ?? bySection.flat()
  const pending = open.filter(item => !item.isDone)

  return {
    done: open.length - pending.length,
    total: open.length,
    next: pending.slice(0, NEXT_ITEMS).map(item => item.text),
  }
}

/**
 * The last changes of `git log --format=%s%x1f%b%x1e`: a merged pull request reads as its number
 * and title, any other commit as its subject, both without the conventional-commit prefix.
 */
export function parseRecent(log: string): string[] {
  const changes: string[] = []

  for (const record of log.split('\x1e')) {
    const [subject = '', body = ''] = record.trim().split('\x1f')
    const merged = MERGE.exec(subject)
    const title = merged === null ? subject : (body.trim().split('\n')[0] ?? '')
    const text = title.replace(CONVENTIONAL, '').trim()

    if (merged !== null) {
      changes.push(text === '' ? `#${merged[1]}` : `#${merged[1]} ${text}`)
    } else if (text !== '') {
      changes.push(text)
    }
  }

  return changes.slice(0, RECENT_CHANGES)
}

/** The project's note: its roadmap note first, then its main note, then any other of its notes. */
export function pickNote(notes: readonly Note[], project: string): Note | undefined {
  const mine = notes.filter(note => normalize(note.key) === normalize(project))

  return (
    mine.find(note => note.title === `${note.key} - Roadmap`) ??
    mine.find(note => note.title === note.key) ??
    [...mine].sort((a, b) => a.title.localeCompare(b.title))[0]
  )
}

/** True when a `| Repo |` row of the note names one of `paths`, as a whole path. */
export function mentionsRepo(text: string, paths: readonly string[]): boolean {
  const rows = text.split('\n').filter(line => /^\|\s*Repo\s*\|/i.test(line))
  const patterns = paths.map(path => new RegExp(`${escapeRegExp(path)}(?![\\w-])`))

  return rows.some(row => patterns.some(pattern => pattern.test(row)))
}

/**
 * A command's output, or null when it failed or could not start. Each caller turns null into
 * what the column shows instead: no repository, or the vault as unavailable.
 */
async function output($: EngineInterface, argv: readonly string[]): Promise<string | null> {
  try {
    const ran = await $.process.run(argv)

    return ran.exitCode === 0 ? ran.stdout.trim() : null
  } catch {
    return null
  }
}

/** The main checkout of the repository the session is in, worktrees included. */
async function repoPath($: EngineInterface): Promise<string | null> {
  const common = await output($, ['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'])

  return common === null ? null : common.replace(/\/\.git\/?$/, '')
}

async function recentChanges($: EngineInterface): Promise<string[]> {
  for (const ref of HISTORY_REFS) {
    const log = await output($, [
      'git',
      'log',
      `-${RECENT_CHANGES}`,
      '--first-parent',
      '--format=%s%x1f%b%x1e',
      ref,
    ])

    if (log !== null) {
      return parseRecent(log)
    }
  }

  return []
}

/** The vault's root as `vault-write --where` reports it, or null where it cannot be reached. */
async function vaultRoot($: EngineInterface): Promise<string | null> {
  const where = await output($, ['vault-write', '--where'])

  return where?.match(/^vault:\s*(.+)$/m)?.[1]?.trim() ?? null
}

async function listNotes($: EngineInterface, root: string): Promise<Note[]> {
  const base = `${root}/${PROJECTS_FOLDER}`
  const notes: Note[] = []

  for (const entry of await $.fs.list(base)) {
    if (entry.kind === 'file' && entry.name.endsWith('.md')) {
      const title = entry.name.slice(0, -3)
      notes.push({ path: `${base}/${entry.name}`, title, key: title.split(' - ')[0] ?? title })
    } else if (entry.kind === 'dir') {
      const folder = `${base}/${entry.name}`
      const inner = await $.fs.list(folder)
      const files = inner.filter(file => file.kind === 'file' && file.name.endsWith('.md'))
      notes.push(
        ...files.map(file => ({
          path: `${folder}/${file.name}`,
          title: file.name.slice(0, -3),
          key: entry.name,
        })),
      )
    }
  }

  return notes
}

/** The project's note by name, else the note whose `| Repo |` row names the repository. */
async function findNote(
  $: EngineInterface,
  notes: readonly Note[],
  project: string,
  paths: readonly string[],
): Promise<Note | undefined> {
  const byName = pickNote(notes, project)

  if (byName !== undefined) {
    return byName
  }

  for (const note of notes.filter(candidate => candidate.title === candidate.key)) {
    if (mentionsRepo(await $.fs.read(note.path), paths)) {
      return pickNote(notes, note.key)
    }
  }

  return undefined
}

async function pathsOf($: EngineInterface, path: string): Promise<string[]> {
  const home = await $.env.get('HOME')

  return home !== undefined && path.startsWith(`${home}/`)
    ? [path, `~${path.slice(home.length)}`]
    : [path]
}

/** What the column shows of the project in `cwd`: its roadmap in the vault and its last merges. */
export async function loadProject($: EngineInterface, cwd: string): Promise<Project> {
  const repo = await repoPath($)
  const path = repo ?? cwd
  const recent = repo === null ? [] : await recentChanges($)
  const base = { name: lastPart(path), note: null, done: 0, total: 0, next: [], recent }
  const root = await vaultRoot($)

  if (root === null) {
    return { ...base, problem: VAULT_UNAVAILABLE }
  }

  try {
    const notes = await listNotes($, root)
    const note = await findNote($, notes, base.name, await pathsOf($, path))

    if (note === undefined) {
      return { ...base, problem: null }
    }

    const roadmap = parseRoadmap(await $.fs.read(note.path))

    return { ...base, note: note.title, ...roadmap, problem: null }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)

    return { ...base, problem: `no se pudo leer el vault: ${reason}` }
  }
}
