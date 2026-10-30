import fs from 'node:fs';
import path from 'node:path';

export type ProjectType = 'web' | 'backend' | 'mobile' | 'desktop' | 'library' | 'unknown';
export type ProjectLanguage = 'typescript' | 'javascript' | 'dart' | 'kotlin' | 'java' | 'csharp' | 'python' | 'unknown';
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | null;
export type ProjectPlatform = 'web' | 'server' | 'android' | 'ios' | 'windows' | 'macos' | 'linux';

export interface ProjectProfile {
  root: string;
  name: string;
  projectType: ProjectType;
  language: ProjectLanguage;
  framework: string;
  packageManager: PackageManager;
  scripts: string[];
  platforms: ProjectPlatform[];
  manifests: string[];
  warnings: string[];
}

const MAX_MANIFEST_BYTES = 512 * 1024;

function safeRoot(input: string): string {
  const absolute = path.resolve(input);
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('Project root must be a real directory, not a symlink or file.');
  }
  return fs.realpathSync(absolute);
}

function safeFile(root: string, relative: string): string | null {
  const candidate = path.resolve(root, relative);
  if (!candidate.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(candidate)) return null;
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_MANIFEST_BYTES) return null;
  const real = fs.realpathSync(candidate);
  if (!real.startsWith(root + path.sep)) return null;
  return candidate;
}

function readText(root: string, relative: string): string | null {
  const file = safeFile(root, relative);
  return file ? fs.readFileSync(file, 'utf8') : null;
}

function packageManager(root: string): PackageManager {
  if (safeFile(root, 'pnpm-lock.yaml')) return 'pnpm';
  if (safeFile(root, 'yarn.lock')) return 'yarn';
  if (safeFile(root, 'bun.lockb') || safeFile(root, 'bun.lock')) return 'bun';
  if (safeFile(root, 'package-lock.json') || safeFile(root, 'npm-shrinkwrap.json')) return 'npm';
  return null;
}

export function detectProject(inputRoot: string): ProjectProfile {
  const root = safeRoot(inputRoot);
  const warnings: string[] = [];
  const manifests: string[] = [];
  const platforms: ProjectPlatform[] = [];
  let name = path.basename(root);
  let projectType: ProjectType = 'unknown';
  let language: ProjectLanguage = 'unknown';
  let framework = 'unknown';
  let scripts: string[] = [];
  let manager: PackageManager = null;

  const packageText = readText(root, 'package.json');
  if (packageText !== null) {
    manifests.push('package.json');
    try {
      const pkg = JSON.parse(packageText);
      name = typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name.trim() : name;
      scripts = pkg.scripts && typeof pkg.scripts === 'object' && !Array.isArray(pkg.scripts)
        ? Object.keys(pkg.scripts).filter((key) => /^[a-zA-Z0-9:_-]{1,80}$/.test(key)).sort()
        : [];
      manager = packageManager(root);
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.next) {
        projectType = 'web'; language = 'javascript'; framework = 'next'; platforms.push('web');
      } else if (deps.vite && deps.react) {
        projectType = 'web'; language = 'javascript'; framework = 'react-vite'; platforms.push('web');
      } else if (deps.vite && (deps.vue || deps.svelte)) {
        projectType = 'web'; language = 'javascript'; framework = deps.vue ? 'vue-vite' : 'svelte-vite'; platforms.push('web');
      } else if (deps.express || deps.fastify || deps.koa || deps.hono) {
        projectType = 'backend'; language = 'javascript';
        framework = deps.express ? 'node-express' : deps.fastify ? 'node-fastify' : deps.koa ? 'node-koa' : 'node-hono';
        platforms.push('server');
      } else if (deps.react || deps.vue || deps.svelte) {
        projectType = 'web'; language = 'javascript'; framework = deps.react ? 'react' : deps.vue ? 'vue' : 'svelte'; platforms.push('web');
      } else {
        projectType = scripts.some((script) => /start|serve|dev/.test(script)) ? 'backend' : 'library';
        language = 'javascript';
        framework = projectType === 'backend' ? 'node' : 'node-library';
        platforms.push(projectType === 'backend' ? 'server' : 'web');
      }
      if (safeFile(root, 'tsconfig.json')) language = 'typescript';
    } catch {
      warnings.push('package.json exists but is not valid JSON; JavaScript project metadata was not trusted.');
    }
  }

  if (readText(root, 'pubspec.yaml') !== null) {
    manifests.push('pubspec.yaml');
    projectType = 'mobile'; language = 'dart'; framework = 'flutter';
    platforms.splice(0, platforms.length, 'android', 'ios', 'web');
  }

  const gradleManifest = safeFile(root, 'settings.gradle') || safeFile(root, 'settings.gradle.kts') ||
    safeFile(root, 'build.gradle') || safeFile(root, 'build.gradle.kts') ||
    safeFile(root, 'app/build.gradle') || safeFile(root, 'app/build.gradle.kts');
  if (gradleManifest) {
    const manifestName = ['settings.gradle', 'settings.gradle.kts', 'build.gradle', 'build.gradle.kts', 'app/build.gradle', 'app/build.gradle.kts']
      .find((file) => safeFile(root, file));
    if (manifestName) manifests.push(manifestName);
    const gradleText = readText(root, manifestName || '') || '';
    const androidText = (readText(root, 'app/build.gradle') || '') + (readText(root, 'app/build.gradle.kts') || '') + gradleText;
    if (/com\.android\.(application|library)|com\.android\.tools\.build/i.test(androidText) || manifestName?.startsWith('app/')) {
      projectType = 'mobile'; framework = 'android-gradle';
      language = /\.kts$/.test(manifestName || '') || /\.kts$/.test((safeFile(root, 'app/build.gradle.kts') || '')) ? 'kotlin' : 'java';
      if (!platforms.includes('android')) platforms.push('android');
    }
  }

  const dotnetFiles = fs.readdirSync(root).filter((entry) => /\.(csproj|sln)$/.test(entry) && safeFile(root, entry));
  if (dotnetFiles.length) {
    manifests.push(...dotnetFiles);
    projectType = 'desktop'; language = 'csharp'; framework = 'dotnet';
    if (!platforms.includes('windows')) platforms.push('windows');
  }

  if (readText(root, 'pyproject.toml') !== null || readText(root, 'requirements.txt') !== null) {
    if (safeFile(root, 'pyproject.toml')) manifests.push('pyproject.toml');
    if (safeFile(root, 'requirements.txt')) manifests.push('requirements.txt');
    projectType = 'backend'; language = 'python'; framework = 'python';
    if (!platforms.includes('server')) platforms.push('server');
  }

  return {
    root,
    name,
    projectType,
    language,
    framework,
    packageManager: manager,
    scripts,
    platforms,
    manifests: [...new Set(manifests)],
    warnings,
  };
}
