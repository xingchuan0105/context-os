import re
import json
from pathlib import Path

log_path = Path('.tmp-run.log')
text = log_path.read_text(encoding='utf-8', errors='ignore')

# 查找第一个包含 executive_summary 的 JSON 片段
m = re.search(r'\{\s*"executive_summary"\s*:\s*"([\s\S]*?)"\s*}', text)
if not m:
  print('not found')
  raise SystemExit(1)

summary = m.group(1)
print(summary)
