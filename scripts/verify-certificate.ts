import { readFile } from 'node:fs/promises';
import { verifyCertificate } from '../packages/simulator/src/certificate';

const [certificatePath, workflowPath] = process.argv.slice(2);
if (!certificatePath) {
  process.stderr.write('Usage: pnpm verify:certificate <certificate.json> [original-workflow.json]\n');
  process.exit(2);
}
try {
  const certificate = JSON.parse(await readFile(certificatePath, 'utf8'));
  const workflow = workflowPath ? JSON.parse(await readFile(workflowPath, 'utf8')) : undefined;
  const result = await verifyCertificate(certificate, workflow);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Verification failed'}\n`);
  process.exitCode = 1;
}
