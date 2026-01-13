import { execFile } from 'node:child_process';

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
