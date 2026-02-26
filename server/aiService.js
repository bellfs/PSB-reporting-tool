const OpenAI = require('openai');

let openai = null;

function getClient() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' });
  }
  return openai;
}

async function generateAIReport(report, costs, occupancy, issues, arrears) {
  const maintenanceCosts = (costs || []).filter(c => c.category === 'maintenance');
  const operationalCosts = (costs || []).filter(c => c.category === 'operational');
  const totalMaint = maintenanceCosts.reduce((s, c) => s + (c.amount || 0), 0);
  const totalOps = operationalCosts.reduce((s, c) => s + (c.amount || 0), 0);

  const prompt = `You are a property management analyst for FFR & 52 Old Elvet, a student property portfolio in Durham managing 24 properties (85-100 students). Generate a concise executive summary report.

DATA FOR THIS WEEK (ending ${report.week_ending}):

TRAFFIC LIGHT STATUS:
- 52 Old Elvet: ${report.status_52}
- FFR Group: ${report.status_ffr}
- Cash Position: ${report.status_cash}

PREVIOUS GOALS:
- Primary: "${report.prev_primary_goal || 'None set'}" - ${report.prev_primary_achieved ? 'ACHIEVED' : 'NOT ACHIEVED'}${report.prev_primary_note ? ' - Note: ' + report.prev_primary_note : ''}
- Secondary: "${report.prev_secondary_goal || 'None set'}" - ${report.prev_secondary_achieved ? 'ACHIEVED' : 'NOT ACHIEVED'}${report.prev_secondary_note ? ' - Note: ' + report.prev_secondary_note : ''}

THIS WEEK'S GOALS:
- Primary: "${report.primary_goal || 'Not set'}"
- Secondary: "${report.secondary_goal || 'Not set'}"

COSTS THIS WEEK:
- Maintenance: £${totalMaint.toFixed(2)} across ${maintenanceCosts.length} items
${maintenanceCosts.map(c => `  • ${c.description} at ${c.property || 'General'}: £${c.amount.toFixed(2)}${c.contractor_supplier ? ' (' + c.contractor_supplier + ')' : ''}`).join('\n')}
- Operational: £${totalOps.toFixed(2)} across ${operationalCosts.length} items
${operationalCosts.map(c => `  • ${c.description}: £${c.amount.toFixed(2)}${c.contractor_supplier ? ' (' + c.contractor_supplier + ')' : ''}`).join('\n')}
- Total spend: £${(totalMaint + totalOps).toFixed(2)}

TENANT PULSE:
- Complaints: ${report.tenant_complaints || 0}${report.tenant_complaints_summary ? ' - ' + report.tenant_complaints_summary : ''}
- Compliments: ${report.tenant_compliments || 0}
- Inspections: ${report.inspections_done || 0} of ${report.inspections_scheduled || 0}
- Safeguarding concerns: ${report.safeguarding_concerns ? 'YES - ' + report.safeguarding_detail : 'None'}

OPEN MAINTENANCE ISSUES: ${(issues || []).filter(i => !i.completed).length}
${(issues || []).filter(i => !i.completed).map(i => `  • ${i.property}: ${i.issue} (${i.status})`).join('\n')}

ARREARS: ${(arrears || []).length} tenants
${(arrears || []).map(a => `  • ${a.tenant_name} at ${a.property}: £${a.amount_owed.toFixed(2)} (${a.days_overdue} days overdue)`).join('\n')}

AOB: ${report.aob || 'None'}
FUTURE ISSUES: ${report.future_issues || 'None flagged'}

Please write a professional executive summary (300-500 words) that:
1. Opens with the overall health of the portfolio this week
2. Highlights key achievements or concerns
3. Summarises spending with any notable patterns
4. Flags any risk areas
5. Provides brief forward-looking recommendations
6. Ends with priority actions for the coming week

Write in a direct, professional British English style. Use £ for currency. Be specific with numbers.`;

  try {
    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a property management analyst writing executive summaries for a property portfolio owner. Be concise, data-driven, and actionable.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('AI generation error:', error);
    return `[AI Summary unavailable - ${error.message}]\n\nWeek ending ${report.week_ending}: Total spend £${(totalMaint + totalOps).toFixed(2)} (Maintenance: £${totalMaint.toFixed(2)}, Operational: £${totalOps.toFixed(2)}). ${maintenanceCosts.length + operationalCosts.length} cost items logged. ${(issues || []).filter(i => !i.completed).length} open maintenance issues. ${(arrears || []).length} arrears cases.`;
  }
}

async function generateMonthlySummary(report, allMonthCosts, allMonthOccupancy) {
  const prompt = `Generate a monthly property management summary for FFR & 52 Old Elvet portfolio. This is the end-of-month report for ${report.week_ending}. 

Provide three sections:
1. MONTHLY P&L SUMMARY - overview of income vs costs for the month
2. OCCUPANCY TRENDS - any patterns in occupancy, voids, viewings
3. 3-MONTH FORWARD LOOK - what to expect and prepare for

Month costs data: ${JSON.stringify(allMonthCosts || [])}
Occupancy data: ${JSON.stringify(allMonthOccupancy || [])}

Write concisely in British English, 200 words per section max.`;

  try {
    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a property management analyst. Write concise monthly summaries.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1200
    });
    return response.choices[0].message.content;
  } catch (error) {
    return `[Monthly AI summary unavailable - ${error.message}]`;
  }
}

module.exports = { generateAIReport, generateMonthlySummary };
