he # Bug Fix: AI Incorrectly Rejecting Customer Messages When Images Are Sent

## Problem
When customers sent image attachments (via Messenger or WhatsApp) **without accompanying text**, the system was incorrectly responding:
```
"I'm sorry, but I can't process image messages directly. Could you please describe what you'd like to order or share the details in text? I'm happy to help!"
```

This happened even when the customer didn't explicitly mention sending an image - they were just sending a photo attachment.

## Root Cause
Both the **Messenger webhook** and **WhatsApp webhook** handlers had the same issue:

### Messenger (server.js, line 5863)
```javascript
// OLD CODE - PROBLEMATIC
if (!messageText && Array.isArray(message.attachments) && message.attachments.length > 0) {
    messageText = message.attachments[0].payload?.url || message.attachments[0].type || '[Attachment]';
}
```

When a customer sent an image without text:
1. The system extracted `message.attachments[0].type` → `"image"`
2. This became the `messageText` sent to the AI
3. The Mistral AI model saw `"image"` as the customer message and responded thinking the customer sent an image message

### WhatsApp (server.js, line 5764)
```javascript
// OLD CODE - PROBLEMATIC
if (!text) {
    text = msg.image?.caption || msg.document?.filename || msg.button?.text || msg.interactive?.type || "[Non-text message]";
}
```

Same issue - attachment metadata was being sent to the AI as the customer message.

## Solution
Both webhook handlers now:

1. **Detect attachment-only messages** - Check if there's an attachment but NO actual text content
2. **Prevent metadata from being sent to AI** - Don't extract attachment type/URL as message text
3. **Send a friendly response immediately** - Ask the customer to describe what they want to share

### Messenger Fix (server.js)
```javascript
// NEW CODE - FIXED
let hasAttachmentOnly = false;
if (!messageText && Array.isArray(message.attachments) && message.attachments.length > 0) {
    hasAttachmentOnly = true;
    messageText = ''; // Don't send attachment metadata to AI
}

// Handle attachment-only messages
if (hasAttachmentOnly && !messageText && senderType === 'received') {
    console.log('📎 Customer sent attachment without text, requesting description', { conversationIdValue });
    await sendAutoReply(conversationIdValue, 
        "I'm sorry, but I can't process attachments directly. Could you please describe what you'd like to share in text? For example, if you took a photo of a menu item, just tell me the name and I'm happy to help!", 
        platform);
    return res.sendStatus(200);
}
```

### WhatsApp Fix (server.js)
```javascript
// NEW CODE - FIXED
let hasAttachmentOnly = false;
if (!text) {
    if (msg.image && !msg.image.caption && !text) {
        hasAttachmentOnly = true;
        text = '';
    } else if (msg.document && !msg.document.caption && !msg.document.filename && !text) {
        hasAttachmentOnly = true;
        text = '';
    } else if ((msg.video || msg.sticker) && !text) {
        hasAttachmentOnly = true;
        text = '';
    } else if (!hasAttachmentOnly) {
        text = msg.image?.caption || msg.document?.filename || msg.button?.text || msg.interactive?.type || "[Non-text message]";
    }
}

// Handle attachment-only messages
if (hasAttachmentOnly && !text && sender === 'received') {
    console.log('📎 Customer sent attachment without text, requesting description', { phone });
    await sendAutoReply(phone, 
        "I'm sorry, but I can't process attachments directly. Could you please describe what you'd like to share in text? For example, if you took a photo of a menu item, just tell me the name and I'm happy to help!");
    return res.sendStatus(200);
}
```

## Impact
- **Messenger**: Customers sending image-only messages will now get a clear, helpful response
- **WhatsApp**: Same fix applied for consistency
- **Web chat**: No impact (already forces text-only with `messageType: 'text'` and `attachments: []`)
- **AI Model**: Won't receive attachment metadata, preventing confusion

## Testing
To test this fix:
1. Send an image attachment via Messenger WITHOUT any text caption → Should get the helpful prompt
2. Send an image with a caption (e.g., "Is this available?") → Should be processed normally by AI
3. Send text after the friendly prompt → AI should respond normally to the text

## Files Modified
- `server.js` - Both Messenger and WhatsApp webhook handlers
