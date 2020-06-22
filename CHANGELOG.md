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
