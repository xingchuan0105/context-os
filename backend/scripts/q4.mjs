const DOC_ID = 'dd2eaf57-935b-43c8-8d44-394c34688b9b';
const COLLECTION = 'user_823590bf-83ad-4140-a263-c9bc6b3fda1e_vectors';
const URL = 'http://localhost:16333';

async function main() {
  console.log('=== Check doc_id in Qdrant ===');
  console.log('DOC_ID:', DOC_ID);

  const res = await fetch(URL + '/collections/' + COLLECTION + '/points/scroll', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      limit: 10,
      with_payload: true,
      filter: {
        must: [
          {key: 'doc_id', match: {value: DOC_ID}}
        ]
      }
    })
  });
  const data = await res.json();

  if (data.result && data.result.points && data.result.points.length > 0) {
    console.log('Found', data.result.points.length, 'points for this doc_id');
    for (const p of data.result.points) {
      console.log('- type:', p.payload.type, '| kb_id:', p.payload.kb_id);
    }
  } else {
    console.log('No data found for this doc_id');
  }

  // Also check all unique doc_ids
  console.log('\n=== All unique doc_ids in Qdrant ===');
  const scrollRes = await fetch(URL + '/collections/' + COLLECTION + '/points/scroll', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      limit: 100,
      with_payload: true
    })
  });
  const scrollData = await scrollRes.json();

  if (scrollData.result && scrollData.result.points) {
    const docIds = new Map();
    for (const p of scrollData.result.points) {
      if (p.payload.doc_id) {
        if (!docIds.has(p.payload.doc_id)) {
          docIds.set(p.payload.doc_id, {kb_id: p.payload.kb_id, count: 0});
        }
        docIds.get(p.payload.doc_id).count++;
      }
    }
    for (const [docId, info] of docIds) {
      console.log('-', docId.slice(0,8) + '...', '| kb:', info.kb_id.slice(0,8) + '...', '| count:', info.count);
    }
  }
}

main().catch(console.error);
