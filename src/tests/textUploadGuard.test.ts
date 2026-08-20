import test from 'node:test';
import assert from 'node:assert';
import { isTextDocument, processImagesForQwen } from '../routes/upload.ts';

const STS_BODY = JSON.stringify({
  success: true,
  request_id: 'r',
  data: {
    access_key_id: 'ak',
    access_key_secret: 'sk',
    security_token: 'st',
    file_url: 'http://mock-oss/prompt.txt',
    file_path: 'p/prompt.txt',
    file_id: 'file-id-1',
    bucketname: 'b',
    region: 'cn-hongkong',
    endpoint: 'oss.example.com',
  },
});

test('isTextDocument: correctly identifies text document extensions and mimes', () => {
  assert.strictEqual(isTextDocument('test.py', 'text/x-python'), true);
  assert.strictEqual(isTextDocument('script.ts', 'application/typescript'), true);
  assert.strictEqual(isTextDocument('data.json', 'application/json'), true);
  assert.strictEqual(isTextDocument('notes.txt', 'text/plain'), true);
  assert.strictEqual(isTextDocument('log.log', 'application/octet-stream'), true);
  assert.strictEqual(isTextDocument('image.png', 'image/png'), false);
  assert.strictEqual(isTextDocument('video.mp4', 'video/mp4'), false);
});

test('processImagesForQwen: text documents are inlined into prompt text', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : ('url' in input ? input.url : String(input));
    if (urlStr.includes('/api/v2/files/sts/token')) {
      return new Response(STS_BODY, { status: 200 });
    }
    if (urlStr.includes('example.com/note.txt') || urlStr.includes('note.txt')) {
      return new Response('conteudo do arquivo txt', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });
    }
    return originalFetch(input);
  };

  try {
    const result = await processImagesForQwen(
      [{ type: 'file_url', file_url: { url: 'http://example.com/note.txt' } }],
      { cookie: 'c', 'user-agent': 'UA', 'bx-ua': 'x', 'bx-umidtoken': 'y', 'bx-v': '2.5.37' },
    );
    assert.ok(result.text.includes('[File: note.txt]'), 'must label the inline document in text');
    assert.ok(result.text.includes('conteudo do arquivo txt'), 'must inline the text content in text');
    assert.strictEqual(result.files.length, 0, 'text documents must not be attached as binary files');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
