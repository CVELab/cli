const { danger, warn, fail } = require('danger');
const fs = require('fs');

const MAX_COMMIT_MESSAGE_LENGTH = 72;

if (danger.github && danger.github.pr) {
  const ghCommits = danger.github.commits;
  for (const { commit } of ghCommits) {
    const { message, url } = commit;
    const [firstLine] = message.split('\n', 1);

    const firstLineRegex = /^(feat|fix|chore|test|docs|refactor|revert)(\(.*\))?:(.+)$/;
    if (!firstLineRegex.test(firstLine)) {
      fail(
        `"[${firstLine}](${url})" is not using a valid commit message format. For commit guidelines, see: [CONTRIBUTING](https://github.com/snyk/snyk/blob/master/CONTRIBUTING.md#creating-commits).`,
      );
    }

    if (firstLine.length >= MAX_COMMIT_MESSAGE_LENGTH) {
      warn(
        `"[${firstLine}](${url})" is too long. Keep the first line of your commit message under ${MAX_COMMIT_MESSAGE_LENGTH} characters.`,
      );
    }
  }

  // Forgotten tests check
  const modifiedTest =
    danger.git.modified_files.some((f) => f.startsWith('test/')) ||
    danger.git.created_files.some((f) => f.startsWith('test/'));
  const modifiedSrc =
    danger.git.modified_files.some((f) => f.startsWith('src/')) ||
    danger.git.created_files.some((f) => f.startsWith('src/'));

  if (modifiedSrc && !modifiedTest) {
    // TODO: let's be careful about wording here. Maybe including Contributing guidelines and project goals document here
    warn(
      "You've modified files in `src/` directory, but haven't updated anything in test folder. Is there something that could be tested?",
    );
  }

  // `.spec.ts` is always used for Jest tests
  // `.test.ts` is normally used for Tap tests and but there are also `.spec.ts` files which are used be Tap tests in test/acceptance.
  // either way, we should warn about new `.test.ts` or `.spec.ts` files being created outside the `/test/jest` folder
  const newTestFiles = danger.git.created_files.filter((f) => {
    const inTestFolder = f.startsWith('test/');
    const isATestFile = f.includes('.test.ts') || f.includes('.spec.ts');
    const inJestFolder = f.startsWith('test/jest/');
    const inFixturesFolder = f.startsWith('test/fixtures/');
    return inTestFolder && isATestFile && !inJestFolder && !inFixturesFolder;
  });

  if (newTestFiles.length) {
    const joinedFileList = newTestFiles.map((f) => '- `' + f + '`').join('\n');
    const msg = `Looks like you added a new Tap test. Consider making it a Jest test instead. See files in \`test/jest/(unit|acceptance)\` for examples. Files found:\n${joinedFileList}`;
    warn(msg);
  }

  // Enforce usage of ES6 modules
  const filesUsingNodeJSImportExport = danger.git.modified_files
    .filter((filePath) => {
      if (filePath.endsWith('.js')) {
        return false;
      }
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return (
        fileContent.includes('module.exports') ||
        fileContent.includes('= require(')
      );
    })
    .map((filePath) => `- \`${filePath}\``)
    .join('\n');

  if (filesUsingNodeJSImportExport) {
    const message =
      "Since the CLI is unifying on a standard and improved tooling, we're starting to migrate old-style `import`s and `export`s to ES6 ones.\nA file you've modified is using either `module.exports` or `require()`. If you can, please update them to ES6 [import syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import) and [export syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export).\n Files found:\n" +
      filesUsingNodeJSImportExport;
    warn(message);
  }

  // Warn if changes to help files are created in snyk/snyk repo instead of snyk/user-docs
  const modifiedHelp = danger.git.modified_files.some((f) =>
    f.startsWith('help/'),
  );
  const createdHelp = danger.git.created_files.some((f) =>
    f.startsWith('help/'),
  );

  if (modifiedHelp || createdHelp) {
    warn(
      'Please make changes to `snyk help` text in [Gitbook](https://docs.snyk.io/snyk-cli/commands). Changes will be automatically synchronised to Snyk CLI as a [scheduled PR](https://github.com/snyk/snyk/actions/workflows/sync-cli-help-to-user-docs.yml).\nFor more information, see: [`help/README.md`](https://github.com/snyk/snyk/tree/master/help/README.md).',
    );
  }
}
