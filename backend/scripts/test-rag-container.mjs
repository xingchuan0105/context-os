// Test RAG retrieval inside container
// Run with: docker exec context-os-backend node /app/scripts/test-rag-container.mjs

const USER_ID = '823590bf-83ad-4140-a263-c9bc6b3fda1e';
const KB_ID = '87367b30-971a-4a96-81b3-4e99f72363fa';

async function main() {
  const QDRANT_URL = process.env.QDRANT_URL || 'http://qdrant:6333';
  const LITELLM_URL = process.env.LITELLM_BASE_URL || 'http://litellm:4000';
  const COLLECTION = `user_${USER_ID}_vectors`;

  console.log('=== Container RAG Test ===');
  console.log('QDRANT_URL:', QDRANT_URL);
  console.log('LITELLM_BASE_URL:', LITELLM_URL);
  console.log('COLLECTION:', COLLECTION);
  console.log('KB_ID:', KB_ID);
  console.log('');

  // Step 1: Get embedding
  const query = 'LightRAG是什么？';
  console.log('Query:', query);
  console.log('');

  console.log('Step 1: Getting embedding...');
  const embRes = await fetch(`${LITELLM_URL}/v1/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LITELLM_API_KEY || 'local-dev'}`
    },
    body: JSON.stringify({
      model: 'qwen3-embedding-4b',
      input: query
    })
  });
  const embData = await embRes.json();
  if (!embData.data || !embData.data[0]) {
    console.log('Embedding failed:', JSON.stringify(embData));
    return;
  }
  const embedding = embData.data[0].embedding;
  console.log('Embedding dimension:', embedding.length);
  console.log('');

  // Step 2: Search for document-level chunks
  console.log('Step 2: Searching document-level chunks...');
  const docFilter = {
    must: [
      { key: 'kb_id', match: { value: KB_ID } },
      { key: 'type', match: { value: 'document' } }
    ]
  };
  const docRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vector: embedding,
      filter: docFilter,
      limit: 5,
      with_payload: true,
      score_threshold: 0.1
    })
  });
  const docData = await docRes.json();
  console.log('Document results:', docData.result?.length || 0);
  if (docData.result && docData.result.length > 0) {
    for (const r of docData.result) {
      console.log(`  - score: ${r.score.toFixed(4)}, doc_id: ${r.payload.doc_id?.slice(0,8)}..., content: ${r.payload.content?.slice(0,60)}...`);
    }
  } else {
    console.log('  No results found!');
    console.log('  Response:', JSON.stringify(docData));
  }
  console.log('');

  // Step 3: Search for child chunks
  console.log('Step 3: Searching child chunks...');
  const childFilter = {
    must: [
      { key: 'kb_id', match: { value: KB_ID } },
      { key: 'type', match: { value: 'child' } }
    ]
  };
  const childRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vector: embedding,
      filter: childFilter,
      limit: 5,
      with_payload: true,
      score_threshold: 0.1
    })
  });
  const childData = await childRes.json();
  console.log('Child results:', childData.result?.length || 0);
  if (childData.result && childData.result.length > 0) {
    for (const r of childData.result) {
      console.log(`  - score: ${r.score.toFixed(4)}, doc_id: ${r.payload.doc_id?.slice(0,8)}..., content: ${r.payload.content?.slice(0,60)}...`);
    }
  } else {
    console.log('  No results found!');
  }
}

main().catch(console.error);
