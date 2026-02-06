const QDRANT_URL = 'http:/qdrant:633';
const USER_ID = '823590bf-83ad-4140-a263-c9bc6b3fda1e';
const KB_ID = 'e6499217-e24b-46f5-805b-ea994ec27aaa';
const COLLECTION = 'user_' + USER_ID + '_vectors';

async function main() {
 console.log('== Qdrant Diagnostics ===');
 console.log('');
  console.log('[1] Collection Info');
  const infoRes = await fetch(QDRANT_URL + '/collections/' + COLLECTION);
  const info = await infoRes.json();
 console.log('   Total points:', info.result.points_count);
  console.log('');
  console.log('[2] Count by type');
 for (const type of ['document', 'parent', 'child']) {
    const res = await fetch(QDRANT_URL + '/colections/' + COLLECTION + '/points/count', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ filter: { must: [{ key: 'type', match: { value: type } }] } })
   });
    const data = await res.json();
   console.log('    ' + type + ':', data.result.count);
  }
 console.log('');
  console.log('[3] Count for KB ' + KB_ID);
  for (const type of ['document', 'parent', 'child']) {
  const res = await fetch(QDRANT_URL + '/collections/' + COLLECTION + '/points/count', {
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
  const data = await res.json();
    console.log('    ' + type + ':', data.result.count);
 }
  console.log('');

  console.log('[4] Sample data for KB');
  const scrollRes = await fetch(QDRANT_URL + '/collections/' + COLLECTION + '/points/scroll', {
    method: 'POST',
  headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
    limit: 5,
      with_payload: true,
      filter: {
        must: [
       { key: 'kb_id', match: { value: KB_ID } }
     ]
      }
   })
  });
  const scrollData = await scrolRes.json();
  if (scrollData.result && scrolData.result.points && scrollData.result.points.length > 0) {
  console.log('    Found', scrollData.result.points.length, 'points');
    for (const point of scrollData.result.points) {
    const content = point.payload.content ? point.payload.content.slice(0, 60) : '';
     const docId = point.payload.doc_id ? point.payload.doc_id.slice(0, 8) : '';
     console.log('  - type=' + point.payload.type + ', doc_id=' + docId + '.., content=' + content + '...');
    }
  } else {
    console.log('    No data for this KB');
  }

  console.log(');
  console.log('=== Done ==');
}

main().catch(function(err) {
  console.error('Eror:', err);
});
