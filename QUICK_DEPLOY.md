# Quick Deploy to Netlify + Neon

## 5-Minute Setup

### 1. Create Neon Database (Free)
- Visit [neon.tech](https://neon.tech)
- Click "Create Project"
- Get connection string (copy it)

### 2. Run SQL in Neon Editor
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'customer'
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  price DECIMAL(10,2),
  quantity INT
);

INSERT INTO users (email, password, role) VALUES ('admin@eMed.com', '(your admin password)', 'admin');
INSERT INTO products (name, price, quantity) VALUES 
('Napa Extra', 50, 100),
('Aspirin', 30, 150),
('Amoxicillin', 200, 80),
('Lisinopril', 150, 60),
('Metformin', 180, 90);
```

### 3. Add to Netlify Environment
Go to [med-et.netlify.app](https://med-et.netlify.app)
- Settings → Build & deploy → Environment
- Add two variables:
  ```
  DATABASE_URL = your-neon-connection-string
  JWT_SECRET = any-random-string
  ```

### 4. Deploy
```bash
cd /home/tjms/Videos/med-suiteet-main
git add .
git commit -m "feat: Add Netlify Functions + Neon PostgreSQL backend"
git push origin master
```

### 5. Wait 3 Minutes
Netlify auto-deploys. Then test:
- Go to: https://med-et.netlify.app/auth
- Email: `admin@eMed.com`
- Password: `(your admin password)`
- Click Sign In ✅

---

## What's New

✅ Backend moved to **Netlify Functions** (Node.js)
✅ Database switched to **Neon** (PostgreSQL, free)
✅ No separate backend server needed
✅ Auto-scaling, no cold starts for development
✅ Everything in one Netlify site

---

## Files Added/Changed

- `netlify/functions/api.js` - Backend API endpoints
- `netlify/functions/db.js` - Database connection
- `netlify.toml` - Updated with functions config
- `.env.example` - Updated with new variables
- `NEON_NETLIFY_SETUP.md` - Detailed setup guide

---

## Architecture

```
med-et.netlify.app
├─ /auth, /products, etc. → React frontend (/dist)
└─ /.netlify/functions/api → Node.js backend
   └─ Neon PostgreSQL (free database)
```

All free. All on Netlify. One command to deploy.
