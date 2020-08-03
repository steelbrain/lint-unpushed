#!/usr/bin/env node

import { spawn } from '@steelbrain/spawn'
import { CLIError, invokeMain, getDB } from './helpers'

async function getCurrentBranch(): Promise<string | null> {
  const output = await spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'])

  return output.exitCode === 0 ? output.stdout.trim() : null
}

async function main() {
  if (process.argv.length !== 4) {
    throw new CLIError(
      'Invalid invocation of post-checkout hook',
      'This bin (lint-unpushed-post-checkout) is only meant to be used as a git-hook and not be used directly.\n  Usage: lint-unpushed-post-checkout <sourceRef> <targetRef> <branchChanged>',
    )
  }

  const [, sourceCommit, targetCommit, branchesChanged] = process.argv

  if (branchesChanged !== '1') {
    // No Op
    return
  }
  if (sourceCommit !== targetCommit) {
    // No new branch created
    return
  }
  const [db, currentBranch] = await Promise.all([getDB(), getCurrentBranch()])
  await db.set(`db.${currentBranch}`, sourceCommit).write()
}

invokeMain(main)
