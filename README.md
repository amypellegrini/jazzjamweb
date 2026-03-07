# Jazz Jam Web

This is the web site for Jazz Jam Studio.

## Development

```bash
npm install
npm run start
```

## Pre-commit hooks

This project uses [Husky](https://typicode.github.io/husky/) to run the test suite before each commit. Hooks are installed automatically via the `prepare` script when you run `npm install`.

If tests fail, the commit will be aborted.

## Deployment

```bash
npm run build
```
