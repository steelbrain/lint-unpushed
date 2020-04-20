#!/usr/bin/env node
/* eslint-disable max-classes-per-file */

import fs from 'fs'
import path from 'path'
import Listr from 'listr'
import execa from 'execa'
import readline from 'readline'
import shellEscape from 'shell-escape'
import micromatch from 'micromatch'
import commander from 'commander'
import Observable from 'zen-observable'
import { Stream } from 'stream'
import manifest from '../package.json'

const MANIFEST_KEY = 'lint-unpushed'
const REGEXP_REFERENCE = /^## ([\S+]+)\.\.\.(\S+)($| )/
// eg: ## master...origin/master
// eg: ## master...origin/master [ahead 1]
const LOCAL_PACKAGE = path.join(process.cwd(), 'package.json')

commander.name(MANIFEST_KEY).version(manifest.version).parse(process.argv)

export class CLIWarning extends Error {}
export class CLIError extends Error {
  constructor(message: string, public detail: string) {
    super(message)
  }
}

async function getReferences() {
  try {
    const output = await execa('git', ['status', '-sb', '--porcelain=1'])
    // Test first line against the regexp
    const matches = REGEXP_REFERENCE.exec(output.stdout.slice(0, output.stdout.indexOf('\n')))
    if (matches) {
      return { local: matches[1], remote: matches[2] }
    }
    return null
  } catch (_) {
    return null
  }
}

async function observableExec(command: string) {
  return new Observable((observer) => {
    const chunks: string[] = []
    const proc = execa(command, { shell: true, all: true })
    proc.on('error', (err) => {
      observer.error(err)
    })
    const lineInterface = readline.createInterface({
      input: proc.all!,
      // No-op output
      output: new Stream.Writable(),
      terminal: false,
      historySize: 0,
    })
    lineInterface.on('line', (line) => {
      observer.next(line)
    })
    if (proc.all != null) {
      proc.all.on('data', (chunk) => {
        chunks.push(chunk.toString('utf8'))
      })
    }
    proc.on('exit', (exitCode) => {
      if (exitCode !== 0) {
        observer.error(new CLIError(`Process exited with non-zero code: ${exitCode}`, chunks.join(' ')))
      } else {
        observer.complete()
      }
    })
    // return execa(, { shell: true, all: true }).all as any
  })
}

async function filesInGetRange(from: string, to: string): Promise<string[] | null> {
  try {
    const output = await execa('git', ['diff', `${to}..${from}`, '--name-only', '--diff-filter=d'])
    return output.stdout.split('\n')
  } catch (_) {
    return null
  }
}

// { lint-pushed: {*.js: x} } means the x command gets file paths as parameter
async function runFileScripts(scripts: Record<string, string | string[]>, files: string[]) {
  if (
    !Object.values(scripts).every(
      (item) => typeof item === 'string' || (Array.isArray(item) && item.every((subItem) => typeof subItem === 'string')),
    )
  ) {
    throw new Error(
      `Malformed configuration for '${MANIFEST_KEY}' at ${LOCAL_PACKAGE}. Expected value to be Record<string, string | string[]>`,
    )
  }

  const listr = new Listr(
    Object.entries(scripts).map(([key, value]) => {
      return {
        title: key,
        task(_, task) {
          const filesMatched = micromatch.match(files, key)
          if (!filesMatched.length) {
            task.skip('No matching files')
            return
          }
          const filesCmd = shellEscape(filesMatched)

          if (typeof value === 'string') {
            return observableExec(`${value} ${filesCmd}`)
          }
          return new Listr(
            value.map((item) => ({
              title: item,
              task: () => observableExec(`${item} ${filesCmd}`),
            })),
          )
        },
      }
    }),
  )

  return listr
}

// { lint-pushed: [x, y] } means x and y commands dont get files as parameters
async function runPackageScripts(scripts: string[]) {
  if (!scripts.every((item) => typeof item === 'string')) {
    throw new Error(`Malformed configuration for '${MANIFEST_KEY}' at ${LOCAL_PACKAGE}. Expected value to be Array<string>`)
  }

  const listr = new Listr(
    scripts.map((item) => ({
      title: item,
      task: () => observableExec(item),
    })),
  )

  return listr
}

async function main() {
  const head = await getReferences()
  if (head == null) {
    throw new CLIWarning('Unable to get local/remote refs. Ignoring')
  }
  const relevantFiles = await filesInGetRange(head.local, head.remote)
  if (relevantFiles == null) {
    throw new CLIWarning(`Unable to get changed files between ${head.local}..${head.remote}. Ignoring`)
  }

  if (!fs.existsSync(LOCAL_PACKAGE)) {
    throw new CLIWarning(`Manifest file not found at ${LOCAL_PACKAGE}`)
  }
  let parsed = null
  try {
    parsed = JSON.parse(fs.readFileSync(LOCAL_PACKAGE, 'utf8'))
    if (parsed == null || typeof parsed !== 'object') {
      throw new Error('Manifest value is not an object')
    }
  } catch (_) {
    throw new CLIWarning(`Malformed manifest file at ${LOCAL_PACKAGE}`)
  }

  const manifestValue = parsed[MANIFEST_KEY]

  let task: (() => Promise<Listr>) | null = null
  if (Array.isArray(manifestValue)) {
    task = () => runPackageScripts(manifestValue)
  } else if (manifestValue != null && typeof manifestValue === 'object') {
    task = () => runFileScripts(manifestValue, relevantFiles)
  } else {
    throw new CLIWarning(`Manifest key '${MANIFEST_KEY}' not found in ${LOCAL_PACKAGE}`)
  }

  let stashed = false
  const listr = new Listr(
    [
      {
        title: 'Stash changes',
        async task() {
          try {
            const output = await execa('git', ['stash', '--include-untracked'])
            if (output.stdout !== 'No local changes to save') {
              stashed = true
            }
          } catch (_) {
            // No Op
          }
        },
      },
      {
        title: 'Lint unpushed changes',
        task,
      },
    ],
    {
      // @ts-ignore: Renderer option
      collapse: false,
    },
  )

  try {
    await listr.run()
  } finally {
    await new Listr([
      {
        title: 'Unstash changes',
        async task() {
          if (stashed) {
            await execa('git', ['stash', 'pop'])
          }
        },
      },
    ]).run()
  }
}

main().catch((err) => {
  console.log()
  if (err instanceof CLIWarning) {
    console.error('Warning:', err && err.message)
    process.exit(0)
  }
  if (err instanceof CLIError) {
    console.error('Error:', err.message)
    console.error(err.detail)
    process.exit(1)
  }
  console.error(err && err.stack)
  process.exit(1)
})
