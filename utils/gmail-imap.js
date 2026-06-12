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
      const searchCriteria = ['UNSEEN'];
      // Fetch with ALL to get the complete message body
      const fetchOptions = { bodies: '' };

      let results = await connection.search(searchCriteria, fetchOptions);
      
      if (results.length === 0) {
        await connection.end();
        return { success: true, emails: [] };
      }

      // Limit results
      results = results.slice(0, maxEmails);

      const emails = [];

      for (const item of results) {
        try {
          // item.parts[0] contains the raw email string, not a buffer object
          if (!item.parts || !item.parts[0]) {
            console.log('No parts for UID', item.attributes.uid);
            continue;
          }

          // item.parts[0] is already a string or buffer; convert to buffer if needed
          const emailRaw = item.parts[0];
          const emailBuffer = typeof emailRaw === 'string' ? Buffer.from(emailRaw, 'utf8') : emailRaw;

          // Create a readable stream from the buffer
          const emailStream = new Readable();
          emailStream.push(emailBuffer);
          emailStream.push(null); // Signal end of stream

          // Parse the email
          const parsed = await simpleParser(emailStream, {});

          const email = {
            id: item.attributes.uid,
            from: parsed.from?.text || 'Unknown',
            fromEmail: parsed.from?.value?.[0]?.address || '',
            to: process.env.IMAP_USER || process.env.EMAIL_USER,
            subject: parsed.subject || '(No Subject)',
            body: parsed.text || parsed.html || '',
            preview: (parsed.text || parsed.html || '').substring(0, 100),
            date: parsed.date ? new Date(parsed.date).toLocaleString() : new Date().toLocaleString(),
            unread: true
          };

          emails.push(email);
          console.log(`✅ Parsed email from ${email.fromEmail}: ${email.subject}`);

          // Mark as read
          try {
            await connection.addFlags(item.attributes.uid, ['\\Seen']);
          } catch (e) {
            console.log('Note: Could not mark email as read for UID', item.attributes.uid);
          }
        } catch (parseErr) {
          console.error('Error parsing email UID', item.attributes.uid, ':', parseErr.message);
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
