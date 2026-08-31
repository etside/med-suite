# Neon DB + Netlify Functions Setup

## Free Stack Overview
- **Frontend**: Netlify (free)
- **Backend**: Netlify Functions (Node.js, 125k req/month free)
- **Database**: Neon (PostgreSQL, free tier)
- **Total Cost**: $0/month

## Step 1: Create Neon DB Account

1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub
3. Create a new project: **med-suiteet**
4. Region: Choose closest to your users
5. Copy the connection string (looks like):
   ```
   postgresql://user:password@ep-tiny-lake-12345.us-east-1.neon.tech/neondb?sslmode=require
   ```

## Step 2: Create Database Schema

Run this in Neon's SQL editor:

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  price DECIMAL(10, 2),
  quantity INT DEFAULT 0,
  barcode VARCHAR(100),
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admin user
INSERT INTO users (email, password, role) 
VALUES ('admin@eMed.com', '(your admin password)', 'admin');

-- Insert sample products
INSERT INTO products (name, category, price, quantity) VALUES
('Napa Extra', 'Pain Relief', 50.00, 100),
('Aspirin', 'Pain Relief', 30.00, 150),
('Amoxicillin', 'Antibiotic', 200.00, 80),
('Lisinopril', 'Blood Pressure', 150.00, 60),
('Metformin', 'Diabetes', 180.00, 90),
('Cetirizine', 'Allergy', 80.00, 120),
('Omeprazole', 'Digestive', 120.00, 110),
('Vitamin B Complex', 'Supplement', 100.00, 200);
```

## Step 3: Get Connection String

In Neon dashboard:
- Click your project
- Copy the "Connection string" (Pooled connection recommended)
- Should look like:
  ```
  postgresql://neon_user:password@ep-something.neon.tech/medsuite_db?sslmode=require
  ```

## Step 4: Add to Netlify Environment

1. Go to [netlify.com](https://netlify.com) → Your site
2. **Settings** → **Build & deploy** → **Environment**
3. Add new variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | Generate random: `openssl rand -base64 32` |
| `VITE_API_URL` | `/.netlify/functions/api` |

Example:
```
DATABASE_URL=postgresql://user:pass@ep-tiny-lake.us-east-1.neon.tech/medsuite?sslmode=require
JWT_SECRET=abcdef123456789...
VITE_API_URL=/.netlify/functions/api
```

## Step 5: Deploy

1. Push to GitHub:
   ```bash
   git add .
   git commit -m "feat: Add Netlify Functions backend with Neon DB"
   git push origin master
   ```

2. Netlify auto-deploys
3. Wait 2-3 minutes for build to complete

## Step 6: Test Backend

Frontend will call:
- Login: `POST /.netlify/functions/api?action=login`
- Signup: `POST /.netlify/functions/api?action=signup`
- Products: `GET /.netlify/functions/api?action=products`
- User info: `GET /.netlify/functions/api?action=user`

Test login at: **https://med-et.netlify.app/auth**
- Email: `admin@eMed.com`
- Password: `(your admin password)`

## Architecture

```
Browser (med-et.netlify.app)
    ↓ (fetch to /.netlify/functions/api)
Netlify Functions (Node.js serverless)
    ↓ (PostgreSQL client)
Neon Database (Free PostgreSQL)
```

## Free Limits

| Service | Free Tier |
|---------|-----------|
| Netlify | 125k function calls/month |
| Neon DB | 5 projects, 3GB storage, always-free branch |
| Total | Unlimited projects, fully free |

## Cost if You Exceed Free

- Netlify Functions: $0.25 per 1M calls (usually fine)
- Neon DB: $0.16 per GB/month (very cheap)
- Total if max out: ~$30/month

## Environment Variables Explanation

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string from Neon |
| `JWT_SECRET` | Secret key for signing login tokens |
| `VITE_API_URL` | Frontend tells it to call local functions |

## Next Steps

✅ Setup Neon DB
✅ Add DATABASE_URL to Netlify
✅ Deploy code
✅ Test login

If login fails:
1. Check Neon connection string is correct
2. Verify admin user exists in database
3. Check Netlify Functions logs: **Functions** tab in Netlify dashboard

## Important Notes

⚠️ The current backend is **basic** - add these in production:
- Password hashing (bcrypt)
- Rate limiting
- Input validation
- Better error handling
- HTTPS only (Netlify provides this)

🔒 JWT tokens expire in 7 days - refresh tokens needed for production

💾 Neon auto-backs up your database - very reliable
