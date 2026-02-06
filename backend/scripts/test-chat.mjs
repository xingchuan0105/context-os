// Test chat API to trigger RAG retrieval
const SESSION_ID = 'b28ff2aa-8296-4905-a813-14c44b96b042';
const API_URL = 'http://localhost:3002';

async function login() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'xingchuan0105@outlook.com',
      password: 'Zxc123456'  // Assuming this is the password
    })
  });
  const cookies = res.headers.get('set-cookie');
  console.log('Login status:', res.status);
  if (!res.ok) {
    const text = await res.text();
    console.log('Login error:', text);
    return null;
  }
  // Extract auth_token from cookies
  const match = cookies?.match(/auth_token=([^;]+)/);
  return match ? match[1] : null;
}

async function sendMessage(token, message) {
  console.log('Sending message:', message);
  const res = await fetch(`${API_URL}/api/chat/sessions/${SESSION_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `auth_token=${token}`
    },
    body: JSON.stringify({ message })
  });

  console.log('Response status:', res.status);

  // Read SSE stream
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          console.log('Stream done');
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'search') {
            console.log('Search result:', parsed.data);
          } else if (parsed.type === 'token') {
            process.stdout.write(parsed.data);
          } else if (parsed.type === 'error') {
            console.log('Error:', parsed.data);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }
}

async function main() {
  console.log('=== Chat API Test ===');
  console.log('Session ID:', SESSION_ID);
  console.log('');

  const token = await login();
  if (!token) {
    console.log('Failed to login');
    return;
  }
  console.log('Got auth token');
  console.log('');

  await sendMessage(token, 'LightRAG是什么？');
}

main().catch(console.error);
