import { open } from 'fs/promises';

const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');

/**
 * Checks the file's leading bytes rather than trusting the extension or the
 * client-supplied mimetype, so a renamed non-PDF file is rejected.
 */
export async function hasPdfSignature(filePath: string): Promise<boolean> {
  const handle = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(PDF_SIGNATURE.length);
    const { bytesRead } = await handle.read(header, 0, PDF_SIGNATURE.length, 0);
    return bytesRead === PDF_SIGNATURE.length && header.equals(PDF_SIGNATURE);
  } finally {
    await handle.close();
  }
}
