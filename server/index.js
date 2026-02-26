require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDb } = require('./database');
const { generateAIReport, generateMonthlySummary } = require('./aiService');
const { generateReportPDF } = require('./pdfGenerator');
const { sendReportEmail } = require('./emailService');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Properties data
const PROPERTIES = {
  '52_old_elvet': [
    'The Villiers', 'The Barrington', 'The Egerton', 'The Wolsey',
    'The Tunstall', 'The Montague', 'The Morton', 'The Gray',
    'The Langley', 'The Kirkham', 'The Fordham', 'The Talbot Penthouse', 'Communal Areas'
  ],
  'ffr_group': [
    '33 Old Elvet', 'Claypath House Flat 1', 'Claypath House Flat 2',
    'Claypath House Flat 3', 'Claypath House Flat 4', 'Flass Court Lower',
    'Flass Court 2A', 'Flass Court 2B', 'Flass House Lower',
    'Flass House Upper', '35 St Andrews Court', '7 The Cathedrals'
  ]
};

const TEAM = [
  { name: 'Andy', email: 'andy@psb.properties' },
  { name: 'Akiel', email: 'akiel@psb.properties' },
  { name: 'Hannah', email: 'hannah.winn@psb.properties' }
];

// --- API Routes ---

// Get properties list
app.get('/api/properties', (req, res) => {
  res.json(PROPERTIES);
});

// Get team members
app.get('/api/team', (req, res) => {
  res.json(TEAM);
});

// Check if this week is end of month
app.get('/api/is-month-end', (req, res) => {
  const today = new Date();
  const friday = new Date(today);
  friday.setDate(friday.getDate() + (5 - friday.getDay() + 7) % 7);
  const nextFriday = new Date(friday);
  nextFriday.setDate(nextFriday.getDate() + 7);
  const isMonthEnd = friday.getMonth() !== nextFriday.getMonth();
  res.json({ isMonthEnd, weekEnding: friday.toISOString().split('T')[0] });
});

// Get previous week's goals (for auto-population)
app.get('/api/previous-goals', async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(`
      SELECT primary_goal, secondary_goal, week_ending 
      FROM reports 
      ORDER BY week_ending DESC, created_at DESC
      LIMIT 1
    `);
    
    if (result.length > 0 && result[0].values.length > 0) {
      const row = result[0].values[0];
      res.json({
        primary_goal: row[0],
        secondary_goal: row[1],
        week_ending: row[2]
      });
    } else {
      res.json({ primary_goal: null, secondary_goal: null, week_ending: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all reports (for history)
app.get('/api/reports', async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(`
      SELECT * FROM reports 
      ORDER BY week_ending DESC, created_at DESC
    `);
    
    if (result.length === 0) return res.json([]);
    
    const columns = result[0].columns;
    const reports = result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single report with all related data
app.get('/api/reports/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    
    const reportResult = db.exec(`SELECT * FROM reports WHERE id = '${id}'`);
    if (reportResult.length === 0 || reportResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const reportCols = reportResult[0].columns;
    const report = {};
    reportCols.forEach((col, i) => report[col] = reportResult[0].values[0][i]);

    // Get costs
    const costsResult = db.exec(`SELECT * FROM costs WHERE report_id = '${id}'`);
    const costs = costsResult.length > 0 ? costsResult[0].values.map(row => {
      const obj = {};
      costsResult[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];

    // Get occupancy
    const occResult = db.exec(`SELECT * FROM occupancy WHERE report_id = '${id}'`);
    const occupancy = occResult.length > 0 ? occResult[0].values.map(row => {
      const obj = {};
      occResult[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];

    // Get issues
    const issuesResult = db.exec(`SELECT * FROM maintenance_issues WHERE report_id = '${id}'`);
    const issues = issuesResult.length > 0 ? issuesResult[0].values.map(row => {
      const obj = {};
      issuesResult[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];

    // Get arrears
    const arrearsResult = db.exec(`SELECT * FROM arrears WHERE report_id = '${id}'`);
    const arrears = arrearsResult.length > 0 ? arrearsResult[0].values.map(row => {
      const obj = {};
      arrearsResult[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];

    // Get income
    const incomeResult = db.exec(`SELECT * FROM income WHERE report_id = '${id}'`);
    const income = incomeResult.length > 0 ? incomeResult[0].values.map(row => {
      const obj = {};
      incomeResult[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];

    res.json({ report, costs, occupancy, issues, arrears, income });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit a new report
app.post('/api/reports', async (req, res) => {
  try {
    const db = await getDb();
    const data = req.body;
    const reportId = uuidv4();
    
    // Insert report
    const v = (val) => val === undefined ? null : val;
    db.run(`INSERT INTO reports (
      id, week_ending, submitted_by, submitted_at, is_monthly,
      status_52, status_ffr, status_cash,
      primary_goal, secondary_goal,
      prev_primary_goal, prev_primary_achieved, prev_primary_note,
      prev_secondary_goal, prev_secondary_achieved, prev_secondary_note,
      tenant_complaints, tenant_complaints_summary, tenant_compliments,
      inspections_done, inspections_scheduled, safeguarding_concerns, safeguarding_detail,
      compliance_gas, compliance_electrical, compliance_epc, compliance_smoke_co,
      compliance_hmo, compliance_insurance, compliance_deposit, compliance_right_to_rent,
      compliance_exceptions, future_issues, aob,
      monthly_pnl_summary, monthly_occupancy_trends, monthly_forward_look
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      reportId, data.week_ending, data.submitted_by, new Date().toISOString(), data.is_monthly ? 1 : 0,
      v(data.status_52) || 'green', v(data.status_ffr) || 'green', v(data.status_cash) || 'green',
      v(data.primary_goal) || null, v(data.secondary_goal) || null,
      v(data.prev_primary_goal) || null, data.prev_primary_achieved ? 1 : 0, v(data.prev_primary_note) || null,
      v(data.prev_secondary_goal) || null, data.prev_secondary_achieved ? 1 : 0, v(data.prev_secondary_note) || null,
      data.tenant_complaints || 0, v(data.tenant_complaints_summary) || null, data.tenant_compliments || 0,
      data.inspections_done || 0, data.inspections_scheduled || 0, data.safeguarding_concerns ? 1 : 0, v(data.safeguarding_detail) || null,
      data.compliance_gas !== false ? 1 : 0, data.compliance_electrical !== false ? 1 : 0,
      data.compliance_epc !== false ? 1 : 0, data.compliance_smoke_co !== false ? 1 : 0,
      data.compliance_hmo !== false ? 1 : 0, data.compliance_insurance !== false ? 1 : 0,
      data.compliance_deposit !== false ? 1 : 0, data.compliance_right_to_rent !== false ? 1 : 0,
      v(data.compliance_exceptions) || null, v(data.future_issues) || null, v(data.aob) || null,
      v(data.monthly_pnl_summary) || null, v(data.monthly_occupancy_trends) || null, v(data.monthly_forward_look) || null
    ]);

    // Insert costs
    if (data.costs && data.costs.length > 0) {
      data.costs.forEach(cost => {
        db.run(`INSERT INTO costs (id, report_id, category, date, property, description, contractor_supplier, amount, is_budgeted, is_recurring, approved_by, notes, portfolio)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          uuidv4(), reportId, cost.category || 'maintenance', cost.date || null, cost.property || null, cost.description || '',
          cost.contractor_supplier || null, cost.amount || 0, cost.is_budgeted ? 1 : 0,
          cost.is_recurring ? 1 : 0, cost.approved_by || null, cost.notes || null, cost.portfolio || '52_old_elvet'
        ]);
      });
    }

    // Insert occupancy
    if (data.occupancy && data.occupancy.length > 0) {
      data.occupancy.forEach(occ => {
        db.run(`INSERT INTO occupancy (id, report_id, portfolio, total_units, occupied, vacant, ending_30_days, ending_60_days, viewings_booked, offers_in_progress)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          uuidv4(), reportId, occ.portfolio, occ.total_units || 0, occ.occupied || 0,
          occ.vacant || 0, occ.ending_30_days || 0, occ.ending_60_days || 0,
          occ.viewings_booked || 0, occ.offers_in_progress || 0
        ]);
      });
    }

    // Insert maintenance issues
    if (data.issues && data.issues.length > 0) {
      data.issues.forEach(issue => {
        db.run(`INSERT INTO maintenance_issues (id, report_id, property, issue, reported_date, contractor, status, eta, est_cost, actual_cost, completed, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          uuidv4(), reportId, issue.property, issue.issue, issue.reported_date,
          issue.contractor, issue.status || 'awaiting_quote', issue.eta,
          issue.est_cost || 0, issue.actual_cost || 0, issue.completed ? 1 : 0, issue.notes
        ]);
      });
    }

    // Insert arrears
    if (data.arrears && data.arrears.length > 0) {
      data.arrears.forEach(arrear => {
        db.run(`INSERT INTO arrears (id, report_id, tenant_name, property, amount_owed, days_overdue, action_taken, escalation_needed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
          uuidv4(), reportId, arrear.tenant_name, arrear.property,
          arrear.amount_owed || 0, arrear.days_overdue || 0,
          arrear.action_taken, arrear.escalation_needed ? 1 : 0
        ]);
      });
    }

    // Insert income
    if (data.income && data.income.length > 0) {
      data.income.forEach(inc => {
        db.run(`INSERT INTO income (id, report_id, portfolio, source, expected, received, outstanding, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
          uuidv4(), reportId, inc.portfolio, inc.source,
          inc.expected || 0, inc.received || 0, inc.outstanding || 0, inc.notes
        ]);
      });
    }

    saveDb();

    // Generate AI summary
    const costs = data.costs || [];
    const issues = data.issues || [];
    const arrears = data.arrears || [];

    let aiSummary = '';
    try {
      aiSummary = await generateAIReport(data, costs, data.occupancy, issues, arrears);
      db.run(`UPDATE reports SET ai_summary = ? WHERE id = ?`, [aiSummary, reportId]);
      
      if (data.is_monthly) {
        const monthlySummary = await generateMonthlySummary(data, costs, data.occupancy);
        db.run(`UPDATE reports SET monthly_pnl_summary = ? WHERE id = ?`, [monthlySummary, reportId]);
      }
      saveDb();
    } catch (e) {
      console.error('AI generation failed:', e);
    }

    // Get full report for PDF
    const fullReport = { ...data, id: reportId, ai_summary: aiSummary, submitted_at: new Date().toISOString() };

    // Generate PDF
    let pdfPath = null;
    try {
      pdfPath = await generateReportPDF(fullReport, costs, data.occupancy, issues, arrears, data.income);
      db.run(`UPDATE reports SET pdf_path = ? WHERE id = ?`, [pdfPath, reportId]);
      saveDb();
    } catch (e) {
      console.error('PDF generation failed:', e);
    }

    // Send email
    let emailResult = { success: false, error: 'Not attempted' };
    try {
      emailResult = await sendReportEmail(fullReport, pdfPath, costs);
    } catch (e) {
      console.error('Email send failed:', e);
    }

    res.json({ 
      success: true, 
      reportId, 
      aiSummary,
      pdfPath,
      emailSent: emailResult.success,
      emailError: emailResult.error
    });
  } catch (error) {
    console.error('Report submission error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate AI report for existing report
app.post('/api/reports/:id/generate-ai', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    
    // Get full report data
    const reportRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/reports/${id}`);
    const fullData = await reportRes.json();
    
    const aiSummary = await generateAIReport(fullData.report, fullData.costs, fullData.occupancy, fullData.issues, fullData.arrears);
    
    db.run(`UPDATE reports SET ai_summary = ? WHERE id = ?`, [aiSummary, id]);
    saveDb();
    
    res.json({ success: true, aiSummary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export report as PDF
app.get('/api/reports/:id/pdf', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    
    const reportResult = db.exec(`SELECT pdf_path FROM reports WHERE id = '${id}'`);
    if (reportResult.length > 0 && reportResult[0].values[0][0]) {
      const pdfPath = reportResult[0].values[0][0];
      const fs = require('fs');
      if (fs.existsSync(pdfPath)) {
        return res.download(pdfPath);
      }
    }
    
    // Generate new PDF if not exists
    const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/reports/${id}`);
    const fullData = await response.json();
    
    const pdfPath = await generateReportPDF(fullData.report, fullData.costs, fullData.occupancy, fullData.issues, fullData.arrears, fullData.income);
    db.run(`UPDATE reports SET pdf_path = ? WHERE id = ?`, [pdfPath, id]);
    saveDb();
    
    res.download(pdfPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard stats
app.get('/api/dashboard', async (req, res) => {
  try {
    const db = await getDb();
    
    const reportsResult = db.exec(`SELECT COUNT(*) as count FROM reports`);
    const totalReports = reportsResult.length > 0 ? reportsResult[0].values[0][0] : 0;
    
    const latestResult = db.exec(`SELECT * FROM reports ORDER BY week_ending DESC LIMIT 1`);
    let latestReport = null;
    if (latestResult.length > 0 && latestResult[0].values.length > 0) {
      latestReport = {};
      latestResult[0].columns.forEach((col, i) => latestReport[col] = latestResult[0].values[0][i]);
    }

    // Get total costs this month
    const monthStart = new Date();
    monthStart.setDate(1);
    const costsResult = db.exec(`
      SELECT SUM(amount) as total, category 
      FROM costs 
      WHERE date >= '${monthStart.toISOString().split('T')[0]}'
      GROUP BY category
    `);
    
    const monthCosts = { maintenance: 0, operational: 0 };
    if (costsResult.length > 0) {
      costsResult[0].values.forEach(row => {
        monthCosts[row[1]] = row[0] || 0;
      });
    }

    res.json({ totalReports, latestReport, monthCosts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve SPA for all non-API routes
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

async function start() {
  await getDb();
  app.listen(PORT, () => {
    console.log(`🏠 Property Report Server running on port ${PORT}`);
  });
}

start();
