const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'reports.db');

let db = null;

async function getDb() {
  if (db) return db;
  
  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  initTables();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      week_ending TEXT NOT NULL,
      submitted_by TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      is_monthly INTEGER DEFAULT 0,
      status_52 TEXT DEFAULT 'green',
      status_ffr TEXT DEFAULT 'green',
      status_cash TEXT DEFAULT 'green',
      primary_goal TEXT,
      secondary_goal TEXT,
      prev_primary_goal TEXT,
      prev_primary_achieved INTEGER DEFAULT 0,
      prev_primary_note TEXT,
      prev_secondary_goal TEXT,
      prev_secondary_achieved INTEGER DEFAULT 0,
      prev_secondary_note TEXT,
      tenant_complaints INTEGER DEFAULT 0,
      tenant_complaints_summary TEXT,
      tenant_compliments INTEGER DEFAULT 0,
      inspections_done INTEGER DEFAULT 0,
      inspections_scheduled INTEGER DEFAULT 0,
      safeguarding_concerns INTEGER DEFAULT 0,
      safeguarding_detail TEXT,
      compliance_gas INTEGER DEFAULT 1,
      compliance_electrical INTEGER DEFAULT 1,
      compliance_epc INTEGER DEFAULT 1,
      compliance_smoke_co INTEGER DEFAULT 1,
      compliance_hmo INTEGER DEFAULT 1,
      compliance_insurance INTEGER DEFAULT 1,
      compliance_deposit INTEGER DEFAULT 1,
      compliance_right_to_rent INTEGER DEFAULT 1,
      compliance_exceptions TEXT,
      future_issues TEXT,
      aob TEXT,
      ai_summary TEXT,
      monthly_pnl_summary TEXT,
      monthly_occupancy_trends TEXT,
      monthly_forward_look TEXT,
      pdf_path TEXT,
      drive_file_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS costs (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      property TEXT,
      description TEXT NOT NULL,
      contractor_supplier TEXT,
      amount REAL NOT NULL,
      is_budgeted INTEGER DEFAULT 0,
      is_recurring INTEGER DEFAULT 0,
      approved_by TEXT,
      notes TEXT,
      portfolio TEXT DEFAULT '52_old_elvet',
      FOREIGN KEY (report_id) REFERENCES reports(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS occupancy (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      portfolio TEXT NOT NULL,
      total_units INTEGER DEFAULT 0,
      occupied INTEGER DEFAULT 0,
      vacant INTEGER DEFAULT 0,
      ending_30_days INTEGER DEFAULT 0,
      ending_60_days INTEGER DEFAULT 0,
      viewings_booked INTEGER DEFAULT 0,
      offers_in_progress INTEGER DEFAULT 0,
      FOREIGN KEY (report_id) REFERENCES reports(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS maintenance_issues (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      property TEXT NOT NULL,
      issue TEXT NOT NULL,
      reported_date TEXT,
      contractor TEXT,
      status TEXT DEFAULT 'awaiting_quote',
      eta TEXT,
      est_cost REAL DEFAULT 0,
      actual_cost REAL DEFAULT 0,
      completed INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (report_id) REFERENCES reports(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS arrears (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      tenant_name TEXT NOT NULL,
      property TEXT NOT NULL,
      amount_owed REAL NOT NULL,
      days_overdue INTEGER DEFAULT 0,
      action_taken TEXT,
      escalation_needed INTEGER DEFAULT 0,
      FOREIGN KEY (report_id) REFERENCES reports(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS income (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      portfolio TEXT NOT NULL,
      source TEXT NOT NULL,
      expected REAL DEFAULT 0,
      received REAL DEFAULT 0,
      outstanding REAL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (report_id) REFERENCES reports(id)
    )
  `);

  saveDb();
}

module.exports = { getDb, saveDb };
