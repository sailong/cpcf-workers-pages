import { describe, expect, it, vi } from 'vitest';
import { consumeSSE } from './sse-stream';

function responseFrom(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('consumeSSE', () => {
  it('preserves fragmented CRLF events and stops at the terminal event', async () => {
    const onMessage = vi.fn(message => message.type === 'result');
    const result = await consumeSSE(responseFrom([
      'data: {"type":"lo',
      'g","content":"building"}\r\n\r',
      '\ndata: {"type":"result","success":true}\r\n\r\n'
    ]), onMessage);

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage.mock.calls[0][0]).toEqual({ type: 'log', content: 'building' });
    expect(result).toMatchObject({ type: 'result', success: true });
  });

  it('rejects HTTP failures and malformed completed events', async () => {
    await expect(consumeSSE(new Response('{"error":"Build rejected"}', { status: 429 }), () => {}))
      .rejects.toThrow('Build rejected');
    await expect(consumeSSE(responseFrom(['data: {invalid}\n\n']), () => {}))
      .rejects.toThrow('invalid event stream');
  });

  it('rejects responses without a body', async () => {
    await expect(consumeSSE(new Response(null, { status: 200 }), () => {}))
      .rejects.toThrow('empty event stream');
  });
});
