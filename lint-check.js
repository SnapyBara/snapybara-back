const { ESLint } = require('eslint');

async function main() {
  // Create an instance of ESLint with the configuration passed to the function
  const eslint = new ESLint({ 
    configType: 'flat',
    overrideConfigFile: './eslint.config.mjs'
  });

  // Lint files. This doesn't modify target files.
  const results = await eslint.lintFiles(['src/**/*.ts']);

  // Modify the files with the fixed code.
  // await ESLint.outputFixes(results);

  // Format the results into a string (it is also possible to use ESLint.formatters).
  const formatter = await eslint.loadFormatter('stylish');
  const resultText = formatter.format(results);

  // Output the formatted results to console
  console.log(resultText);
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error);
});
