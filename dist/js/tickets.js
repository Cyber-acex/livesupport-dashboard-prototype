// Tickets UI initialization
function initTickets() {
    const socket = io();

    const ticketList = document.getElementById("ticketList");
    const emptyState = document.getElementById("emptyState");
    const ticketNotificationBar = document.getElementById("ticketNotificationBar");
    const ticketNotificationText = document.getElementById("ticketNotificationText");

    if (!ticketList || !emptyState) {
        console.error("Required DOM elements not found. Check that ticketList and emptyState elements exist.");
        return;
    }

    let ticketsData = [];

    function saveNotification(message, source = 'Ticket', type = 'ticket') {
        try {
            const key = 'liveSupportNotifications';
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            list.unshift({ message, source, type, time: new Date().toISOString() });
            localStorage.setItem(key, JSON.stringify(list.slice(0, 25)));
        } catch (e) {
            console.error('Save notification failed', e);
        }
    }

    function showTicketNotification(message, variant = 'success') {
        if (!ticketNotificationBar || !ticketNotificationText) return;
        ticketNotificationText.textContent = message;
        ticketNotificationBar.style.background = variant === 'error' ? '#ef4444' : variant === 'warning' ? '#f59e0b' : '#10b981';
        ticketNotificationBar.style.display = "block";
        clearTimeout(showTicketNotification.timeout);
        showTicketNotification.timeout = setTimeout(() => {
            ticketNotificationBar.style.display = "none";
        }, 5000);
        saveNotification(message, 'Ticket', 'ticket');
    }

    function showImagePreview(imageSrc, title = 'Image Preview') {
        // Create modal if it doesn't exist
        let previewModal = document.getElementById('imagePreviewModal');
        if (!previewModal) {
            previewModal = document.createElement('div');
            previewModal.id = 'imagePreviewModal';
            previewModal.style.cssText = `
                display: none;
                position: fixed;
                z-index: 10000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.8);
                align-items: center;
                justify-content: center;
            `;
            previewModal.innerHTML = `
                <div style="position: relative; max-width: 90%; max-height: 90vh; display: flex; flex-direction: column; align-items: center;">
                    <span id="closeImagePreview" style="position: absolute; top: -30px; right: 0; color: white; font-size: 28px; font-weight: bold; cursor: pointer; transition: text-shadow 0.2s;">&times;</span>
                    <img id="previewImageContent" src="" alt="Preview" style="max-width: 100%; max-height: 85vh; object-fit: contain; border-radius: 8px;" />
                    <p id="previewImageTitle" style="color: white; margin-top: 16px; text-align: center; font-size: 14px;"></p>
                </div>
            `;
            document.body.appendChild(previewModal);

            document.getElementById('closeImagePreview').addEventListener('click', () => {
                previewModal.style.display = 'none';
            });

            previewModal.addEventListener('click', (e) => {
                if (e.target === previewModal) {
                    previewModal.style.display = 'none';
                }
            });

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && previewModal.style.display !== 'none') {
                    previewModal.style.display = 'none';
                }
            });
        }

        // Set image and title
        document.getElementById('previewImageContent').src = imageSrc;
        document.getElementById('previewImageTitle').textContent = title;
        previewModal.style.display = 'flex';
    }

    function renderTicketElement(ticket) {
        const div = document.createElement("div");
        div.classList.add("ticketItem");
        div.id = `ticket-${ticket.id}`;

        const statusText = ticket.status ? ticket.status : 'Open';
        const assigneeText = ticket.assignee ? `Assigned to: ${ticket.assignee}` : 'Unassigned';
        
        // Parse attachments if they exist
        let attachments = [];
        try {
            if (ticket.attachments) {
                attachments = typeof ticket.attachments === 'string' ? JSON.parse(ticket.attachments) : ticket.attachments;
            }
        } catch (e) {
            console.warn('Failed to parse attachments:', e);
        }
        
        // Check for image attachments
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
        const imageAttachments = attachments.filter(att => {
            const ext = att.originalname.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
            return imageExtensions.includes(ext);
        });
        
        const attachmentsHtml = imageAttachments.map(att => {
            return `<img class="ticket-attachment-preview" src="/uploads/${att.filename}" alt="${att.originalname}" style="cursor:pointer; max-width:150px; max-height:150px; border-radius:8px; margin:8px 4px 0 0; transition:transform 0.2s; border:2px solid #e5e7eb;" title="Click to preview: ${att.originalname}" data-filename="${att.filename}" data-originalname="${att.originalname}" />`;
        }).join('');
        
        div.innerHTML = `
            <div class="ticket-escalated-banner" style="display: ${ticket.escalated ? 'block' : 'none'}; background:#fee2e2; color:#991b1c; border-left:4px solid #b91c1c; padding:12px 16px; margin-bottom:12px; border-radius:12px; font-weight:700; text-align:center; letter-spacing:0.04em; ">ESCALATED</div>
            <div class="ticket-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display:flex;align-items:center;gap:10px">
                  <h4 style="margin:0">Ticket #${ticket.id} (${new Date(ticket.created_at).toLocaleString()})</h4>
                  <span class="status-badge" title="${statusText}" style="margin-left:8px;font-size:12px;padding:6px 8px;border-radius:999px;background:#eef2ff;color:#0f172a">${statusText}</span>
                  <span class="assignee-badge" title="${assigneeText}" style="font-size:12px;padding:6px 8px;border-radius:999px;background:#dbeafe;color:#1e40af">${assigneeText}</span>
                </div>
                <div>
                    <button class="escalateBtn" ${ticket.escalated ? 'disabled title="Already escalated"' : ''} style="background: ${ticket.escalated ? '#9f1239' : 'red'}; color: white; border: none; padding: 5px 10px; margin-right: 5px;">${ticket.escalated ? 'Escalated' : 'Escalate'}</button>
                    <button class="printTicketBtn" style="background: blue; color: white; border: none; padding: 5px 10px;">Print</button>
                    <button class="deleteTicketBtn" style="background: darkred; color: white; border: none; padding: 5px 10px; margin-left: 5px;">Delete</button>
                </div>
            </div>
            <div class="escalated-label" style="display: ${ticket.escalated ? 'block' : 'none'}; color: red; font-weight: bold; text-align: center; margin-bottom: 10px; font-size: 18px;">ESCALATED</div>
            <pre>${ticket.content}</pre>
            ${attachmentsHtml ? `<div class="ticket-attachments" style="margin-top:16px; padding-top:12px; border-top:1px solid #e5e7eb;">${attachmentsHtml}</div>` : ''}
        `;

        const escalateBtn = div.querySelector('.escalateBtn');
        escalateBtn.onclick = async () => {
            if (ticket.escalated) return;
            try {
                const response = await fetch("/api/escalate-ticket", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ticket_id: ticket.id })
                });
                const result = await response.json();
                if (!response.ok) {
                    showTicketNotification(result.error || 'Failed to escalate ticket.', 'error');
                    return;
                }
                ticket.escalated = true;
                const banner = div.querySelector('.ticket-escalated-banner');
                if (banner) banner.style.display = 'block';
                escalateBtn.disabled = true;
                escalateBtn.textContent = 'Escalated';
                escalateBtn.style.background = '#9f1239';
                showTicketNotification(`Ticket #${ticket.id} escalated.`, 'warning');
            } catch (error) {
                console.error('Escalate ticket error:', error);
                showTicketNotification('Failed to escalate ticket.', 'error');
            }
        };

        div.querySelector(".printTicketBtn").onclick = () => {
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow.document.write('<pre>' + ticket.content + '</pre>');
            printWindow.document.close();
            printWindow.print();
        };

        div.querySelector(".deleteTicketBtn").onclick = async () => {
            if (confirm("Are you sure you want to delete this ticket?")) {
                const deleteBtn = div.querySelector(".deleteTicketBtn");
                const originalText = deleteBtn.textContent;
                deleteBtn.disabled = true;
                deleteBtn.textContent = "Deleting...";
                
                try {
                    const response = await fetch(`/api/tickets/${ticket.id}`, { method: "DELETE" });
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        showTicketNotification(errorData.error || `Failed to delete ticket (${response.status})`, 'error');
                        deleteBtn.disabled = false;
                        deleteBtn.textContent = originalText;
                        return;
                    }
                    const result = await response.json();
                    showTicketNotification(`Ticket #${ticket.id} deleted successfully!`, 'success');
                    // Remove from UI immediately
                    ticketsData = ticketsData.filter(t => t.id !== ticket.id);
                    updateTicketListUI();
                } catch (error) {
                    console.error('Delete ticket error:', error);
                    showTicketNotification('Failed to delete ticket. Please try again.', 'error');
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = originalText;
                }
            }
        };

        // Add image preview listeners
        const imagePreview = div.querySelectorAll('.ticket-attachment-preview');
        imagePreview.forEach(img => {
            img.addEventListener('click', () => showImagePreview(img.src, img.title));
            img.addEventListener('mouseenter', () => img.style.transform = 'scale(1.05)');
            img.addEventListener('mouseleave', () => img.style.transform = 'scale(1)');
        });

        return div;
    }

    function updateTicketListUI() {
        ticketList.innerHTML = "";
        if (ticketsData.length === 0) {
            emptyState.style.display = "block";
            return;
        }
        emptyState.style.display = "none";
        ticketsData.forEach(ticket => ticketList.appendChild(renderTicketElement(ticket)));
    }

    async function loadTickets() {
        try {
            const res = await fetch("/api/tickets");
            if (!res.ok) {
                console.error("Failed to fetch tickets:", res.status);
                return;
            }
            const data = await res.json();
            ticketsData = data;
            updateTicketListUI();
        } catch (error) {
            console.error("Error loading tickets:", error);
        }
    }

    socket.on("ticketCreated", (ticket) => {
        ticketsData.unshift(ticket);
        updateTicketListUI();
        showTicketNotification(`Ticket #${ticket.id} created successfully!`);
    });

    socket.on("ticketDeleted", (data) => {
        ticketsData = ticketsData.filter(t => t.id !== data.id);
        updateTicketListUI();
        showTicketNotification(`Ticket #${data.id} deleted.`);
    });

    socket.on("ticketEscalated", (data) => {
        const ticket = ticketsData.find(t => t.id === data.ticket_id);
        if (ticket) {
            ticket.escalated = true;
            const ticketElement = document.getElementById(`ticket-${ticket.id}`);
            if (ticketElement) {
                const escalatedBanner = ticketElement.querySelector('.ticket-escalated-banner');
                const escalatedLabel = ticketElement.querySelector('.escalated-label');
                const escalateBtn = ticketElement.querySelector('.escalateBtn');
                if (escalatedBanner) escalatedBanner.style.display = 'block';
                if (escalatedLabel) escalatedLabel.style.display = 'block';
                if (escalateBtn) {
                    escalateBtn.disabled = true;
                    escalateBtn.textContent = 'Escalated';
                    escalateBtn.style.background = '#9f1239';
                }
            }
        }
    });

    socket.on('staffNotification', (data) => {
        if (data && data.message) {
            const variant = data.type === 'ticket-escalation' ? 'error' : 'success';
            showTicketNotification(data.message, variant);
        }
    });

    socket.on("ticketResolved", (data) => {
        const ticket = ticketsData.find(t => t.id === data.ticket_id);
        if (ticket) {
            ticket.status = 'Resolved';
            const ticketElement = document.getElementById(`ticket-${ticket.id}`);
            if (ticketElement) {
                const statusEl = ticketElement.querySelector('.status-badge');
                if (statusEl) { statusEl.textContent = 'Resolved'; statusEl.setAttribute('title','Resolved'); statusEl.style.background = '#bbf7d0'; statusEl.style.color = '#065f46'; }
            }
            if (data && data.resolved_by) showTicketNotification(`Ticket #${data.ticket_id} resolved by ${data.resolved_by}`);
            else showTicketNotification(`Ticket #${data.ticket_id} marked resolved`);
        }
    });

    loadTickets();
}

// Wait for DOM ready then init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTickets);
} else {
    initTickets();
}