// Enhanced, reusable sidebar enhancer
(function(){
  try {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Extract existing links to preserve hrefs/icons/labels
    const existing = Array.from(sidebar.querySelectorAll('.menu a')).map(a=>({
      href: a.getAttribute('href'),
      label: (a.querySelector('.nav-label') ? a.querySelector('.nav-label').textContent : a.textContent).trim(),
      icon: a.querySelector('svg') ? a.querySelector('svg').outerHTML : ''
    }));

    const submenuMap = {
      './dashboard.html': [
        { href: './inbox.html', label: 'Inbox' }
      ],
      './orders.html': [
        { href: './orders.html#menu', label: 'Menu' }
      ],
      './analytics.html': [
        { href: './analytics.html#staff', label: 'Staff Performance' }
      ]
    };

    function normalizeHref(href) {
      if (!href) return '';
      const link = document.createElement('a');
      link.href = href;
      const path = link.pathname.split('/').pop() || 'dashboard.html';
      return path + (link.hash || '');
    }

    // Build enhanced sidebar
    const collapsed = localStorage.getItem('ls_sidebar_collapsed') === 'true';
    sidebar.classList.add('ls-sidebar');
    if (collapsed) sidebar.classList.add('collapsed');

    sidebar.innerHTML = `
      <div class="ls-top">
        <span class="logo">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 15h2V9H6v6zm4 4h2V5h-2v14zm4-8h2V9h-2v2zm4 6h2V7h-2v10z"/></svg>
        </span>
        <div class="brand">
          <span class="brand-name">LiveSupport</span>
        </div>
        <button class="ls-toggle" aria-label="Toggle sidebar">☰</button>
      </div>
      <div class="ls-menu-title">MENU</div>
      <nav class="ls-menu" role="navigation" aria-label="Main navigation"></nav>
    `;

    const menu = sidebar.querySelector('.ls-menu');

    function createMenuLink(href, label, icon = '', isSub = false) {
      const a = document.createElement('a');
      a.href = href || '#';
      a.className = isSub ? 'ls-sublink' : 'ls-link';
      if (isSub) {
        a.innerHTML = `<span class="ls-subdot"></span><span class="ls-label">${label}</span>`;
      } else {
        a.innerHTML = `${icon}<span class="ls-label">${label}</span>`;
      }
      return a;
    }

    existing.forEach(item => {
      const children = submenuMap[item.href] || [];
      if (!children.length) {
        menu.appendChild(createMenuLink(item.href, item.label, item.icon));
        return;
      }

      const group = document.createElement('div');
      group.className = 'ls-menu-group';

      const header = document.createElement('div');
      header.className = 'ls-group-header';

      const link = createMenuLink(item.href, item.label, item.icon);
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'ls-group-toggle';
      toggleBtn.setAttribute('aria-label', `Toggle ${item.label} submenu`);
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.innerHTML = '<span class="group-arrow"></span>';

      // Insert toggle inside the link
      link.appendChild(toggleBtn);
      
      header.appendChild(link);
      group.appendChild(header);

      const submenu = document.createElement('div');
      submenu.className = 'ls-submenu';
      children.forEach(child => {
        submenu.appendChild(createMenuLink(child.href, child.label, '', true));
      });
      group.appendChild(submenu);

      const savedOpen = localStorage.getItem(`ls_sidebar_group_${item.href}`);
      if (savedOpen === 'true') {
        group.classList.add('open');
        toggleBtn.setAttribute('aria-expanded', 'true');
      }

      toggleBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const isOpen = group.classList.toggle('open');
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
        localStorage.setItem(`ls_sidebar_group_${item.href}`, String(isOpen));
      });

      // Only prevent navigation when the submenu toggle is clicked.
      // Clicking the header link itself should still navigate to the page.
      link.addEventListener('click', (event) => {
        if (event.target.closest('.ls-group-toggle')) {
          event.preventDefault();
        }
      });

      menu.appendChild(group);
    });

    // Active highlighting
    function highlightActive(){
      const path = window.location.pathname.split('/').pop() || 'dashboard.html';
      const hash = window.location.hash || '';
      const currentFull = path + hash;

      Array.from(menu.querySelectorAll('.ls-menu-group')).forEach(group => {
        const headerLink = group.querySelector('.ls-link');
        const sublinks = Array.from(group.querySelectorAll('.ls-sublink'));
        const isHeaderActive = normalizeHref(headerLink.href) === currentFull;
        let childActive = false;
        sublinks.forEach(sublink => {
          const active = normalizeHref(sublink.href) === currentFull;
          sublink.classList.toggle('active', active);
          if (active) childActive = true;
        });
        const isActive = isHeaderActive || childActive;
        headerLink.classList.toggle('active', isActive);
        if (isActive) {
          group.classList.add('open');
        }
        const toggleBtn = group.querySelector('.ls-group-toggle');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(group.classList.contains('open')));
      });

      Array.from(menu.querySelectorAll('.ls-link')).forEach(link => {
        if (link.closest('.ls-menu-group')) return;
        const active = normalizeHref(link.href) === currentFull;
        link.classList.toggle('active', active);
      });
    }
    highlightActive();

    // Toggle collapse
    const toggle = sidebar.querySelector('.ls-toggle');
    toggle.addEventListener('click', ()=>{
      const isCollapsed = sidebar.classList.toggle('collapsed');
      localStorage.setItem('ls_sidebar_collapsed', isCollapsed);
    });

    // In-page nav slot: when the sidebar is collapsed, move any
    // element with class 'inpage-nav' (inside .main) into the sidebar
    // so it occupies the left-side position. Restore it when expanded.
    const inpageSlot = document.createElement('div');
    inpageSlot.className = 'ls-inpage-slot';
    sidebar.appendChild(inpageSlot);

    let movedInpage = null;
    let inpageOriginal = null;

    function moveInpageToSlot(){
      if(movedInpage) return; // already moved
      const inpage = document.querySelector('.main .inpage-nav');
      if(!inpage) return;
      inpageOriginal = { parent: inpage.parentNode, next: inpage.nextSibling };
      inpageSlot.appendChild(inpage);
      movedInpage = inpage;
    }

    function restoreInpage(){
      if(!movedInpage || !inpageOriginal) return;
      if(inpageOriginal.next) inpageOriginal.parent.insertBefore(movedInpage, inpageOriginal.next);
      else inpageOriginal.parent.appendChild(movedInpage);
      movedInpage = null; inpageOriginal = null;
    }

    // When links are clicked: collapse sidebar (so the three-dash remains)
    // and allow navigation to proceed. This mimics GitHub's behaviour.
    Array.from(menu.querySelectorAll('a')).forEach(a=>{
      a.addEventListener('click', ()=>{
        try{
          sidebar.classList.add('collapsed');
          localStorage.setItem('ls_sidebar_collapsed','true');
          // move any inpage nav into slot immediately for visual continuity
          moveInpageToSlot();
        }catch(e){/* ignore */}
      });
    });

    // Watch for collapse/expand state changes to move/restore inpage nav
    const obs = new MutationObserver(()=>{
      if(sidebar.classList.contains('collapsed')) moveInpageToSlot(); else restoreInpage();
    });
    obs.observe(sidebar, { attributes: true, attributeFilter: ['class'] });

    // If collapsed on load, ensure inpage nav (if any) is moved into slot
    if(sidebar.classList.contains('collapsed')) moveInpageToSlot();

    // Search/filter
    const input = sidebar.querySelector('.ls-search input');
    input.addEventListener('input', ()=>{
      const q = input.value.trim().toLowerCase();

      Array.from(menu.querySelectorAll('.ls-menu-group')).forEach(group => {
        const headerLink = group.querySelector('.ls-group-header .ls-link');
        const headerText = headerLink.querySelector('.ls-label')?.textContent?.toLowerCase() || '';
        let anyChildVisible = false;

        Array.from(group.querySelectorAll('.ls-sublink')).forEach(sublink => {
          const label = sublink.querySelector('.ls-label')?.textContent?.toLowerCase() || '';
          const visible = label.includes(q);
          sublink.style.display = visible ? '' : 'none';
          if (visible) anyChildVisible = true;
        });

        const headerVisible = headerText.includes(q);
        group.querySelector('.ls-group-header').style.display = headerVisible || anyChildVisible ? '' : 'none';

        if (anyChildVisible) {
          group.classList.add('open');
          const toggleBtn = group.querySelector('.ls-group-toggle');
          if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
        } else if (!headerVisible) {
          group.classList.remove('open');
          const toggleBtn = group.querySelector('.ls-group-toggle');
          if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
        }
      });

      Array.from(menu.querySelectorAll('a.ls-link')).forEach(link => {
        if (link.closest('.ls-menu-group')) return;
        const label = link.querySelector('.ls-label')?.textContent?.toLowerCase() || '';
        link.style.display = label.includes(q) ? '' : 'none';
      });
    });

    // Keyboard navigation (up/down) within menu
    sidebar.addEventListener('keydown', (e)=>{
      const links = Array.from(menu.querySelectorAll('a')).filter(a=>a.style.display !== 'none');
      if (!links.length) return;
      const idx = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = links[Math.min(links.length-1, Math.max(0, idx+1))];
        next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = links[Math.min(links.length-1, Math.max(0, idx-1))];
        prev.focus();
      }
    });

    // Note: footer (staff/logout) intentionally removed per UI preference.

  } catch (err) {
    console.error('sidebar enhancer error', err);
  }
})();

// Socket & notification bridge: show inbox-style `#notificationBar` when a staffNotification arrives
(function(){
  function initSocketBridge(){
    try{
      if(typeof io === 'undefined') return;
      const base = window.location.protocol === 'file:' ? 'http://localhost:3000' : undefined;
      const socket = io(base);
      socket.on('connect', ()=>{
        try{
          fetch(`${base || ''}/api/user`).then(r=>r.json()).then(u=>{
            if(u && (u.id || u.name)) socket.emit('agent:register', { userId: u.id, name: u.name || u.role || 'Agent', role: u.role || 'agent' });
          }).catch(()=>{});
        }catch(e){/* ignore */}
      });

      socket.on('staffNotification', (data)=>{
        try{
          const msg = data && data.message ? data.message : '';
          const from = data && data.from ? data.from : 'Staff';

          // If a page has the inbox-style bar (#notificationBar), reuse it
          const bar = document.getElementById('notificationBar');
          if(bar){
            const textEl = bar.querySelector('#notificationText') || bar.querySelector('[id^="notificationText"]');
            if(textEl) textEl.textContent = `${from}: ${msg}`;
            bar.style.display = 'block';
            const close = bar.querySelector('#closeNotification') || bar.querySelector('.close-btn');
            if(close) close.onclick = ()=>{ bar.style.display = 'none'; };
            setTimeout(()=>{ try{ bar.style.display='none'; }catch(e){} }, 6000);
            return;
          }

          // Fallback: create a global floating notification (used by app.js previously)
          let el = document.getElementById('globalStaffNotificationBar');
          if(!el){
            el = document.createElement('div'); el.id = 'globalStaffNotificationBar'; document.body.appendChild(el);
          }
          el.style.position = 'fixed'; el.style.top = '12px'; el.style.left = '50%'; el.style.transform = 'translateX(-50%)';
          el.style.zIndex = '99999'; el.style.maxWidth = '900px'; el.style.width = 'calc(100% - 40px)';
          el.style.padding = '12px 16px'; el.style.borderRadius = '8px'; el.style.boxShadow = '0 6px 18px rgba(2,6,23,0.08)';
          el.style.fontSize = '14px'; el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'space-between';
          el.style.gap = '12px'; el.style.background = '#0ea5a4'; el.style.color = 'white';
          el.innerHTML = `<div style="flex:1">${from}: ${msg}</div><button id="globalNotifyClose" style="background:transparent;border:none;color:white;font-size:18px;cursor:pointer">&times;</button>`;
          const closeBtn = document.getElementById('globalNotifyClose');
          if(closeBtn) closeBtn.onclick = ()=>{ el.style.display='none'; };
          el.style.display = 'flex';
          setTimeout(()=>{ try{ el.style.display='none'; }catch(e){} }, 6000);
        }catch(e){ console.error('sidebar staffNotification error', e); }
      });

    }catch(err){ console.error('sidebar socket bridge init error', err); }
  }

  // Wait for `io` to be available (socket.io client script may load after sidebar)
  if(typeof io === 'undefined'){
    const iv = setInterval(()=>{ if(typeof io !== 'undefined'){ clearInterval(iv); initSocketBridge(); } }, 200);
    // also try once on DOMContentLoaded as a fallback
    document.addEventListener('DOMContentLoaded', ()=>{ if(typeof io !== 'undefined') initSocketBridge(); });
  } else {
    initSocketBridge();
  }
})();
