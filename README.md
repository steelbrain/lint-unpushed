# Lint Unpushed

Lint Unpushed will make sure your code passes relevant tests before `git push`. Best used with [husky][].

### Installation

```
npm install --save-dev lint-unpushed
# OR
yarn add --dev lint-unpushed
```

### Configuration

Example config to tell Husky to invoke `lint-unpushed`, and run Prettier on JS/JSON files


```json5
// package.json:
{
  "husky": {
    "hooks": {
      "pre-push": "lint-unpushed"
    }
  },
  "lint-unpushed": {
    "**/*.{js,json}": "prettier --list-different #FILES#",
    // ^ #FILES# is replaced with the list of files at runtime
    "**/*.{ts,tsx}": [
      "prettier --list-different #FILES#",
      "eslint #FILES#",
      "tsc"
    ]
    // ^ You can also specify an array
    // Notice how tsc doesn't have #FILES#? It lints the entire project!
  }
}
```

Accepted values in `lint-unpushed` is `Record<string, string|string[]>`. You can place `#FILES#` anywhere, as many times as you want inside the command string. It'll be replaced with paths of files changed when the command is executed.

#### License

This project is licensed under the terms of MIT License. See the License file for more info.

[husky]:https://github.com/typicode/husky
