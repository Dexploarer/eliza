import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

// Minimal mock for @elizaos/core
mock.module('@elizaos/core', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  },
  stringToUuid: (s: string) => s,
  AgentRuntime: class {},
}));

let loadProject: (dir: string) => Promise<any>;

function createModule(root: string, file: string) {
  const fullPath = join(root, file);
  mkdirSync(dirname(fullPath), { recursive: true });
  const content = `export default { agents: [{ character: { name: 'Simple', bio: '', messageExamples: [], postExamples: [], topics: [], adjectives: [], knowledge: [], plugins: [], settings: {}, style: {} } }] };`;
  writeFileSync(fullPath, content);
}

describe('loadProject entry point resolution', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'project-'));
    return import('../../src/project').then((m) => {
      loadProject = m.loadProject;
    });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('uses main field from package.json', async () => {
    const pkg = { name: 'proj', version: '1.0.0', main: 'src/main.js' };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
    createModule(dir, 'src/main.js');

    const project = await loadProject(dir);
    expect(project.agents.length).toBe(1);
    expect(project.agents[0].character.name).toBe('Simple');
  });

  it('falls back to index.js when main missing', async () => {
    const pkg = { name: 'proj', version: '1.0.0' };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
    createModule(dir, 'index.js');

    const project = await loadProject(dir);
    expect(project.agents.length).toBe(1);
    expect(project.agents[0].character.name).toBe('Simple');
  });
});
