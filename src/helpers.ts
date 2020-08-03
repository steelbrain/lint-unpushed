/* eslint-disable max-classes-per-file */

import fs from 'fs'
import path from 'path'
import get from 'lodash/get'
import set from 'lodash/set'

export class CLIWarning extends Error {}

export class CLIError extends Error {
  constructor(message: string, public detail: string) {
    super(message)
  }
}

export function invokeMain(callback: () => Promise<void>): void {
  callback().catch((err) => {
    console.log()
    if (err instanceof CLIWarning) {
      console.error('Warning:', err.message)
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
}

const DB_PATH = path.join(process.cwd(), '.git', 'lint-unpushed-state.json')
const DB_DEFAULT = { branchSources: {} }
function getDBContents(): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    fs.readFile(DB_PATH, 'utf8', function (err, res) {
      if (err) {
        resolve(DB_DEFAULT)
        return
      }
      let parsed = DB_DEFAULT
      try {
        parsed = JSON.parse(res)
      } catch (e) {
        // No Op
      }
      resolve(parsed)
    })
  })
}
function setDBContents(contents): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(DB_PATH, JSON.stringify(contents, null, 2), (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

export async function dbRead<T>(key: string): Promise<T | null> {
  const db = await getDBContents()
  return get(db, key)
}

export async function dbWrite(key: string, value: any): Promise<void> {
  const db = await getDBContents()
  set(db, key, value)
  await setDBContents(db)
}
