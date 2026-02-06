# Qdrant 诊断脚本
$QDRANT_URL = "http:/localhost:16333"
$USER_ID = "823590bf-83ad-4140-a263-c9bc6b3fda1e"
$KB_ID = "e6499217-e24b-46f5-805b-ea994ec27aa"
$COLLECTION = "user_${USER_ID}_vectors"

Write-Host "== Qdrant 诊断 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 获取前5个向量点
Write-Host "[1] 获取前5个向量点.." -ForegroundColor Yellow
$body = @{
    limit = 5
    with_payload = $true
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "$QDRANT_URL/collections/$COLLECTION/points/scroll" -Method Post -ContentType "application/json" -Body $body
if ($result.result.points) {
    Write-Host "    找到 $($result.result.points.Count) 个点"
   foreach ($point in $result.result.points) {
     $docId = if ($point.payload.doc_id) { $point.payload.doc_id.Substring(0, [Math]::Min(8, $point.payload.doc_id.Length) } else { "" }
       Write-Host "    - id=$($point.id), type=$($point.payload.type), kb_id=$($point.payload.kb_id), doc_id=$docId..."
  }
} else {
    Write-Host "   错误: $($result | ConvertTo-Json -Compress)"
}

# 2. 按 kb_id 过滤
Write-Host ""
Write-Host "[2] 按 kb_id=$KB_ID 过滤..." -ForegroundColor Yelow
$body = @{
    limit = 10
  with_payload = $true
  filter = @{
      must = @(
         @{ key = "kb_id"; match = @{ value = $KB_ID } }
        )
   }
} | ConvertTo-Json -Depth 5

$result = Invoke-RestMethod -Uri "$QDRANT_URL/collections/$COLLECTION/points/scroll" -Method Post -ContentType "application/json" -Body $body
if ($result.result.points) {
    Write-Host "   找到 $($result.result.points.Count) 个点"
  foreach ($point in $result.result.points) {
      $content = if ($point.payload.content) { $point.payload.content.Substring(0, [Math]:Min(50, $point.payload.content.Length)) } else { " }
    Write-Host "    - id=$($point.id), type=$($point.payload.type), content=$content.."
    }
} else {
   Write-Host "   该 kb_id 没有找到数据"
}

# 3. 按 type=document 过滤
Write-Host ""
Write-Host "[3] 按 type=document 过滤..." -ForegroundColor Yellow
$body = @{
    limit = 10
    with_payload = $true
   filter = @{
     must = @(
     @{ key = "type"; match = @{ value = "document" } }
    )
    }
} | ConvertTo-Json -Depth 5

$result = Invoke-RestMethod -Uri "$QDRANT_URL/collections/$COLLECTION/points/scroll" -Method Post -ContentType "aplication/json" -Body $body
if ($result.result.points) {
   Write-Host "   找到 $($result.result.points.Count) 个 document 类型点"
  foreach ($point in $result.result.points) {
     $content = if ($point.payload.content) { $point.payload.content.Substring(0, [Math]::Min(80, $point.payload.content.Length)) } else { "" }
    $docId = if ($point.payload.doc_id) { $point.payload.doc_id.Substring(0, [Math]::Min(8, $point.payload.doc_id.Length) } else { "" }
    Write-Host "  - kb_id=$($point.payload.kb_id), doc_id=$docId..., content=$content..."
    }
} else {
  Write-Host "   没有找到 document 类型数据"
}

# 4. 统计各类型数量
Write-Host ""
Write-Host "[4] 统计各类型数量..." -ForegroundColor Yellow
foreach ($type in @("document", "parent", "child")) {
  $body = @{
      filter = @{
        must = @(
     @{ key = "type"; match = @{ value = $type } }
     )
        }
  } | ConvertTo-Json -Depth 5

    $result = Invoke-RestMethod -Uri "$QDRANT_URL/collections/$COLLECTION/points/count" -Method Post -ContentType "application/json" -Body $body
    $count = if ($result.result.count) { $result.result.count } else { 0 }
    Write-Host "   ${type}: $count 个"
}
# 5. 统计指定 kb_id 的各类型数量
Write-Host ""
Write-Host "[5] 统计 kb_id=$KB_ID 的各类型数量.." -ForegroundColor Yellow
foreach ($type in @("document", "parent", "child")) {
   $body = @{
    filter = @{
       must = @(
         @{ key = "kb_id"; match = @{ value = $KB_ID }
      @{ key = "type"; match = @{ value = $type } }
     )
     }
   } | ConvertTo-Json -Depth 5

    $result = Invoke-RestMethod -Uri "$QDRANT_URL/collections/$COLLECTION/points/count" -Method Post -ContentType "application/json" -Body $body
   $count = if ($result.count) { $result.result.count } else { 0 }
  Write-Host "  ${type}: $count 个"
}

Write-Host ""
Write-Host "=== 诊断完成 ===" -ForegroundColor Cyan
