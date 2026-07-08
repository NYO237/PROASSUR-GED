// check-case.js
// Détecte les require('./...') dont la casse ne correspond pas EXACTEMENT
// au nom réel du fichier sur le disque (fonctionne sur Windows, échoue sur Render/Linux).
//
// Utilisation : placer ce fichier à la racine du projet, puis :
//   node check-case.js

const fs = require('fs');
const path = require('path');

const root = __dirname;
const ignoreDirs = new Set(['node_modules', '.git', 'uploads', 'images']);

function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, callback);
    else if (entry.name.endsWith('.js')) callback(full);
  }
}

const requireRegex = /require\(\s*['"](\.[^'"]+)['"]\s*\)/g;
let problems = 0;

walk(root, (file) => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = requireRegex.exec(content))) {
    const reqPath = match[1];
    const resolvedNoExt = path.resolve(path.dirname(file), reqPath);
    const candidates = [resolvedNoExt, resolvedNoExt + '.js'];

    for (const candidate of candidates) {
      const dir = path.dirname(candidate);
      const base = path.basename(candidate);
      if (!fs.existsSync(dir)) continue;

      const real = fs.readdirSync(dir).find(
        (f) => f.toLowerCase() === base.toLowerCase()
      );

      if (real && real !== base) {
        console.log(
          `❌ Casse différente\n   Fichier    : ${path.relative(root, file)}\n   require(...) : "${reqPath}"\n   Fichier réel : "${real}"  (attendu : "${base}")\n`
        );
        problems++;
      }
    }
  }
});

console.log(
  problems === 0
    ? '✅ Aucun problème de casse détecté.'
    : `⚠️  ${problems} problème(s) de casse trouvé(s) — corrige-les avant de redéployer sur Render.`
);
