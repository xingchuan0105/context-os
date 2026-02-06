const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .not('deep_summary', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No K-Type processed documents found');
    process.exit(0);
  }

  const doc = data[0];
  console.log('=== Document Info ===');
  console.log('File:', doc.file_name);
  console.log('Created:', doc.created_at);
  console.log('Updated:', doc.updated_at);

  const created = new Date(doc.created_at);
  const updated = new Date(doc.updated_at);
  const duration = (updated - created) / 1000;
  console.log('Processing duration:', duration, 'seconds');

  console.log('\n=== K-Type Classification ===');
  if (doc.knowledge_graph) {
    console.log(JSON.stringify(doc.knowledge_graph, null, 2));
  }

  console.log('\n=== Deep Summary ===');
  if (doc.deep_summary) {
    const summaryStr = JSON.stringify(doc.deep_summary, null, 2);
    console.log(summaryStr.substring(0, 2000) + '...');
  }

  process.exit(0);
})();
