// Prévia somente da interface: sem inferência, ferramentas ou alteração de arquivos.
import { setTimeout as delay } from 'node:timers/promises';
import { Terminal } from '../src/terminal.js';
const screen = new Terminal(), controller = new AbortController();
const cancel = () => controller.abort();
process.once('SIGINT', cancel);
try {
  await screen.opening({ root: process.cwd(), provider: 'codex', profile: { name: 'general' }, permissions: {} }, { signal: controller.signal });
  screen.note('Prévia visual local. Nenhuma chamada ao modelo.');
  await delay(600, undefined, { signal: controller.signal });
  screen.progress('Pensando');
  await delay(2600, undefined, { signal: controller.signal });
  screen.message('Prévia concluída: globo principal contínuo e mini globo de atividade.');
  await delay(600, undefined, { signal: controller.signal });
} catch (error) { if (!controller.signal.aborted) throw error; }
finally { screen.close(); process.removeListener('SIGINT', cancel); }
