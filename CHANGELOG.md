### 0.5.0

- BREAKING: Node.js v10 is the minimum required version
- BREAKING: `lint-unpushed` bin has been renamed to `lint-unpushed-pre-push`. This change will only
  affect you if you continue to use Husky.
- Add `lint-unpushed-install` bin for `prepare` scripts so you can use this package without Husky present.
  This change was necessary given the unfixed bugs in Husky and the general lack of direction of project
  along with uncertain roadmap.

### 0.4.0

- POTENTIALLY UNSTABLE: Bundle package with rollup to make it compact
- Add `lint-unpushed-post-checkout` bin for your `post-checkout` husky hooks
  This will make sure your tests are run even when there's no reference remote branch yet (useful for new branches).
  Local source branch is used to get files to test against.

### 0.3.0

- BREAKING: Change signature from `string[] | Record<string, string | string[]>` to just `Record<string, string | string[]>` for simplicity.
- BREAKING: You now have to specify `#FILES#` in arguments in lint-unpushed commands.

### 0.2.0

- Unstash changes properly in case of ctrl-c

### 0.1.1

- Try not to lint deleted files
- Try not to unstash when no files have been stashed

### 0.1.0

- Initial release
