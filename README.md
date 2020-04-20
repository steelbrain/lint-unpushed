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


```json
// package.json:
{
  "husky": {
    "hooks": {
      "pre-push": "lint-unpushed"
    }
  },
  "lint-unpushed": {
    "**/*.{js,json}": [
      "prettier --list-different"
    ]
  }
}
```

Accepted values in `lint-unpushed` are `string[]` (which do NOT get inidividual changed files as arguments) and `Record<string, string|string[]>` (which DO get individual changed files as arguments).

#### License

This project is licensed under the terms of MIT License. See the License file for more info.

[husky]:https://github.com/typicode/husky
