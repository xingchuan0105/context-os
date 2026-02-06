# Deployment Runbook (Server A + Server B)

## Required Inputs
- Domain names: `DOMAIN`, `WWW_DOMAIN`
- Cloudflare Origin cert + key (files at `/etc/nginx/ssl/<domain>.pem/.key`)
- API keys: `SILICONFLOW_API_KEY`, `DASHSCOPE_API_KEY`, `DEEPSEEK_API_KEY`
- App keys: `LITELLM_API_KEY`, `JWT_SECRET`
- Storage: `TENCENT_COS_SECRET_ID`, `TENCENT_COS_SECRET_KEY`, `TENCENT_COS_BUCKET`
- Qdrant internal IP for Server B

## Server B (Qdrant)
```bash
sudo /var/www/context-os/scripts/deploy/tencent-server-b-qdrant.sh
curl http://127.0.0.1:6333/
```

## Server A (App + LiteLLM + Nginx)
```bash
# Place Cloudflare Origin certs
sudo mkdir -p /etc/nginx/ssl
sudo tee /etc/nginx/ssl/contextlm.top.pem > /dev/null <<'EOF'
... your certificate ...
EOF
sudo tee /etc/nginx/ssl/contextlm.top.key > /dev/null <<'EOF'
... your private key ...
EOF
sudo chmod 600 /etc/nginx/ssl/contextlm.top.key

# Run deploy (SSL enabled; Cloudflare Origin cert)
sudo ENABLE_SSL=1 \
  SSL_CERT_PATH=/etc/nginx/ssl/contextlm.top.pem \
  SSL_KEY_PATH=/etc/nginx/ssl/contextlm.top.key \
  /var/www/context-os/scripts/deploy/tencent-server-a.sh
```

## Post-Deploy Configuration
```bash
sudo nano /etc/context-os/context-os.env
sudo nano /opt/context-os/litellm/.env
sudo systemctl restart context-os-api context-os-worker
docker compose -f /opt/context-os/litellm/docker-compose.yml restart
```

## Validation
```bash
sudo systemctl status context-os-api context-os-worker --no-pager
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:4410/health
curl -I https://contextlm.top
```

## Logs
```bash
tail -n 200 /var/log/context-os/api.log
tail -n 200 /var/log/context-os/worker.log
docker compose -f /opt/context-os/litellm/docker-compose.yml logs --tail 200
```
