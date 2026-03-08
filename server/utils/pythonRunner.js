import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_DIR = join(__dirname, '..', 'python');

// Common Python binary locations on macOS
const PYTHON_CANDIDATES = [
  process.env.PYTHON_BIN,
  '/opt/homebrew/bin/python3',
  '/usr/local/bin/python3',
  'python3',
  'python',
].filter(Boolean);

function findPython() {
  // Return env override first, then default to first candidate
  return PYTHON_CANDIDATES[0];
}

/**
 * Run a Python script with arguments and parse its JSON output.
 * @param {string} script  - filename in server/python/
 * @param {string[]} args  - command-line arguments
 * @returns {Promise<any>} - parsed JSON result
 */
export function runPython(script, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = join(PYTHON_DIR, script);
    const python = findPython();

    // Ensure homebrew bin is in PATH for subprocess to find tesseract etc.
    const env = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}`,
    };

    const child = spawn(python, [scriptPath, ...args], { env });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', code => {
      if (stderr) console.warn(`[Python:${script}] stderr:`, stderr.slice(0, 500));
      const raw = stdout.trim();
      if (!raw) {
        return reject(new Error(`Python script ${script} produced no output. stderr: ${stderr}`));
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error(`Python script ${script} returned non-JSON: ${raw.slice(0, 200)}`));
      }
    });

    child.on('error', err => reject(new Error(`Failed to start python (${python}): ${err.message}`)));
  });
}
