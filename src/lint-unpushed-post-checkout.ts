#!/usr/bin/env node

import { spawn } from '@steelbrain/spawn'
import { CLIError, invokeMain } from './helpers'
import getDatabase from './database'

async function getCurrentBranch(): Promise<string | null> {
  const output = await spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'])

  return output.exitCode === 0 ? output.stdout.trim() : null
}

async function main() {
  if (process.argv.length !== 5) {
    throw new CLIError(
      'Invalid invocation of post-checkout hook',
      'This bin (lint-unpushed-post-checkout) is only meant to be used as a git-hook and not be used directly.\n  Usage: lint-unpushed-post-checkout <sourceRef> <targetRef> <branchChanged>',
    )
  }
  const database = await getDatabase(process.cwd())

  const [, , sourceCommit, targetCommit, branchesChanged] = process.argv

  if (branchesChanged !== '1') {
    // No Op
    return
  }
  if (sourceCommit !== targetCommit) {
    // No new branch created
    return
  }
  const currentBranch = await getCurrentBranch()
  if (currentBranch != null) {
    database.setBranchSource(currentBranch, sourceCommit)
    await database.write()
  }
}

invokeMain(main)
