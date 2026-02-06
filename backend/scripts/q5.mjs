const DOC_ID = '4aac44c1-9337-4384-ae6d-cebda6b4cd0a';
const KB_ID = '87367b30-971a-4a96-81b3-4e99f72363fa';
const COLLECTION = 'user_823590bf-83ad-4140-a263-c9bc6b3fda1e_vectors';
const URL = 'http://localhost:16333';

async function main() {
  console.log('=== Check completed document in Qdrant ===');
  console.log('DOC_ID:', DOC_ID);
  console.log('KB_ID:', KB_ID);
  console.log('');

  // Check by doc_id
  const docRes = await fetch(URL + '/collections/' + COLLECTION + '/points/count', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      filter: {
        must: [{key: 'doc_id', match: {value: DOC_ID}}]
      }
    })
  });
  const docData = await docRes.json();
  console.log('Points for doc_id:', docData.result.count);

  // Check by kb_id
  const kbRes = await fetch(URL + '/collections/' + COLLECTION + '/points/count', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      filter: {
        must: [{key: 'kb_id', match: {value: KB_ID}}]
      }
    })
  });
  const kbData = await kbRes.json();
  console.log('Points for kb_id:', kbData.result.count);
}

main().catch(console.error);
