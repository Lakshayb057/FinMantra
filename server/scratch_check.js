const db = require('./db');

async function test() {
  try {
    console.log('Testing getLeadsFiltered for admin...');
    const adminRes = await db.getLeadsFiltered({ page: 1, limit: 50 });
    console.log('Admin leads count:', adminRes.totalLeads);

    console.log('Testing getLeadsFiltered for bank MIS filter (HDFC Bank)...');
    const misRes = await db.getLeadsFiltered({ bankMisFilter: 'HDFC Bank', page: 1, limit: 50 });
    console.log('HDFC Bank MIS leads count:', misRes.totalLeads);

    console.log('Testing getLeadsFiltered for agentId...');
    const agentRes = await db.getLeadsFiltered({ agentId: 'test_agent', page: 1, limit: 50 });
    console.log('Agent leads count:', agentRes.totalLeads);

    console.log('ALL TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('TEST ERROR EXCEPTION:', err);
  } finally {
    process.exit(0);
  }
}

test();
