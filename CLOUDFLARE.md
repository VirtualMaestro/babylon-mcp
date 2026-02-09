# Alpine Linux Cloudflare Tunnel

## Setup

```bash
wget -O cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x ./cloudflared
mv cloudflared /usr/local/bin
cloudflared tunnel login
```

## Configuration

After login, create a tunnel and configure ingress in `~/.cloudflared/config.yml`:

```yaml
tunnel: <YOUR_TUNNEL_NAME>
credentials-file: /root/.cloudflared/<YOUR_TUNNEL_ID>.json

ingress:
  - hostname: <YOUR_HOSTNAME>
    service: http://localhost:4000
    originRequest:
  - service: http_status:404
```

Replace placeholders with your actual tunnel name, credentials file, and hostname.