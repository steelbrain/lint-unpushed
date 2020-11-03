#!/usr/bin/env node
/* eslint-disable no-await-in-loop */
import os from 'os'
import fs from 'fs'
import path from 'path'

import { CLIError, invokeMain } from './helpers'

async function main() {
  const repositoryRoot = path.join(process.cwd(), '.git')
  try {
    await fs.promises.access(repositoryRoot, fs.constants.R_OK)
  } catch (_) {
    throw new CLIError(
      `Git repository not found at ${repositoryRoot}`,
      'This command (lint-unpushed-install) is only meant to be executed in repository root',
    )
  }

  const hooksDirectory = path.join(repositoryRoot, 'hooks')
  try {
    await fs.promises.access(hooksDirectory)
  } catch (_) {
    try {
      await fs.promises.mkdir(hooksDirectory)
    } catch (__) {
      throw new CLIError(
        `Unable to create or access Git hooks directory at ${hooksDirectory}`,
        'This command needs write access to the directory to install Git hooks',
      )
    }
  }

  const hooksToCopy: [string, string][] = [
    [path.resolve(__dirname, './lint-unpushed-post-checkout.js'), path.join(hooksDirectory, 'post-checkout')],
    [path.resolve(__dirname, './lint-unpushed-pre-push.js'), path.join(hooksDirectory, 'pre-push')],
  ]

  for (let i = 0, { length } = hooksToCopy; i < length; i += 1) {
    const [sourceFile, targetFile] = hooksToCopy[i]
    try {
      await fs.promises.unlink(targetFile)
    } catch (_) {
      // Uninstall whatever was there before
    }
    try {
      await fs.promises.writeFile(targetFile, ['#!/usr/bin/env node', `require('${sourceFile}')`].join(os.EOL))
      await fs.promises.chmod(targetFile, 0x755)
    } catch (err) {
      throw new CLIError(`Unable to create Git hook for ${path.basename(targetFile)}`, err.stack)
    }
  }
}

invokeMain(main)
