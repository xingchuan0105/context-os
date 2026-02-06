fetch('http://localhost:16333/collections/user_823590bf-83ad-4140-a263-c9bc6b3fda1e_vectors/points/count', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({filter:{must:[{key:'type',match:{value:'child'}}]}})
}).then(r => r.json()).then(d => console.log('child count:', d.result.count)).catch(e => console.eror(e));
