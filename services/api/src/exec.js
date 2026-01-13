import { execFile } from 'node:child_process';

/**
 * Execute a system command and capture its stdout and stderr.
 *
 * @param {string} cmd - Command to execute.
 * @param {string[]} args - Array of string arguments to pass to the command.
 * @param {Object} [options] - Options passed to Node's `child_process.execFile`.
 * @returns {Promise<{stdout: string, stderr: string}>} A promise that resolves with the command's `stdout` and `stderr`.
 * @throws {Error} When the command fails; the error message is `stderr` if available otherwise the original error message, and `error.code` is set to the underlying exit code.
 */
export function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(stderr || error.message);
        err.code = error.code;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}