export interface SSEMessage {
  type: string;
  content?: string;
  [key: string]: unknown;
}

async function responseError(response: Response) {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body) as { error?: string };
    return parsed.error || `Request failed with status ${response.status}`;
  } catch {
    return body.trim() || `Request failed with status ${response.status}`;
  }
}

function parseEvent(event: string): SSEMessage | null {
  const data = event.split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).replace(/^ /, ''))
    .join('\n');
  if (!data) return null;
  try {
    return JSON.parse(data) as SSEMessage;
  } catch {
    throw new Error('The server returned an invalid event stream');
  }
}

export async function consumeSSE(
  response: Response,
  onMessage: (message: SSEMessage) => boolean | void
): Promise<SSEMessage | undefined> {
  if (!response.ok) throw new Error(await responseError(response));
  if (!response.body) throw new Error('The server returned an empty event stream');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let boundary = buffer.match(/\r?\n\r?\n/);
    while (boundary?.index !== undefined) {
      const event = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      const message = parseEvent(event);
      if (message && onMessage(message)) {
        await reader.cancel();
        return message;
      }
      boundary = buffer.match(/\r?\n\r?\n/);
    }

    if (done) {
      const message = parseEvent(buffer);
      if (message && onMessage(message)) return message;
      return undefined;
    }
  }
}
