const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const COLORS = {
  primary: '#0F172A',
  secondary: '#334155',
  accent: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  light: '#F8FAFC',
  muted: '#94A3B8',
  white: '#FFFFFF',
  border: '#E2E8F0'
};

function getStatusColor(status) {
  if (status === 'green') return COLORS.success;
  if (status === 'amber') return COLORS.warning;
  return COLORS.danger;
}

function getStatusEmoji(status) {
  if (status === 'green') return 'ON TRACK';
  if (status === 'amber') return 'ATTENTION';
  return 'ACTION NEEDED';
}

async function generateReportPDF(report, costs, occupancy, issues, arrears, incomeData) {
  return new Promise((resolve, reject) => {
    const outputDir = path.join(__dirname, '..', 'data', 'pdfs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const filename = `Report_${report.week_ending}_${Date.now()}.pdf`;
    const filepath = path.join(outputDir, filename);
    const stream = fs.createWriteStream(filepath);

    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 40,
      bufferPages: true,
      info: {
        Title: `Weekly Property Report - ${report.week_ending}`,
        Author: 'FFR & 52 Property Management',
        Creator: 'Property Report System'
      }
    });

    doc.pipe(stream);

    // --- COVER / HEADER ---
    doc.rect(0, 0, doc.page.width, 140).fill(COLORS.primary);
    doc.rect(0, 140, doc.page.width, 4).fill(COLORS.accent);
    
    doc.fontSize(28).fillColor(COLORS.white).font('Helvetica-Bold')
       .text('WEEKLY PROPERTY REPORT', 40, 35);
    doc.fontSize(13).fillColor(COLORS.muted).font('Helvetica')
       .text(`Week Ending: ${report.week_ending}`, 40, 72);
    doc.fontSize(11).fillColor(COLORS.muted)
       .text(`Submitted by: ${report.submitted_by}  |  ${new Date(report.submitted_at).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 40, 92);
    
    if (report.is_monthly) {
      doc.roundedRect(40, 112, 130, 22, 4).fill(COLORS.accent);
      doc.fontSize(10).fillColor(COLORS.white).font('Helvetica-Bold')
         .text('MONTHLY REPORT', 50, 117);
    }

    let y = 165;

    // --- TRAFFIC LIGHT SUMMARY ---
    doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold')
       .text('Traffic Light Summary', 40, y);
    y += 25;

    const trafficItems = [
      { label: '52 Old Elvet', status: report.status_52 },
      { label: 'FFR Group', status: report.status_ffr },
      { label: 'Cash Position', status: report.status_cash }
    ];

    trafficItems.forEach((item, i) => {
      const x = 40 + (i * 175);
      doc.roundedRect(x, y, 160, 45, 6).fill(COLORS.light);
      doc.circle(x + 20, y + 22, 8).fill(getStatusColor(item.status));
      doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica-Bold')
         .text(item.label, x + 35, y + 10, { width: 115 });
      doc.fontSize(8).fillColor(COLORS.secondary).font('Helvetica')
         .text(getStatusEmoji(item.status), x + 35, y + 26, { width: 115 });
    });

    y += 65;

    // --- GOALS REVIEW ---
    doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold')
       .text('Goals Review', 40, y);
    y += 22;

    // Previous goals
    if (report.prev_primary_goal) {
      doc.roundedRect(40, y, 515, 50, 4).fill(COLORS.light);
      const achieved = report.prev_primary_achieved ? '✓ ACHIEVED' : '✗ NOT ACHIEVED';
      const col = report.prev_primary_achieved ? COLORS.success : COLORS.danger;
      doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica').text('LAST WEEK PRIMARY GOAL', 52, y + 8);
      doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica-Bold').text(report.prev_primary_goal, 52, y + 22, { width: 380 });
      doc.fontSize(9).fillColor(col).font('Helvetica-Bold').text(achieved, 440, y + 18);
      y += 58;
    }

    if (report.prev_secondary_goal) {
      doc.roundedRect(40, y, 515, 50, 4).fill(COLORS.light);
      const achieved = report.prev_secondary_achieved ? '✓ ACHIEVED' : '✗ NOT ACHIEVED';
      const col = report.prev_secondary_achieved ? COLORS.success : COLORS.danger;
      doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica').text('LAST WEEK SECONDARY GOAL', 52, y + 8);
      doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica-Bold').text(report.prev_secondary_goal, 52, y + 22, { width: 380 });
      doc.fontSize(9).fillColor(col).font('Helvetica-Bold').text(achieved, 440, y + 18);
      y += 58;
    }

    // This week's goals
    if (report.primary_goal) {
      doc.roundedRect(40, y, 515, 40, 4).lineWidth(1).strokeColor(COLORS.accent).stroke();
      doc.fontSize(9).fillColor(COLORS.accent).font('Helvetica-Bold').text('THIS WEEK PRIMARY GOAL', 52, y + 8);
      doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica').text(report.primary_goal, 52, y + 22, { width: 490 });
      y += 48;
    }

    if (report.secondary_goal) {
      doc.roundedRect(40, y, 515, 40, 4).lineWidth(1).strokeColor(COLORS.accent).stroke();
      doc.fontSize(9).fillColor(COLORS.accent).font('Helvetica-Bold').text('THIS WEEK SECONDARY GOAL', 52, y + 8);
      doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica').text(report.secondary_goal, 52, y + 22, { width: 490 });
      y += 48;
    }

    // --- COSTS TABLE ---
    if (y > 620) { doc.addPage(); y = 40; }

    doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold')
       .text('Costs Breakdown', 40, y);
    y += 22;

    const maintenanceCosts = (costs || []).filter(c => c.category === 'maintenance');
    const operationalCosts = (costs || []).filter(c => c.category === 'operational');

    // Maintenance
    doc.fontSize(11).fillColor(COLORS.secondary).font('Helvetica-Bold')
       .text('Maintenance Costs', 40, y);
    y += 18;

    if (maintenanceCosts.length > 0) {
      // Header
      doc.rect(40, y, 515, 20).fill(COLORS.primary);
      doc.fontSize(8).fillColor(COLORS.white).font('Helvetica-Bold');
      doc.text('Date', 45, y + 6, { width: 65 });
      doc.text('Property', 110, y + 6, { width: 100 });
      doc.text('Description', 210, y + 6, { width: 140 });
      doc.text('Contractor', 350, y + 6, { width: 100 });
      doc.text('Amount', 460, y + 6, { width: 90, align: 'right' });
      y += 22;

      maintenanceCosts.forEach((cost, i) => {
        if (y > 740) { doc.addPage(); y = 40; }
        const bg = i % 2 === 0 ? COLORS.white : COLORS.light;
        doc.rect(40, y, 515, 18).fill(bg);
        doc.fontSize(8).fillColor(COLORS.secondary).font('Helvetica');
        doc.text(cost.date || '-', 45, y + 5, { width: 65 });
        doc.text(cost.property || '-', 110, y + 5, { width: 100 });
        doc.text(cost.description || '-', 210, y + 5, { width: 140 });
        doc.text(cost.contractor_supplier || '-', 350, y + 5, { width: 100 });
        doc.fontSize(8).fillColor(COLORS.primary).font('Helvetica-Bold');
        doc.text(`£${(cost.amount || 0).toFixed(2)}`, 460, y + 5, { width: 90, align: 'right' });
        y += 18;
      });

      const totalMaint = maintenanceCosts.reduce((s, c) => s + (c.amount || 0), 0);
      doc.rect(40, y, 515, 22).fill(COLORS.light);
      doc.fontSize(9).fillColor(COLORS.primary).font('Helvetica-Bold')
         .text('Total Maintenance', 45, y + 6);
      doc.text(`£${totalMaint.toFixed(2)}`, 460, y + 6, { width: 90, align: 'right' });
      y += 30;
    } else {
      doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica')
         .text('No maintenance costs recorded this week.', 45, y);
      y += 20;
    }

    // Operational
    if (y > 620) { doc.addPage(); y = 40; }
    doc.fontSize(11).fillColor(COLORS.secondary).font('Helvetica-Bold')
       .text('Operational Costs', 40, y);
    y += 18;

    if (operationalCosts.length > 0) {
      doc.rect(40, y, 515, 20).fill(COLORS.primary);
      doc.fontSize(8).fillColor(COLORS.white).font('Helvetica-Bold');
      doc.text('Date', 45, y + 6, { width: 65 });
      doc.text('Description', 110, y + 6, { width: 150 });
      doc.text('Supplier', 260, y + 6, { width: 100 });
      doc.text('Recurring', 370, y + 6, { width: 60 });
      doc.text('Amount', 460, y + 6, { width: 90, align: 'right' });
      y += 22;

      operationalCosts.forEach((cost, i) => {
        if (y > 740) { doc.addPage(); y = 40; }
        const bg = i % 2 === 0 ? COLORS.white : COLORS.light;
        doc.rect(40, y, 515, 18).fill(bg);
        doc.fontSize(8).fillColor(COLORS.secondary).font('Helvetica');
        doc.text(cost.date || '-', 45, y + 5, { width: 65 });
        doc.text(cost.description || '-', 110, y + 5, { width: 150 });
        doc.text(cost.contractor_supplier || '-', 260, y + 5, { width: 100 });
        doc.text(cost.is_recurring ? 'Yes' : 'No', 370, y + 5, { width: 60 });
        doc.fontSize(8).fillColor(COLORS.primary).font('Helvetica-Bold');
        doc.text(`£${(cost.amount || 0).toFixed(2)}`, 460, y + 5, { width: 90, align: 'right' });
        y += 18;
      });

      const totalOps = operationalCosts.reduce((s, c) => s + (c.amount || 0), 0);
      doc.rect(40, y, 515, 22).fill(COLORS.light);
      doc.fontSize(9).fillColor(COLORS.primary).font('Helvetica-Bold')
         .text('Total Operational', 45, y + 6);
      doc.text(`£${totalOps.toFixed(2)}`, 460, y + 6, { width: 90, align: 'right' });
      y += 30;
    } else {
      doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica')
         .text('No operational costs recorded this week.', 45, y);
      y += 20;
    }

    // --- TENANT PULSE ---
    if (y > 640) { doc.addPage(); y = 40; }
    doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold')
       .text('Tenant Pulse', 40, y);
    y += 22;

    const pulseItems = [
      { label: 'Complaints', value: report.tenant_complaints || 0 },
      { label: 'Compliments', value: report.tenant_compliments || 0 },
      { label: 'Inspections', value: `${report.inspections_done || 0}/${report.inspections_scheduled || 0}` },
      { label: 'Safeguarding', value: report.safeguarding_concerns ? 'YES' : 'None' }
    ];

    pulseItems.forEach((item, i) => {
      const x = 40 + (i * 130);
      doc.roundedRect(x, y, 120, 45, 4).fill(COLORS.light);
      doc.fontSize(18).fillColor(COLORS.primary).font('Helvetica-Bold')
         .text(String(item.value), x + 10, y + 6, { width: 100, align: 'center' });
      doc.fontSize(8).fillColor(COLORS.muted).font('Helvetica')
         .text(item.label, x + 10, y + 30, { width: 100, align: 'center' });
    });
    y += 55;

    if (report.tenant_complaints_summary) {
      doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica')
         .text(report.tenant_complaints_summary, 40, y, { width: 515 });
      y += doc.heightOfString(report.tenant_complaints_summary, { width: 515 }) + 10;
    }

    // --- AI SUMMARY ---
    if (report.ai_summary) {
      if (y > 580) { doc.addPage(); y = 40; }
      doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold')
         .text('AI-Generated Summary & Analysis', 40, y);
      y += 22;
      doc.roundedRect(40, y, 515, 3, 0).fill(COLORS.accent);
      y += 12;
      doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica')
         .text(report.ai_summary, 40, y, { width: 515, lineGap: 3 });
      y += doc.heightOfString(report.ai_summary, { width: 515, lineGap: 3 }) + 15;
    }

    // --- COMPLIANCE ---
    if (y > 580) { doc.addPage(); y = 40; }
    doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold')
       .text('Compliance & Risk', 40, y);
    y += 22;

    const complianceItems = [
      { label: 'Gas Safety', ok: report.compliance_gas },
      { label: 'Electrical', ok: report.compliance_electrical },
      { label: 'EPC Ratings', ok: report.compliance_epc },
      { label: 'Smoke/CO Detectors', ok: report.compliance_smoke_co },
      { label: 'HMO Licence', ok: report.compliance_hmo },
      { label: 'Insurance', ok: report.compliance_insurance },
      { label: 'Deposit Protection', ok: report.compliance_deposit },
      { label: 'Right to Rent', ok: report.compliance_right_to_rent }
    ];

    complianceItems.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 40 + (col * 260);
      const cy = y + (row * 22);
      const statusCol = item.ok ? COLORS.success : COLORS.danger;
      doc.circle(x + 8, cy + 7, 5).fill(statusCol);
      doc.fontSize(9).fillColor(COLORS.primary).font('Helvetica')
         .text(item.label, x + 20, cy + 2);
      doc.fontSize(8).fillColor(statusCol).font('Helvetica-Bold')
         .text(item.ok ? 'COMPLIANT' : 'NON-COMPLIANT', x + 150, cy + 2);
    });

    y += (Math.ceil(complianceItems.length / 2)) * 22 + 10;

    if (report.compliance_exceptions) {
      doc.fontSize(9).fillColor(COLORS.danger).font('Helvetica-Bold')
         .text('Exceptions: ', 40, y, { continued: true });
      doc.font('Helvetica').fillColor(COLORS.secondary)
         .text(report.compliance_exceptions);
      y += 20;
    }

    // --- MONTHLY SECTION ---
    if (report.is_monthly) {
      doc.addPage();
      y = 40;
      doc.rect(0, 0, doc.page.width, 50).fill(COLORS.accent);
      doc.fontSize(18).fillColor(COLORS.white).font('Helvetica-Bold')
         .text('MONTHLY SUMMARY', 40, 15);
      y = 65;

      if (report.monthly_pnl_summary) {
        doc.fontSize(12).fillColor(COLORS.primary).font('Helvetica-Bold').text('P&L Summary', 40, y);
        y += 18;
        doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica')
           .text(report.monthly_pnl_summary, 40, y, { width: 515, lineGap: 2 });
        y += doc.heightOfString(report.monthly_pnl_summary, { width: 515, lineGap: 2 }) + 15;
      }

      if (report.monthly_occupancy_trends) {
        doc.fontSize(12).fillColor(COLORS.primary).font('Helvetica-Bold').text('Occupancy Trends', 40, y);
        y += 18;
        doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica')
           .text(report.monthly_occupancy_trends, 40, y, { width: 515, lineGap: 2 });
        y += doc.heightOfString(report.monthly_occupancy_trends, { width: 515, lineGap: 2 }) + 15;
      }

      if (report.monthly_forward_look) {
        doc.fontSize(12).fillColor(COLORS.primary).font('Helvetica-Bold').text('3-Month Forward Look', 40, y);
        y += 18;
        doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica')
           .text(report.monthly_forward_look, 40, y, { width: 515, lineGap: 2 });
      }
    }

    // --- FOOTER on all pages ---
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.rect(0, doc.page.height - 30, doc.page.width, 30).fill(COLORS.light);
      doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
         .text(`FFR & 52 Property Management  |  Confidential  |  Page ${i + 1} of ${pageCount}`, 40, doc.page.height - 20, { width: 515, align: 'center' });
    }

    doc.end();

    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}

module.exports = { generateReportPDF };
