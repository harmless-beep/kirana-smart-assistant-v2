# Kirana Smart Assistant — Oracle Cloud Free VM Deployment Guide

Step-by-step guide to deploy the app on an Oracle Cloud Always Free tier VM (Ubuntu 22.04/24.04).

---

## Prerequisites

- Oracle Cloud Free Tier account (always free VM: 1–4 OCPUs, 1–24 GB RAM)
- VM running **Ubuntu 22.04** or **24.04** (ARM or AMD)
- SSH key pair for access
- A domain name (optional, but recommended for SSL)

---

## Step 1: SSH into Your VM

```bash
ssh -i ~/.ssh/your-key.pem ubuntu@<YOUR_VM_PUBLIC_IP>
```

Replace `<YOUR_VM_PUBLIC_IP>` with your instance's public IP from the Oracle Cloud console.

---

## Step 2: Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Step 3: Install Docker and Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh

# Add your user to the docker group (avoid using sudo for docker commands)
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
exit
```

SSH back in, then verify:

```bash
docker --version
# Should show: Docker version 24.x or later

# Install Docker Compose plugin (usually included, but verify)
docker compose version
# Should show: Docker Compose version v2.x.x
```

---

## Step 4: Clone the Repository

```bash
cd /home/ubuntu
git clone https://github.com/your-username/kirana-smart-assistant.git
cd kirana-smart-assistant
```

---

## Step 5: Create the `.env` File

```bash
cp .env.example .env
nano .env
```

Fill in production values:

```env
# --- Database ---
POSTGRES_USER=kirana
POSTGRES_PASSWORD=<GENERATE_A_STRONG_PASSWORD>
POSTGRES_DB=kirana_db
DATABASE_URL=postgresql://kirana:<GENERATE_A_STRONG_PASSWORD>@db:5432/kirana_db

# --- Authentication ---
JWT_SECRET_KEY=<GENERATE_A_STRONG_RANDOM_KEY>

# --- CORS ---
CORS_ORIGINS=https://your-domain.com,http://your-vm-ip

# --- AI Assistant (optional, for future Perplexity integration) ---
PERPLEXITY_API_KEY=
PERPLEXITY_MODEL=llama-3.1-sonar-small-128k-online

# --- App ---
APP_PORT=8000
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

**Generate strong values with:**

```bash
# Strong random password (32 chars)
openssl rand -base64 32

# JWT secret key (64 chars)
openssl rand -base64 64
```

> **IMPORTANT:** Replace `<GENERATE_A_STRONG_PASSWORD>` and `<GENERATE_A_STRONG_RANDOM_KEY>` with the actual generated values. Never commit `.env` to git.

---

## Step 6: Build and Start Services

```bash
docker compose up -d --build
```

This will:
1. Build the frontend (Node.js 20)
2. Build the backend (Python 3.11)
3. Start PostgreSQL 16
4. Run database migrations on startup

Verify everything is running:

```bash
docker compose ps
# Should show both "kirana-db" and "kirana-app" as "Up"

docker compose logs app --tail=50
# Check for startup errors
```

---

## Step 7: Open Firewall Ports

### Oracle Cloud Security List (Cloud Console)

1. Go to **Oracle Cloud Console → Compute → Instances → Your Instance**
2. Click the **Virtual Cloud Network** link
3. Click **Security Lists** under the subnet
4. Add the following **Ingress Rules**:

| Protocol | Source    | Destination Port | Description        |
|----------|-----------|-------------------|--------------------|
| TCP      | 0.0.0.0/0 | 80                | HTTP               |
| TCP      | 0.0.0.0/0 | 443               | HTTPS              |
| TCP      | 0.0.0.0/0 | 8000              | App (direct access)|

### UFW (VM-level firewall)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8000/tcp
sudo ufw enable
sudo ufw status
```

---

## Step 8: Verify the App

```bash
# Test from the VM itself
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","database":"connected","uploads_dir":"/app/uploads"}
```

Open in browser: `http://<YOUR_VM_PUBLIC_IP>:8000`

You should see the API docs at `http://<YOUR_VM_PUBLIC_IP>:8000/docs`

---

## Step 9: Set Up Nginx Reverse Proxy (Recommended)

This gives you a clean URL and is required for SSL.

```bash
sudo apt install -y nginx
```

Create the Nginx config:

```bash
sudo tee /etc/nginx/sites-available/kirana > /dev/null << 'EOF'
server {
    listen 80;
    server_name your-domain.com your-vm-ip;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/kirana /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
sudo nginx -t                              # Test config
sudo systemctl restart nginx
```

Verify:

```bash
curl -I http://localhost
# Should show HTTP 200 via Nginx
```

---

## Step 10: Set Up SSL with Let's Encrypt (Optional)

If you have a domain pointed to your VM:

```bash
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically. Verify with:
sudo certbot renew --dry-run
```

After SSL, update your CORS_ORIGINS in `.env`:

```env
CORS_ORIGINS=https://your-domain.com
```

Then restart:

```bash
docker compose up -d
sudo systemctl restart nginx
```

---

## Updating / Redeploying

```bash
cd /home/ubuntu/kirana-smart-assistant

# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose up -d --build

# Verify
docker compose logs app --tail=20
```

---

## Viewing Logs

```bash
# App logs
docker compose logs app -f

# Database logs
docker compose logs db -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## Backup Database

```bash
docker compose exec db pg_dump -U kirana kirana_db > backup_$(date +%Y%m%d).sql
```

## Restore Database

```bash
cat backup_20260714.sql | docker compose exec -T db psql -U kirana kirana_db
```

---

## Troubleshooting

### App won't start

```bash
docker compose logs app --tail=100
```

Common issues:
- **`JWT_SECRET_KEY` not set**: Ensure `.env` has a value for `JWT_SECRET_KEY`
- **Database not ready**: The `depends_on` with healthcheck should handle this, but if it persists:
  ```bash
  docker compose down -v   # Remove volumes too
  docker compose up -d --build
  ```
- **Port 8000 already in use**: Check with `sudo lsof -i :8000` and kill the process

### Database connection errors

```bash
# Check if postgres is healthy
docker compose exec db pg_isready -U kirana

# Reset the database
docker compose down -v
docker compose up -d --build
```

### Frontend not loading (404 on static files)

```bash
# Check if frontend dist was built
docker compose exec app ls /app/static/
```

If empty, rebuild:

```bash
docker compose up -d --build --force-recreate app
```

### Permission denied errors

```bash
# Fix ownership
sudo chown -R $USER:$USER /home/ubuntu/kirana-smart-assistant
```

### Out of disk space (common on free tier)

```bash
# Clean up Docker resources
docker system prune -af
docker volume prune -f
```

### Nginx 502 Bad Gateway

```bash
# Check if app is running
docker compose ps
# Check Nginx config
sudo nginx -t
# Restart services
docker compose restart app
sudo systemctl restart nginx
```

---

## Architecture

```
                    Internet
                       │
                       ▼
                  ┌─────────┐
                  │  Nginx   │  :80 / :443
                  │  (SSL)   │
                  └────┬─────┘
                       │
                       ▼
              ┌─────────────────┐
              │  kirana-app     │  :8000 (internal)
              │  (FastAPI +     │
              │   static files) │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  kirana-db      │  :5432 (internal only)
              │  (PostgreSQL 16)│
              └─────────────────┘
```

- **PostgreSQL**: Not exposed to the internet — only accessible via Docker internal network
- **App**: Exposed on port 8000 directly, or via Nginx on 80/443
- **Nginx**: Handles SSL termination and reverse proxying

---

*Last updated: July 2026*
