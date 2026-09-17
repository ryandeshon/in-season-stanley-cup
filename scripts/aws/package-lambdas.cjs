// Preserve module boundaries and shared imports; Lambda still uses index.handler.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
for (const name of ['http-api', 'check-game']) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), `isc-${name}-`));
  const output = path.join(root, `${name}.deploy.zip`);
  try {
    const files = ['index.js'];
    fs.writeFileSync(
      path.join(stage, 'index.js'),
      name === 'http-api'
        ? "exports.handler = async (...args) => (await import('./http-api/index.js')).handler(...args);\n"
        : "module.exports = require('./check-game/index.js');\n"
    );
    for (const folder of [name, 'shared']) {
      fs.mkdirSync(path.join(stage, folder));
      for (const file of fs
        .readdirSync(path.join(root, 'lambdas', folder))
        .filter((f) => /\.(js|cjs|json)$/.test(f) && !f.includes('.test.'))) {
        fs.copyFileSync(
          path.join(root, 'lambdas', folder, file),
          path.join(stage, folder, file)
        );
        files.push(`${folder}/${file}`);
      }
    }
    for (const file of files.filter((f) => /\.(js|cjs)$/.test(f))) {
      execFileSync(process.execPath, ['--check', path.join(stage, file)]);
      for (const match of fs
        .readFileSync(path.join(stage, file), 'utf8')
        .matchAll(/(?:from\s+|require\(|import\()['"](\.[^'"]+)['"]/g)) {
        if (
          !files.includes(
            path.relative(
              stage,
              path.resolve(stage, path.dirname(file), match[1])
            )
          )
        )
          throw new Error(`Missing runtime import ${match[1]}`);
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
    console.log(`${name}: verified ${files.length} runtime files`);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}
