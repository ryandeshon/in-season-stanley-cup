// Package the complete runtime module trees; no deployment or AWS calls.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
for (const name of ['http-api', 'check-game']) {
  const source = path.join(root, 'lambdas', name);
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), `isc-${name}-`));
  const output = path.join(root, `${name}.deploy.zip`);
  try {
    const files = fs
      .readdirSync(source)
      .filter(
        (file) => /\.(js|cjs|json)$/.test(file) && !file.includes('.test.')
      );
    for (const file of files) {
      fs.copyFileSync(path.join(source, file), path.join(stage, file));
      if (/\.(js|cjs)$/.test(file)) {
        execFileSync(process.execPath, ['--check', path.join(stage, file)]);
        // Check every relative runtime import is packaged beside its importer.
        const contents = fs.readFileSync(path.join(source, file), 'utf8');
        for (const match of contents.matchAll(
          /(?:from\s+|require\()['"]\.\/([^'"]+)['"]/g
        )) {
          if (!files.includes(match[1]))
            throw new Error(`Missing runtime module: ${match[1]}`);
        }
      }
    }
    fs.rmSync(output, { force: true });
    execFileSync('zip', ['-q', output, ...files], { cwd: stage });
    const packaged = execFileSync('unzip', ['-Z1', output], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n');
    if (packaged.length !== files.length || !packaged.includes('index.js'))
      throw new Error('Invalid Lambda package');
    console.log(`${name}: verified ${files.length} runtime files → ${output}`);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}
