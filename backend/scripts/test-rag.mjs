// Test RAG retrieval directly
const USER_ID = '823590bf-83ad-4140-a263-c9bc6b3fda1e';
const KB_ID = '87367b30-971a-4a96-81b3-4e99f72363fa';
const COLLECTION = `user_${USER_ID}_vectors`;
const QDRANT_URL = 'http://localhost:16333';
const LITELLM_URL = 'http://localhost:4410';

async function getEmbedding(text) {
  const res = await fetch(`${LITELLM_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer local-dev'
    },
    body: JSON.stringify({
      model: 'qwen3-embedding-4b',
      input: text
    })
  });
  const data = await res.json();
  if (!data.data || !data.data[0]) {
    throw new Error('Embedding failed: ' + JSON.stringify(data));
  }
  return data.data[0].embedding;
}

async function searchQdrant(vector, filter, limit = 5) {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vector,
      filter,
      limit,
      with_payload: true,
      score_threshold: 0.1
    })
  });
  return res.json();
}

async function main() {
  const query = 'LightRAG是什么？';
  console.log('=== RAG Retrieval Test ===');
  console.log('Query:', query);
  console.log('KB_ID:', KB_ID);
  console.log('');

  // Step 1: Get embedding
  console.log('Step 1: Getting embedding...');
  const embedding = await getEmbedding(query);
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
  const docResults = await searchQdrant(embedding, docFilter, 5);
  console.log('Document results:', docResults.result?.length || 0);
  if (docResults.result && docResults.result.length > 0) {
    for (const r of docResults.result) {
      console.log(`  - score: ${r.score.toFixed(4)}, doc_id: ${r.payload.doc_id?.slice(0,8)}..., content: ${r.payload.content?.slice(0,60)}...`);
    }
  } else {
    console.log('  No results found!');
    console.log('  Response:', JSON.stringify(docResults));
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
  const childResults = await searchQdrant(embedding, childFilter, 5);
  console.log('Child results:', childResults.result?.length || 0);
  if (childResults.result && childResults.result.length > 0) {
    for (const r of childResults.result) {
      console.log(`  - score: ${r.score.toFixed(4)}, doc_id: ${r.payload.doc_id?.slice(0,8)}..., content: ${r.payload.content?.slice(0,60)}...`);
    }
  } else {
    console.log('  No results found!');
  }
  console.log('');

  // Step 4: Check what types exist in the collection
  console.log('Step 4: Checking chunk types in collection...');
  for (const type of ['document', 'parent', 'child']) {
    const countRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          must: [
            { key: 'kb_id', match: { value: KB_ID } },
            { key: 'type', match: { value: type } }
          ]
        }
      })
    });
    const countData = await countRes.json();
    console.log(`  ${type}: ${countData.result?.count || 0}`);
  }
}

main().catch(console.error);
