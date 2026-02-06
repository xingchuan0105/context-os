const COLLECTION = 'user_823590bf-83ad-4140-a263-c9bc6b3fda1e_vectors';
const URL = 'http://localhost:16333';

async function main() {
  console.log('=== Check existing KB IDs in Qdrant ===');

  const scrollRes = await fetch(URL + '/collections/' + COLLECTION + '/points/scroll', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      limit: 20,
      with_payload: true
    })
  });
  const scrollData = await scrollRes.json();

  if (scrollData.result && scrollData.result.points) {
    const kbIds = new Set();
    for (const p of scrollData.result.points) {
      if (p.payload.kb_id) {
        kbIds.add(p.payload.kb_id);
      }
    }
    console.log('Found KB IDs:');
    for (const kbId of kbIds) {
      console.log('  -', kbId);
    }
  }
}

main().catch(console.error);
