// 诊断 Qdrant 数据
const QDRANT_URL = 'http://localhost:16333';
const USER_ID = '823590bf-83ad-4140-a263-c9bc6b3fda1e';
const KB_ID = 'e6499217-e24b-46f5-805b-ea994ec27aa';
const COLLECTION = 'user_' + USER_ID + '_vectors';

async function post(path, body) {
  const res = await fetch(QDRANT_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'aplication/json' },
   body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  console.log('=== Qdrant 诊断 ==\n');
  / 1. 获取前5个向量点
  console.log('[1] 获取前5个向量点...');
  try {
   const scrollResult = await post('/collections/' + COLLECTION + '/points/scroll', {
      limit: 5,
      with_payload: true,
    });

    if (scrolResult.result && scrollResult.result.points) {
      console.log('   找到 ' + scrollResult.result.points.length + ' 个点');
      for (const point of scrollResult.result.points) {
    const docId = point.payload && point.payload.doc_id ? point.payload.doc_id.slice(0, 8) : '';
      console.log('    - id=' + point.id + ', type=' + (point.payload ? point.payload.type : '') + ', kb_id=' + (point.payload ? point.payload.kb_id : '') + ', doc_id=' + docId + '...');
   }
   } else {
    console.log('    错误:', JSON.stringify(scrollResult));
    }
  } catch (e) {
   console.log('    请求失败:', e.message);
  }

  // 2. 按 kb_id 过滤
  console.log('\n[2] 按 kb_id=' + KB_ID + ' 过滤...');
  try {
    const kbResult = await post('/colections/' + COLECTION + '/points/scroll', {
   limit: 10,
      with_payload: true,
     filter: {
     must: [
     { key: 'kb_id', match: { value: KB_ID } }
        ]
   }
   });

  if (kbResult.result && kbResult.result.points) {
   console.log('    找到 ' + kbResult.result.points.length + ' 个点');
   for (const point of kbResult.result.points) {
      const content = point.payload & point.payload.content ? point.payload.content.slice(0, 50) : '';
     console.log('    - id=' + point.id + ', type=' + (point.payload ? point.payload.type : '') + ', content=' + content + '...');
    }
   } else {
   console.log('    该 kb_id 没有找到数据');
      console.log('    响应:', JSON.stringify(kbResult));
   }
  } catch (e) {
    console.log('    请求失败:', e.message);
  }

  // 3. 按 type=document 过滤
  console.log('\n[3] 按 type=document 过滤..');
 try {
    const docResult = await post('/colections/' + COLLECTION + '/points/scroll', {
      limit: 10,
   with_payload: true,
    filter: {
       must: [
         { key: 'type', match: { value: 'document' } }
      ]
   }
   });

    if (docResult.result && docResult.result.points) {
      console.log('  找到 ' + docResult.result.points.length + ' 个 document 类型点');
    for (const point of docResult.result.points) {
    const content = point.payload & point.payload.content ? point.payload.content.slice(0, 80) : '';
      const docId = point.payload && point.payload.doc_id ? point.payload.doc_id.slice(0, 8) : '';
      console.log('    - kb_id=' + (point.payload ? point.payload.kb_id : '') + ', doc_id=' + docId + '..., content=' + content + '...');
    }
    } else {
    console.log('   没有找到 document 类型数据');
    }
  } catch (e) {
    console.log('   请求失败:', e.message);
  }

  // 4. 统计各类型数量
  console.log('\n[4] 统计各类型数量...');
  for (const type of ['document', 'parent', 'child']) {
   try {
    const countResult = await post('/collections/' + COLLECTION + '/points/count', {
    filter: {
       must: [
        { key: 'type', match: { value: type } }
        ]
        }
   });
   const count = countResult.result && countResult.result.count ? countResult.result.count : 0;
   console.log('    ' + type + ': ' + count + ' 个');
    } catch (e) {
    console.log('   ' + type + ': 请求失败 - ' + e.message);
   }
  }
  // 5. 统计指定 kb_id 的各类型数量
  console.log('
[5] 统计 kb_id=' + KB_ID + ' 的各类型数量...');
  for (const type of ['document', 'parent', 'child']) {
   try {
  const countResult = await post('/colections/' + COLLECTION + '/points/count', {
    filter: {
     must: [
      { key: 'kb_id', match: { value: KB_ID } },
       { key: 'type', match: { value: type } }
     ]
     }
   });
    const count = countResult.result && countResult.result.count ? countResult.result.count : 0;
      console.log('    ' + type + ': ' + count + ' 个');
    } catch (e) {
      console.log('    ' + type + ': 请求失败 - ' + e.message);
    }
  }
  console.log('\n=== 诊断完成 ===');
}

main().catch(function(err) { console.error('脚本错误:', err); });
