import { ESLint } from 'eslint';

const eslint = new ESLint({
  overrideConfigFile: './eslint.config.mjs'
});

const results = await eslint.lintFiles(['src/**/*.ts']);
const formatter = await eslint.loadFormatter('stylish');
const resultText = formatter.format(results);

console.log(resultText);
