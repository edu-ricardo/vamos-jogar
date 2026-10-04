// Sobe um PocketBase descartável com as migrations do projeto, roda os testes contra ele e remove o
// container no final. Uso: npm run test:pocketbase
import { execFileSync, spawnSync } from 'node:child_process';

const CONTAINER = 'vamos-jogar-pocketbase-test';
const PORT = 8091;
const ADMIN = { email: 'admin@vamosjogar.test', password: 'senha-de-teste-123' };
const docker = (...args) => execFileSync('docker', args, { stdio: 'pipe' }).toString().trim();

const waitForHealth = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('PocketBase não respondeu em 30 s');
};

let exitCode = 1;
try {
  console.log('Construindo a imagem do PocketBase...');
  docker('build', '-q', '-f', 'apps/pocketbase/Dockerfile', '-t', `${CONTAINER}:latest`, '.');
  spawnSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' });
  docker(
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-p',
    `${PORT}:8090`,
    '--tmpfs',
    '/pb_data',
    // O superusuário é criado pelo entrypoint da imagem, como no Umbrel
    '-e',
    `PB_SUPERUSER_EMAIL=${ADMIN.email}`,
    '-e',
    `PB_SUPERUSER_PASSWORD=${ADMIN.password}`,
    `${CONTAINER}:latest`,
  );
  await waitForHealth();

  // Os arquivos dividem o mesmo banco: rodam um de cada vez
  const result = spawnSync(
    'npx',
    [
      'vitest',
      'run',
      'tests/repositories.pocketbase.test.ts',
      'tests/pocketbase.rules.test.ts',
      'tests/pocketbase.auth.test.ts',
      'tests/pocketbase.api.test.ts',
      'tests/pocketbase.import.test.ts',
      '--no-file-parallelism',
    ],
    {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        PB_TEST_URL: `http://127.0.0.1:${PORT}`,
        PB_TEST_ADMIN_EMAIL: ADMIN.email,
        PB_TEST_ADMIN_PASSWORD: ADMIN.password,
      },
    },
  );
  exitCode = result.status ?? 1;
} catch (err) {
  console.error(err.message);
} finally {
  spawnSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' });
}
process.exit(exitCode);
