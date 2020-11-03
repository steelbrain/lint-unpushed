import fs from 'fs'
import path from 'path'

class Database {
  dbPath: string
  contents: Record<string, string>
  constructor({ dbPath, contents }: { dbPath: string; contents: Record<string, string> }) {
    this.dbPath = dbPath
    this.contents = contents
  }

  setBranchSource(branch: string, source: string): void {
    this.contents[`branchSource#${branch}`] = source
  }

  getBranchSource(branch: string): string | null {
    return this.contents[`branchSource#${branch}`] ?? null
  }

  async write(): Promise<void> {
    await fs.promises.writeFile(this.dbPath, JSON.stringify(this.contents, null, 2))
  }
}

export default async function getDatabase(repositoryRoot: string): Promise<Database> {
  const dbPath = path.join(repositoryRoot, '.git', 'lint-unpushed-state.json')

  let contents = '{}'
  try {
    contents = await fs.promises.readFile(dbPath, 'utf8')
  } catch (_) {
    // No Op
  }

  let parsed = null as null | Record<string, string>
  try {
    parsed = JSON.parse(contents)
  } catch (_) {
    // No Op
  }
  if (typeof parsed !== 'object' || parsed == null) {
    // Initialize the object
    parsed = {}
  }

  return new Database({
    dbPath,
    contents: parsed,
  })
}
