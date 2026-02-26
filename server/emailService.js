const nodemailer = require('nodemailer');
const path = require('path');

// Create transporter - configure with your SMTP settings
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendReportEmail(report, pdfPath, costs) {
  const maintenanceCosts = (costs || []).filter(c => c.category === 'maintenance');
  const operationalCosts = (costs || []).filter(c => c.category === 'operational');
  const totalMaint = maintenanceCosts.reduce((s, c) => s + (c.amount || 0), 0);
  const totalOps = operationalCosts.reduce((s, c) => s + (c.amount || 0), 0);

  const statusEmoji = (s) => s === 'green' ? '🟢' : s === 'amber' ? '🟡' : '🔴';

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 0;">
      <div style="background: #0F172A; padding: 30px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Weekly Property Report</h1>
        <p style="color: #94A3B8; margin: 8px 0 0; font-size: 14px;">Week Ending: ${report.week_ending} | Submitted by ${report.submitted_by}</p>
        ${report.is_monthly ? '<span style="background: #3B82F6; color: white; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">MONTHLY REPORT</span>' : ''}
      </div>
      
      <div style="background: #F8FAFC; padding: 24px; border: 1px solid #E2E8F0;">
        <h3 style="margin: 0 0 12px; color: #0F172A; font-size: 14px;">Traffic Light Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px;">${statusEmoji(report.status_52)} 52 Old Elvet</td>
            <td style="padding: 8px;">${statusEmoji(report.status_ffr)} FFR Group</td>
            <td style="padding: 8px;">${statusEmoji(report.status_cash)} Cash Position</td>
          </tr>
        </table>
      </div>

      <div style="padding: 24px; border: 1px solid #E2E8F0; border-top: none;">
        <h3 style="margin: 0 0 12px; color: #0F172A; font-size: 14px;">Goals</h3>
        ${report.prev_primary_goal ? `
          <p style="margin: 4px 0; font-size: 13px;"><strong>Last week primary:</strong> ${report.prev_primary_goal} ${report.prev_primary_achieved ? '✅' : '❌'}</p>
        ` : ''}
        ${report.prev_secondary_goal ? `
          <p style="margin: 4px 0; font-size: 13px;"><strong>Last week secondary:</strong> ${report.prev_secondary_goal} ${report.prev_secondary_achieved ? '✅' : '❌'}</p>
        ` : ''}
        <p style="margin: 12px 0 4px; font-size: 13px;"><strong>This week primary:</strong> ${report.primary_goal || 'Not set'}</p>
        <p style="margin: 4px 0; font-size: 13px;"><strong>This week secondary:</strong> ${report.secondary_goal || 'Not set'}</p>
      </div>

      <div style="padding: 24px; border: 1px solid #E2E8F0; border-top: none;">
        <h3 style="margin: 0 0 12px; color: #0F172A; font-size: 14px;">Weekly Spend</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="background: #F1F5F9;">
            <td style="padding: 8px; font-weight: 600;">Maintenance</td>
            <td style="padding: 8px; text-align: right; font-weight: 600;">£${totalMaint.toFixed(2)}</td>
          </tr>
          ${maintenanceCosts.map(c => `
            <tr><td style="padding: 4px 8px 4px 24px; color: #64748B;">${c.description} ${c.property ? '(' + c.property + ')' : ''}</td>
            <td style="padding: 4px 8px; text-align: right; color: #64748B;">£${c.amount.toFixed(2)}</td></tr>
          `).join('')}
          <tr style="background: #F1F5F9;">
            <td style="padding: 8px; font-weight: 600;">Operational</td>
            <td style="padding: 8px; text-align: right; font-weight: 600;">£${totalOps.toFixed(2)}</td>
          </tr>
          ${operationalCosts.map(c => `
            <tr><td style="padding: 4px 8px 4px 24px; color: #64748B;">${c.description}</td>
            <td style="padding: 4px 8px; text-align: right; color: #64748B;">£${c.amount.toFixed(2)}</td></tr>
          `).join('')}
          <tr style="background: #0F172A; color: white;">
            <td style="padding: 10px; font-weight: 700;">Total This Week</td>
            <td style="padding: 10px; text-align: right; font-weight: 700;">£${(totalMaint + totalOps).toFixed(2)}</td>
          </tr>
        </table>
      </div>

      ${report.ai_summary ? `
      <div style="padding: 24px; border: 1px solid #E2E8F0; border-top: none; background: #F0F9FF;">
        <h3 style="margin: 0 0 12px; color: #0F172A; font-size: 14px;">📊 AI Analysis</h3>
        <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.6; white-space: pre-line;">${report.ai_summary}</p>
      </div>
      ` : ''}

      <div style="background: #0F172A; padding: 16px 24px; border-radius: 0 0 12px 12px;">
        <p style="color: #94A3B8; margin: 0; font-size: 11px; text-align: center;">FFR & 52 Property Management | Confidential | Full PDF report attached</p>
      </div>
    </div>
  `;

  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Property Reports" <${process.env.SMTP_USER}>`,
      to: process.env.OWNER_EMAIL,
      subject: `${report.is_monthly ? '📅 MONTHLY ' : ''}📋 Property Report - Week Ending ${report.week_ending} | ${statusEmoji(report.status_52)} 52 ${statusEmoji(report.status_ffr)} FFR ${statusEmoji(report.status_cash)} Cash`,
      html: htmlBody,
      attachments: pdfPath ? [{
        filename: path.basename(pdfPath),
        path: pdfPath
      }] : []
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Report email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendReportEmail };
