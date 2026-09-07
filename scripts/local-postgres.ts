/**
 * Local PostgreSQL 17 for development without Docker.
 *
 *   pnpm db:local           initialise (first run) and start; keeps running until Ctrl+C
 *   pnpm db:local --stop    stop an instance started earlier (from any terminal)
 *   pnpm db:local --status  report whether the cluster is running
 *
 * Data lives in <repo>/.local-postgres (gitignored). Override with LOCAL_PG_DIR when the
 * repository sits inside a synced folder (OneDrive, Dropbox) and you prefer the data
 * directory elsewhere, e.g. LOCAL_PG_DIR=%LOCALAPPDATA%\auditsphere-pg.
 *
 * Connection defaults (override with LOCAL_PG_PORT / LOCAL_PG_USER / LOCAL_PG_PASSWORD /
 * LOCAL_PG_DATABASE):
 *   postgresql://auditsphere:auditsphere@localhost:5432/auditsphere?schema=public
 */
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { spawn } from 'node:child_process';

const REPO_ROOT = path.resolve(typeof __dirname === 'string' ? path.join(__dirname, '..') : process.cwd());

const DATA_DIR = path.resolve(process.env.LOCAL_PG_DIR ?? path.join(REPO_ROOT, '.local-postgres'));
const PORT = Number(process.env.LOCAL_PG_PORT ?? 5432);
const USER = process.env.LOCAL_PG_USER ?? 'auditsphere';
const PASSWORD = process.env.LOCAL_PG_PASSWORD ?? 'auditsphere';
const DATABASE = process.env.LOCAL_PG_DATABASE ?? 'auditsphere';

const DATABASE_URL = `postgresql://${encodeURIComponent(USER)}:${encodeURIComponent(PASSWORD)}@localhost:${PORT}/${DATABASE}?schema=public`;

const args = new Set(process.argv.slice(2));

function log(message: string) {
  process.stdout.write(`[local-postgres] ${message}\n`);
}

function isInitialised(): boolean {
  return fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));
}

function readPostmasterPid(): number | null {
  const pidFile = path.join(DATA_DIR, 'postmaster.pid');
  if (!fs.existsSync(pidFile)) return null;
  const first = fs.readFileSync(pidFile, 'utf8').split(/\r?\n/)[0]?.trim();
  const pid = Number(first);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** True when something accepts TCP connections on the configured port. */
function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    const done = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/** Resolve the platform binary package that embedded-postgres itself uses. */
async function loadBinaries(): Promise<{ pg_ctl: string; postgres: string; initdb: string }> {
  const platform = os.platform() === 'win32' ? 'windows' : os.platform();
  const pkg = `@embedded-postgres/${platform}-${os.arch()}`;
  try {
    return (await import(pkg)) as { pg_ctl: string; postgres: string; initdb: string };
  } catch (err) {
    throw new Error(`Postgres binaries package ${pkg} is not installed: ${(err as Error).message}`);
  }
}

function run(command: string, cmdArgs: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, cmdArgs, { stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  });
}

async function stopInstance(): Promise<void> {
  if (!isInitialised()) {
    log(`no cluster found at ${DATA_DIR}`);
    return;
  }
  const pid = readPostmasterPid();
  if (!pid) {
    log('no postmaster.pid found; the cluster is not running');
    return;
  }
  const { pg_ctl } = await loadBinaries();
  log(`stopping cluster (pid ${pid}) with pg_ctl ...`);
  const code = await run(pg_ctl, ['-D', DATA_DIR, 'stop', '-m', 'fast', '-w', '-t', '30']);
  if (code !== 0) {
    if (!isProcessAlive(pid)) {
      log('postmaster is not running; removing stale postmaster.pid');
      fs.rmSync(path.join(DATA_DIR, 'postmaster.pid'), { force: true });
      return;
    }
    throw new Error(`pg_ctl stop exited with code ${code}`);
  }
  log('stopped');
}

async function status(): Promise<void> {
  const pid = readPostmasterPid();
  const open = await isPortOpen(PORT);
  log(`data dir : ${DATA_DIR}${isInitialised() ? '' : ' (not initialised)'}`);
  log(`pid file : ${pid ? `pid ${pid} (${isProcessAlive(pid) ? 'alive' : 'stale'})` : 'none'}`);
  log(`port ${PORT}: ${open ? 'accepting connections' : 'closed'}`);
  log(`url      : ${DATABASE_URL}`);
}

async function ensureDatabase(client: import('pg').Client): Promise<void> {
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DATABASE]);
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE "${DATABASE.replace(/"/g, '""')}"`);
    log(`created database ${DATABASE}`);
  }
}

async function startInstance(): Promise<void> {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');

  if (await isPortOpen(PORT)) {
    const pid = readPostmasterPid();
    if (pid && isProcessAlive(pid)) {
      log(`cluster already running (pid ${pid}) on port ${PORT}`);
      log(`DATABASE_URL=${DATABASE_URL}`);
      return;
    }
    throw new Error(
      `port ${PORT} is already in use by another process. Stop it or set LOCAL_PG_PORT to a free port.`,
    );
  }

  const stalePid = readPostmasterPid();
  if (stalePid && !isProcessAlive(stalePid)) {
    log(`removing stale postmaster.pid (pid ${stalePid} is not running)`);
    fs.rmSync(path.join(DATA_DIR, 'postmaster.pid'), { force: true });
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PORT,
    user: USER,
    password: PASSWORD,
    authMethod: 'scram-sha-256',
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
    postgresFlags: ['-c', 'listen_addresses=localhost', '-c', 'max_connections=100'],
    onLog: (message) => {
      const line = String(message).trim();
      if (line) process.stdout.write(`[postgres] ${line}\n`);
    },
    onError: (message) => {
      const line = String(message instanceof Error ? message.message : message).trim();
      if (line) process.stderr.write(`[postgres] ${line}\n`);
    },
  });

  if (!isInitialised()) {
    log(`initialising new cluster in ${DATA_DIR} ...`);
    await pg.initialise();
  } else {
    log(`using existing cluster in ${DATA_DIR}`);
  }

  log(`starting Postgres on port ${PORT} ...`);
  await pg.start();

  const client = pg.getPgClient('postgres');
  await client.connect();
  try {
    await ensureDatabase(client);
  } finally {
    await client.end();
  }

  log('ready');
  log(`DATABASE_URL=${DATABASE_URL}`);
  log('press Ctrl+C to stop (or run: pnpm db:local --stop)');

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log(`${signal} received, stopping Postgres ...`);
    try {
      await pg.stop();
      log('stopped');
      process.exit(0);
    } catch (err) {
      process.stderr.write(`[local-postgres] failed to stop cleanly: ${(err as Error).message}\n`);
      process.exit(1);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGHUP', () => void shutdown('SIGHUP'));

  // Keep the event loop alive; the postgres child process is not ref-counted.
  setInterval(() => undefined, 1 << 30);
}

async function main() {
  if (args.has('--help') || args.has('-h')) {
    process.stdout.write(
      [
        'Usage: pnpm db:local [--stop | --status]',
        '',
        '  (no flag)   initialise if needed and start Postgres; blocks until Ctrl+C',
        '  --stop      stop a running instance',
        '  --status    report state',
        '',
        `Data dir: ${DATA_DIR}`,
        `URL     : ${DATABASE_URL}`,
        '',
      ].join('\n'),
    );
    return;
  }
  if (args.has('--stop')) return stopInstance();
  if (args.has('--status')) return status();
  return startInstance();
}

main().catch((err) => {
  process.stderr.write(`[local-postgres] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
