import { readFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hash, invariant, canonical } from '../src/util.js';
export async function checkReplication(root = fileURLToPath(new URL('../', import.meta.url))) {
  const spec = JSON.parse(await readFile(path.join(root, 'docs/replicacao/spec.json'), 'utf8'));
  invariant(spec.schema === 1 && Array.isArray(spec.requirements), 'Spec inválida');
  invariant(hash(await readFile(path.join(root, spec.study.path))) === spec.study.sha256, 'Estudo original diverge do hash documentado');
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  const templateLock = JSON.parse(await readFile(path.join(root, 'templates/replication/dependency-lock.json'), 'utf8'));
  const dependencies = value => Object.fromEntries(Object.entries(value.packages).filter(([key]) => key !== ''));
  invariant(canonical(dependencies(lock)) === canonical(dependencies(templateLock)), 'Resoluções da réplica divergem do lockfile: atualize o asset após revisar dependências');
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  invariant(lock.name === pkg.name && canonical(lock.packages[''].dependencies) === canonical(pkg.dependencies), 'Identidade/dependências do lockfile incompatíveis');
  const ids = new Set(spec.requirements.map(requirement => requirement.id));
  invariant(ids.size === spec.requirements.length, 'Requisito duplicado');
  const visiting = new Set(), visited = new Set();
  const visit = id => {
    invariant(ids.has(id) && !visiting.has(id), 'Dependência ausente ou cíclica'); if (visited.has(id)) return;
    visiting.add(id); for (const dependency of spec.requirements.find(item => item.id === id).dependsOn) visit(dependency);
    visiting.delete(id); visited.add(id);
  };
  for (const requirement of spec.requirements) {
    visit(requirement.id);
    invariant(['implemented','partial','planned'].includes(requirement.status) && requirement.accept?.length > 20, 'Status/critério inválido');
    invariant(requirement.studySections.length && requirement.studySections.every(section => Number.isInteger(section) && section >= 1 && section <= 32), 'Seção de origem inválida');
    if (requirement.status === 'implemented') invariant(requirement.modules.length && requirement.tests.length, 'Implementação exige módulo e teste de referência');
    for (const file of [...requirement.modules, ...requirement.tests]) {
      invariant(typeof file === 'string' && !path.isAbsolute(file) && !file.includes('..'), 'Path de referência inválido');
      invariant((await lstat(path.join(root, file))).isFile(), `Referência ausente: ${file}`);
    }
  }
  return { requirements: ids.size, studySha256: spec.study.sha256 };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await checkReplication()));
