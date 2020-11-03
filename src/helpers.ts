/* eslint-disable max-classes-per-file */

export class CLIWarning extends Error {}

export class CLIError extends Error {
  constructor(message: string, public detail: string) {
    super(message)
  }
}

const NO_VERIFY_HINT = `To skip this action, run the git command with --no-verify`

export function invokeMain(
  callback: () => Promise<void>,
  {
    showNoVerifyHint = false,
  }: {
    showNoVerifyHint?: boolean
  } = {},
): void {
  callback().catch((err) => {
    console.log()
    if (err instanceof CLIWarning) {
      console.error('Warning:', err.message)
      if (showNoVerifyHint) {
        console.log(NO_VERIFY_HINT)
      }
      process.exit(0)
    }
    if (err instanceof CLIError) {
      console.error('Error:', err.message)
      console.error(err.detail)
      if (showNoVerifyHint) {
        console.log(NO_VERIFY_HINT)
      }
      process.exit(1)
    }
    console.error(err && err.stack)
    process.exit(1)
  })
}
