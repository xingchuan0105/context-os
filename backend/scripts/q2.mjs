const KB_ID = 'e6499217-e24b-46f5-805b-ea994ec27aaa';
const COLLECTION = 'user_823590bf-83ad-4140-a263-c9bc6b3fda1e_vectors';
const URL = 'http://localhost:16333';

async function main() {
  console.log('=== KB Data Check ===');
  console.log('KB_ID:', KB_ID);
  console.log('');

  for (const type of ['document', 'parent', 'child']) {
    const res = await fetch(URL + '/collections/' + COLLECTION + '/points/count', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        filter: {
          must: [
            {key: 'kb_id', match: {value: KB_ID}},
            {key: 'type', match: {value: type}}
          ]
        }
      })
    });
    const data = await res.json();
    console.log(type + ':', data.result.count);
  }

  console.log('');
  console.log('=== Sample Data ===');
  const scrollRes = await fetch(URL + '/collections/' + COLLECTION + '/points/scroll', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      limit: 3,
      with_payload: true,
      filter: {
        must: [
          {key: 'kb_id', match: {value: KB_ID}}
        ]
      }
    })
  });
  const scrollData = await scrollRes.json();
  if (scrollData.result && scrollData.result.points) {
    console.log('Found', scrollData.result.points.length, 'points');
    for (const p of scrollData.result.points) {
      const content = p.payload.content ? p.payload.content.slice(0, 80) : '';
      console.log('- type=' + p.payload.type + ', doc_id=' + (p.payload.doc_id || '').slice(0,8) + '...');
      console.log('  content: ' + content + '...');
    }
  } else {
    console.log('No data found for this KB');
    console.log('Response:', JSON.stringify(scrollData));
  }
}

main().catch(console.error);
