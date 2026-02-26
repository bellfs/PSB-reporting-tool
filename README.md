# FFR & 52 Property Report System

A full-stack weekly property reporting app for the FFR & 52 Old Elvet property management team.

## 🏠 Features

- **Weekly Report Submission** — Step-by-step guided form with traffic lights, sliders, and toggles
- **Auto Goal Carry-Forward** — Last week's goals automatically pulled into this week's review
- **Cost Tracking** — Line-by-line maintenance and operational cost entry with property dropdowns
- **AI Report Generation** — OpenAI GPT-4o generates executive summaries from submitted data
- **PDF Export** — Professional PDF reports generated with PDFKit
- **Auto Email** — Reports auto-emailed to fergus@psb.properties on submission
- **Monthly Reporting** — Last Friday of each month triggers additional P&L / occupancy / forward look sections
- **Report History** — All reports stored in SQLite database and viewable in the app
- **Mobile Friendly** — Glassmorphism design with bottom navigation for mobile
- **Compliance Checklist** — Weekly compliance toggle tracking
- **Tenant Pulse** — Interactive sliders for complaints, compliments, inspections

## 📦 Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (single page app, glassmorphism design)
- **Backend**: Express.js (Node.js)
- **Database**: SQLite via sql.js
- **AI**: OpenAI GPT-4o
- **PDF**: PDFKit
- **Email**: Nodemailer

## 🚀 Deployment

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Edit `.env` file:
```
PORT=3000
OPENAI_API_KEY=sk-proj-your-key-here
OWNER_EMAIL=fergus@psb.properties
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-sending-email@gmail.com
SMTP_PASS=your-app-password
```

For Gmail, you need to create an [App Password](https://myaccount.google.com/apppasswords).

### 3. Run
```bash
npm start
```

The app will be available at `http://localhost:3000`.

### 4. Point your domain
Set `reporting.52oldelvet.com` DNS to your server. Use nginx/Caddy as reverse proxy.

Example Caddy config:
```
reporting.52oldelvet.com {
    reverse_proxy localhost:3000
}
```

### Google Drive Integration
To auto-save PDFs to Google Drive, you'll need to:
1. Create a Google Cloud service account
2. Share a folder with the service account email
3. Add credentials to `.env`

## 📋 Properties Included

### 52 Old Elvet
The Villiers, The Barrington, The Egerton, The Wolsey, The Tunstall, The Montague, The Morton, The Gray, The Langley, The Kirkham, The Fordham, The Talbot Penthouse, Communal Areas

### FFR Group (PSB Properties)
33 Old Elvet, Claypath House Flats 1-4, Flass Court Lower, Flass Court 2A/2B, Flass House Lower/Upper, 35 St Andrews Court, 7 The Cathedrals

## 👥 Team
- Andy (andy@psb.properties)
- Akiel (akiel@psb.properties)
- Hannah (hannah.winn@psb.properties)

Reports emailed to: fergus@psb.properties
