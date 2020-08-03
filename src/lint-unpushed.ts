#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { Stream } from 'stream'
import { spawnSync, exec as execNative } from 'child_process'

import Listr from 'listr'
import readline from 'readline'
import shellEscape from 'shell-escape'
import micromatch from 'micromatch'
import commander from 'commander'
import Observable from 'zen-observable'
import { spawn } from '@steelbrain/spawn'
import { CLIWarning, CLIError, invokeMain, dbRead } from './helpers'
import { version as manifestVersion } from '../package.json'

let stashed = false
const MANIFEST_KEY = 'lint-unpushed'
const REGEXP_REFERENCE = /^## ([\S+]+)\.\.\.(\S+)($| )/
const REGEXP_REFERENCE_LOCAL_ONLY = /^## ([\S+]+)$/
// eg: ## master...origin/master
// eg: ## master...origin/master [ahead 1]
const LOCAL_PACKAGE = path.join(process.cwd(), 'package.json')
const REGEXP_FILES_TOKEN = /#FILES#/g

commander.name(MANIFEST_KEY).version(manifestVersion).parse(process.argv)

async function getReferences() {
  const output = await spawn('git', ['status', '-sb', '--porcelain=1'])
  if (output.exitCode !== 0) {
    return null
  }
  const outputFirstLine = output.stdout.slice(0, output.stdout.indexOf('\n'))

  // Test first line against the regexp
  const matches = REGEXP_REFERENCE.exec(outputFirstLine)
  if (matches) {
    return { local: matches[1], remote: matches[2] }
  }
  const matchesLocalOnly = REGEXP_REFERENCE_LOCAL_ONLY.exec(outputFirstLine)
  if (matchesLocalOnly) {
    return { local: matchesLocalOnly[1], remote: null }
  }

  return null
}

async function observableExec(command: string) {
  return new Observable((observer) => {
    const chunks: string[] = []
    const spawnedProcess = execNative(command, {
      encoding: 'utf8',
    })
    spawnedProcess.stdin?.end()
    readline
      .createInterface({
        input: spawnedProcess.stdout!,
        // No-op output
        output: new Stream.Writable(),
        terminal: false,
        historySize: 0,
      })
      .on('line', (line) => {
        chunks.push(`[stdout] ${line}`)
        observer.next(line)
      })
      .on('error', () => {
        // No Op
      })
    readline
      .createInterface({
        input: spawnedProcess.stderr!,
        // No-op output
        output: new Stream.Writable(),
        terminal: false,
        historySize: 0,
      })
      .on('line', (line) => {
        chunks.push(`[stderr] ${line}`)
        observer.next(line)
      })
      .on('error', () => {
        // No Op
      })
    spawnedProcess.on('error', observer.error)
    spawnedProcess.on('exit', (exitCode) => {
      if (exitCode !== 0 && exitCode !== null) {
        observer.error(new CLIError(`Process exited with non-zero code: ${exitCode}`, chunks.join('\n')))
      } else {
        observer.complete()
      }
    })
  })
}

async function filesInGetRange(from: string, to: string): Promise<string[] | null> {
  const output = await spawn('git', ['diff', `${to}..${from}`, '--name-only', '--diff-filter=d'])
  if (output.exitCode !== 0) {
    return null
  }
  return output.stdout.split('\n')
}

// { lint-pushed: {*.js: x} } means the x command gets file paths as parameter
async function runScripts(scripts: Record<string, string | string[]>, files: string[]) {
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
    Object.entries(scripts).map(([key, value]) => ({
      title: key,
      task(_, task) {
        const filesMatched = micromatch.match(files, key)
        if (!filesMatched.length) {
          task.skip('No matching files')
          return undefined
        }
        const filesCmd = shellEscape(filesMatched)

        if (typeof value === 'string') {
          return observableExec(value.replace(REGEXP_FILES_TOKEN, filesCmd))
        }
        return new Listr(
          value.map((item) => ({
            title: item,
            task: () => observableExec(item.replace(REGEXP_FILES_TOKEN, filesCmd)),
          })),
        )
      },
    })),
  )

  return listr
}

async function main() {
  const head = await getReferences()
  if (head == null) {
    throw new CLIWarning('Unable to get local/remote refs. Ignoring')
  }
  let { remote: headRemote } = head

  if (headRemote == null) {
    console.error('Warning: Local branch not found remotely, comparing against possible local source')
    const possibleLocalSource = await dbRead<string>(`branchSources.${head.local}`)
    if (possibleLocalSource == null) {
      throw new CLIWarning('Unable to get local source for branch. Ignoring')
    }
    headRemote = String(possibleLocalSource)
  }
  const relevantFiles = await filesInGetRange(head.local, headRemote)
  if (relevantFiles == null) {
    throw new CLIWarning(`Unable to get changed files between ${head.local}..${headRemote}. Ignoring`)
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
  if (manifestValue != null && typeof manifestValue === 'object') {
    task = () => runScripts(manifestValue, relevantFiles)
  } else {
    throw new CLIWarning(`Manifest key '${MANIFEST_KEY}' not found in ${LOCAL_PACKAGE}`)
  }

  const listr = new Listr(
    [
      {
        title: 'Stash changes',
        async task() {
          const output = await spawn('git', ['stash', '--include-untracked'])
          if (output.exitCode === 0 && output.stdout !== 'No local changes to save') {
            stashed = true
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
            await spawn('git', ['stash', 'pop'])
          }
        },
      },
    ]).run()
  }
}

process.on('SIGINT', () => {
  if (stashed) {
    try {
      spawnSync('git', ['stash', 'pop'])
    } catch (_) {
      // No op
    }
  }
  // Exit code 130 for when ctrl-c-ed
  process.exit(130)
})

invokeMain(main)
