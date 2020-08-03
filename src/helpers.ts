/* eslint-disable max-classes-per-file */

import path from 'path'
import low from 'lowdb'
import FileAsync from 'lowdb/adapters/FileAsync'

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
export async function getDB(): Promise<
  low.LowdbAsync<{
    branchSources: Record<string, string>
  }>
> {
  return low(
    new FileAsync(DB_PATH, {
      defaultValue: {
        branchSources: {},
      },
    }),
  )
}
