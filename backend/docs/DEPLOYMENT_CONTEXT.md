# Deployment Context (Tencent Cloud)

Recorded for reuse in deployment planning and scripts.

## Summary
- Architecture: two servers (A = app + LiteLLM + Redis + Nginx, B = Qdrant)
- Region: Hong Kong
- Database: SQLite
- Object storage: Tencent COS (bucket ready)
- Domain: www.contextlm.top (SSL cert ready)

## Servers
### Server A (App)
- OS: Debian 12.0
- CPU/RAM: 2 vCPU / 4 GB
- Disk: 60 GB SSD
- Public IP: 43.161.220.253
- Private IP: 10.5.0.17

### Server B (Qdrant)
- OS: Ubuntu Server 24.04 LTS (64-bit)
- CPU/RAM: 2 vCPU / 4 GB
- Disk: 40 GB SSD
- Public IP: 43.161.237.166
- Private IP: 10.5.4.5
- Qdrant: already installed

## Network
- Public: 22/80/443 on Server A
- Private: Server A -> Server B on 6333

## LLM
- LiteLLM: runs locally on Server A
- Provider keys: set in env files (test keys)

## Worker
- Single-task memory peak: ~130 MB
- Concurrency: adjustable based on memory headroom

## Structured Snapshot
```yaml
architecture:
  servers: 2
  roles:
    server_a: app + litellm + redis + nginx
    server_b: qdrant
region: hongkong
server_a:
  os: debian-12.0
  cpu: 2
  ram_gb: 4
  disk_gb: 60
  public_ip: 43.161.220.253
  private_ip: 10.5.0.17
server_b:
  os: ubuntu-24.04-lts
  cpu: 2
  ram_gb: 4
  disk_gb: 40
  public_ip: 43.161.237.166
  private_ip: 10.5.4.5
  qdrant: installed
domain:
  name: www.contextlm.top
  ssl_cert: ready
storage:
  sqlite: true
  cos_bucket_ready: true
llm:
  litellm_local: true
  provider_keys_in_env: true
worker:
  single_task_mem_peak_mb: 130
```
