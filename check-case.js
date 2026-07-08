// check-case.js
// Détecte les require('./...') dont la casse ne correspond pas EXACTEMENT
// au nom réel tel qu'il est SUIVI PAR GIT (donc tel qu'il sera sur GitHub/Render),
// et pas seulement tel qu'il apparaît sur le disque local.
//
// Pourquoi ça change tout : sur Windows/Mac, le système de fichiers est
// insensible à la casse, donc Git peut "oublier" un changement de casse
// (ex: UserService.js -> userService.js) et GitHub garde l'ancienne casse
// même si ton disque local est à jour. Un check basé sur fs.readdirSync ne
// verra jamais ce décalage. Celui-ci le voit, car il interroge Git directement.
//
// Utilisation :
//   node check-case.js          -> détecte les problèmes
//   node check-case.js --fix    -> corrige automatiquement (renomme via git mv)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const fixMode = process.argv.includes('--fix');
const extsToTry = ['.js', '.json', '.jsx', '.ts', '/index.js'];

function gitTrackedFiles() {
  const out = execSync('git ls-files', { cwd: root, encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function walkLocalJsFiles() {
  const ignoreDirs = new Set(['node_modules', '.git', 'uploads', 'images']);
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignoreDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  })(root);
  return files;
}

const tracked = gitTrackedFiles();
// map: chemin en minuscules -> chemin réel tel que Git le connaît
const trackedLower = new Map(tracked.map((f) => [f.toLowerCase(), f]));

const requireRegex = /require\(\s*['"](\.[^'"]+)['"]\s*\)/g;
let problems = 0;
const fixes = [];

for (const file of walkLocalJsFiles()) {
  const relFile = path.relative(root, file);
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = requireRegex.exec(content))) {
    const reqPath = match[1];
    const resolvedNoExt = path.relative(root, path.resolve(path.dirname(file), reqPath));

    for (const suffix of ['', ...extsToTry]) {
      const candidate = (resolvedNoExt + suffix).split(path.sep).join('/');
      const real = trackedLower.get(candidate.toLowerCase());
      if (real && real !== candidate) {
        console.log(
          `❌ Casse différente (détecté via Git)\n   Fichier      : ${relFile}\n   require(...) : "${reqPath}"\n   Sur GitHub   : "${real}"\n   Attendu      : "${candidate}"\n`
        );
        problems++;
        fixes.push({ from: real, to: candidate });
        break;
      }
    }
  }
}

if (problems === 0) {
  console.log('✅ Aucun problème de casse détecté (vérifié contre git ls-files).');
} else {
  console.log(`⚠️  ${problems} problème(s) de casse trouvé(s).`);
  if (fixMode) {
    console.log('\n🔧 Correction automatique...');
    for (const { from, to } of fixes) {
      const tmp = from + '.__tmp_case_fix__';
      execSync(`git mv "${from}" "${tmp}"`, { cwd: root });
      execSync(`git mv "${tmp}" "${to}"`, { cwd: root });
      console.log(`   Renommé : ${from} -> ${to}`);
    }
    console.log('\n✅ Corrections appliquées localement. Vérifie avec "git status", puis commit + push.');
  } else {
    console.log('   Relance avec "node check-case.js --fix" pour corriger automatiquement,');
    console.log('   ou corrige-les avant de commit/push.');
    process.exitCode = 1;
  }
}