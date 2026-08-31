# Medsuite-eT — Pharmacy Management SaaS

> Medicine shop management for Bangladesh. **MySQL** backend via PHP REST API. PWA-ready, role-based.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind, shadcn/ui |
| Backend | **PHP 8+** + **MySQL 8** (`public/api/index.php`) |
| Auth | JWT (stored in browser `localStorage`) |

## Quick start

### 1. MySQL

```bash
mysql -u root -p < public/api/schema.sql
```

### 2. API config

```bash
cp public/api/config.example.php public/api/config.php
# Edit db_user, db_pass, jwt_secret
# Recommended config:
# 'db_host' => '127.0.0.1'     (use TCP instead of socket)
# 'db_user' => 'medsuite'
# 'db_pass' => 'medsuite_pass_123'
# 'jwt_secret' => 'your-secret-key-change-in-production'
```

### 3. First admin user

```bash
# Pre-seeded admin account (ready to use):
# Email: admin@eMed.com
# Password: (your admin password)

# Or create a new admin:
php public/api/seed-admin.php admin@yourpharmacy.com YourSecurePassword123
```

### 4. Run app

```bash
npm install
npm run dev
```

- Frontend: http://localhost:8080  
- API (proxied): `/api/index.php`
- Backend: http://127.0.0.1:8090

## Environment

Copy `.env.example` → `.env`:

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API path (default `/api/index.php`) |

## Deployment (cPanel)

1. Build: `npm run build`
2. Upload `dist/`, `public/api/`, `public/uploads/`, `.htaccess`
3. Copy `config.example.php` → `config.php`, set MySQL credentials
4. Import `public/api/schema.sql` in phpMyAdmin

## What is NOT in this repo

- No **Supabase** — removed intentionally (MySQL only)
- `public/api/config.php` and `.env` are gitignored

## License

© 2025 Medsuite-eT. Made with 💙 by [engineersTech](https://engineerstechbd.com)
