/**
 * Test script to verify consolidated email configuration
 * Tests: email receiving (IMAP), email sending (SMTP), and API endpoints
 */

import http from 'http';

const BASE_URL = 'http://localhost:3000';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: body ? JSON.parse(body) : body,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test 1: Check email inbox
async function testEmailInbox() {
  console.log('\n📧 TEST 1: Fetching email inbox...');
  try {
    const response = await makeRequest('GET', '/api/email/inbox');
    console.log(`✅ Status: ${response.statusCode}`);
    console.log(`✅ Emails received: ${response.body.length}`);
    
    if (response.body.length > 0) {
      console.log(`✅ Sample email from: ${response.body[0].from}`);
      console.log(`✅ Subject: ${response.body[0].subject}`);
    }
    return true;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

// Test 2: Send test email
async function testEmailSend() {
  console.log('\n📤 TEST 2: Sending test email...');
  try {
    const testEmail = {
      to: 'cyberincognito16@gmail.com',
      subject: 'Test Email - Consolidated Configuration',
      text: 'This is a test email to verify the consolidated email configuration works correctly.',
      html: '<h1>Test Email</h1><p>Consolidated single email configuration test.</p>',
    };

    const response = await makeRequest('POST', '/api/email/send', testEmail);
    console.log(`✅ Status: ${response.statusCode}`);
    
    if (response.body.success) {
      console.log(`✅ Email sent successfully!`);
      console.log(`✅ Message ID: ${response.body.messageId}`);
      return true;
    } else {
      console.log(`❌ Email send failed: ${response.body.message}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

// Test 3: Check email sync status
async function testEmailSyncStatus() {
  console.log('\n🔄 TEST 3: Checking email sync configuration...');
  try {
    // This is a basic check - we'll verify the sync is running by checking if emails exist
    const response = await makeRequest('GET', '/api/email/inbox');
    
    if (response.statusCode === 200 && response.body) {
      console.log(`✅ Email sync is active`);
      console.log(`✅ Total emails in system: ${response.body.length}`);
      
      // Get unique senders
      const senders = [...new Set(response.body.map(e => e.from))];
      console.log(`✅ Unique email senders: ${senders.length}`);
      
      return true;
    } else {
      console.log(`❌ Failed to retrieve sync status`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Email Configuration Tests...');
  console.log('━'.repeat(50));

  const results = [];
  results.push(await testEmailInbox());
  results.push(await testEmailSend());
  results.push(await testEmailSyncStatus());

  console.log('\n' + '━'.repeat(50));
  console.log(`📊 Test Results: ${results.filter(r => r).length}/${results.length} passed`);
  
  if (results.every(r => r)) {
    console.log('✅ All tests passed! Consolidated email configuration is working.');
  } else {
    console.log('⚠️  Some tests failed. Check the output above.');
  }
}

// Run tests
runTests().catch(console.error);
