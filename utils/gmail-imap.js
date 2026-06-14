import ImapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';
import { Readable } from 'stream';
import 'dotenv/config';

/**
 * Fetch unread emails from Gmail using IMAP
 */
export async function fetchGmailEmails(maxEmails = 20) {
  try {
    const config = {
      imap: {
        user: process.env.IMAP_USER || process.env.EMAIL_USER,
        password: process.env.IMAP_PASSWORD || process.env.EMAIL_PASSWORD,
        host: process.env.IMAP_HOST || 'imap.gmail.com',
        port: parseInt(process.env.IMAP_PORT || '993', 10),
        tls: (process.env.IMAP_TLS || 'true') === 'true',
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false }
      }
    };

    if (!config.imap.user || !config.imap.password) {
      return { success: false, error: 'IMAP_USER or IMAP_PASSWORD not configured' };
    }

    let connection;
    try {
      connection = await ImapSimple.connect(config);
    } catch (err) {
      console.error('Gmail IMAP connection failed:', err.message);
      return { success: false, error: 'Unable to connect to Gmail: ' + err.message };
    }

    try {
      // Search for unread emails in INBOX
      await connection.openBox('INBOX');
      // Search for ALL emails (both read and unread) - deduplication happens server-side
      const searchCriteria = ['ALL'];
      
      console.log('📬 Searching for ALL emails...');
      // Search returns array of objects with uid in attributes
      const results = await connection.search(searchCriteria);
      console.log(`📨 Found ${results.length} total emails in inbox`);
      
      if (results.length === 0) {
        console.log('No emails found');
        await connection.end();
        return { success: true, emails: [] };
      }

      // Extract UIDs and limit results
      let uids = results.slice(0, maxEmails).map(item => item.attributes.uid);

      const emails = [];

      // Get the underlying imap connection from imap-simple
      const imapConn = connection.imap;
      
      for (const uid of uids) {
        try {
          // Fetch using raw imap with callback approach
          const emailData = await new Promise((resolve, reject) => {
            const f = imapConn.fetch(uid, { bodies: '' });
            let buffer = '';
            
            f.on('message', (msg) => {
              msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
                stream.on('end', () => {
                  resolve(buffer);
                });
              });
            });
            
            f.on('error', reject);
            f.on('end', () => {
              if (!buffer) resolve('');
            });
          });

          if (!emailData) {
            console.log('No email data for UID', uid);
            continue;
          }

          // Parse the email using mailparser
          const stream = Readable.from([Buffer.from(emailData)]);
          const parsed = await simpleParser(stream, {});

          const email = {
            id: uid,
            from: parsed.from?.text || 'Unknown',
            fromEmail: parsed.from?.value?.[0]?.address || '',
            to: process.env.IMAP_USER || process.env.EMAIL_USER,
            subject: parsed.subject || '(No Subject)',
            body: parsed.text || parsed.html || '',
            preview: (parsed.text || parsed.html || '').substring(0, 100),
            date: parsed.date ? new Date(parsed.date).toLocaleString() : new Date().toLocaleString(),
            unread: true
          };

          if (email.fromEmail) {
            emails.push(email);
            console.log(`✅ Parsed email from ${email.fromEmail}: ${email.subject}`);
          }

          // Note: We don't mark as read so emails remain unread for subsequent syncs
          // This allows the deduplication logic in server.js to handle preventing duplicates
        } catch (parseErr) {
          console.error('Error parsing email UID', uid, ':', parseErr.message);
        }
      }

      await connection.end();
      return { success: true, emails };
    } catch (err) {
      await connection.end();
      console.error('Error fetching emails:', err.message);
      return { success: false, error: err.message };
    }
  } catch (err) {
    console.error('Gmail IMAP error:', err);
    return { success: false, error: err.message };
  }
}
