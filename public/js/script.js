// Lightweight interactions for the new login page
document.addEventListener('DOMContentLoaded', () => {
    // subtle entrance animation for the login card
    const card = document.querySelector('.login-form-card');
    if (card) {
        card.style.opacity = 0;
        card.style.transform = 'translateY(8px)';
        requestAnimationFrame(() => {
            card.style.transition = 'opacity .6s ease, transform .6s cubic-bezier(.2,.9,.2,1)';
            card.style.opacity = 1;
            card.style.transform = 'translateY(0)';
        });
    }

    // parallax for floating chat cards (non-destructive)
    const hero = document.querySelector('.login-hero');
    if (hero) {
        hero.addEventListener('mousemove', e => {
            const rect = hero.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            document.querySelectorAll('.chat-card').forEach((c, i) => {
                const depth = (i + 1) * 6;
                c.style.transform = `translate(${x * depth}px, ${y * depth}px)`;
            });
        });
        hero.addEventListener('mouseleave', () => {
            document.querySelectorAll('.chat-card').forEach(c => c.style.transform = '');
        });
    }

    // small accessibility tweak: focus outlines for keyboard users
    document.querySelectorAll('button, a, input').forEach(el => {
        el.addEventListener('focus', () => el.classList.add('focus-visible'));
        el.addEventListener('blur', () => el.classList.remove('focus-visible'));
    });

    // ensure login card visible on load (help in case hero overlapped)
    const cardEl = document.querySelector('.login-form-card');
    if (cardEl) {
        setTimeout(() => {
            try { cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
        }, 200);
    }
});
