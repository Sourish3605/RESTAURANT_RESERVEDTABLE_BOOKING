// Initialize AOS
if (window.AOS) AOS.init({ duration: 700, once: true });

// DOM helpers
const qs = (s, root=document) => root.querySelector(s);
const qsa = (s, root=document) => Array.from(root.querySelectorAll(s));

// Mobile menu toggle
const menuToggle = qs('#menu-toggle');
const mobileMenu = qs('#mobile-menu');
if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        if (mobileMenu.classList.contains('open')) {
            mobileMenu.classList.remove('open');
            mobileMenu.classList.add('hidden');
        } else {
            mobileMenu.classList.remove('hidden');
            // delay to allow CSS transition
            setTimeout(()=> mobileMenu.classList.add('open'), 10);
        }
    });
}

// Close mobile menu when clicking a link
qsa('#mobile-menu .nav-link').forEach(a => a.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    mobileMenu.classList.add('hidden');
    menuToggle.classList.remove('active');
}));

// Navbar style on scroll
const navbar = qs('#navbar');
const onScroll = () => {
    if (!navbar) return;
    if (window.scrollY > 60) navbar.classList.add('scrolled'); 
    else navbar.classList.remove('scrolled');
};
window.addEventListener('scroll', onScroll);
onScroll();

// Reservation form handling (simple front-end validation + toast)
const form = qs('#reservation-form');
const toast = qs('#toast');

function showToast(message, ms = 2800) {
    if (!toast) return;
    const box = qs('#toast .toast-box');
    if (box) box.textContent = message;
    // ensure it's visible in the DOM
    toast.classList.remove('hidden');
    // force reflow so animation triggers reliably
    void toast.offsetWidth;
    // add show class to animate container and the box
    toast.classList.add('show');
    // add a temporary pulse class so the box gets a subtle secondary animation
    if (box) {
        box.classList.remove('pulse');
        // force reflow before re-adding pulse
        void box.offsetWidth;
        box.classList.add('pulse');
    }

    // hide after ms: remove .show then add .hidden after animation finishes
    setTimeout(() => {
        toast.classList.remove('show');
        if (box) box.classList.remove('pulse');
        // wait for the exit animation (safe margin) before hiding
        setTimeout(() => toast.classList.add('hidden'), 420);
    }, ms);
}

// showConfirm: a Promise-based modal confirmation to replace native confirm()
function showConfirm(message, title = 'Please confirm') {
    return new Promise((resolve) => {
        const modal = qs('#confirm-modal');
        const msg = qs('#confirm-message');
        const ttl = qs('#confirm-title');
        const ok = qs('#confirm-ok');
        const cancel = qs('#confirm-cancel');

        if (!modal || !ok || !cancel || !msg || !ttl) { 
            resolve(false); 
            return; 
        }

        ttl.textContent = title;
        msg.textContent = message;

        // show
        modal.classList.add('open');
        modal.setAttribute('aria-hidden','false');

        // focus management: focus the cancel by default
        cancel.focus();

        // handlers
        const clean = () => {
            ok.removeEventListener('click', onOk);
            cancel.removeEventListener('click', onCancel);
            modal.removeEventListener('keydown', onKey);
        };

        const onOk = () => { 
            clean(); 
            modal.classList.remove('open'); 
            modal.setAttribute('aria-hidden','true'); 
            resolve(true); 
        };
        const onCancel = () => { 
            clean(); 
            modal.classList.remove('open'); 
            modal.setAttribute('aria-hidden','true'); 
            resolve(false); 
        };
        const onKey = (e) => {
            if (e.key === 'Escape') { onCancel(); }
            if (e.key === 'Enter') { onOk(); }
        };

        ok.addEventListener('click', onOk);
        cancel.addEventListener('click', onCancel);
        modal.addEventListener('keydown', onKey);
    });
}

// Reservations persistence helpers
const RES_KEY = 'dineeaseReservations';

function loadReservations() {
    try {
        const raw = localStorage.getItem(RES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { 
        return []; 
    }
}

function saveReservations(arr) {
    try { 
        localStorage.setItem(RES_KEY, JSON.stringify(arr)); 
    } catch (e) {}
}

function escapeHTML(s) { 
    return String(s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;'); 
}

function renderReservations() {
    const list = qs('#reservations-list');
    const none = qs('#no-reservations');
    if (!list || !none) return;
    const arr = loadReservations();
    list.innerHTML = '';
    if (!arr.length) {
        none.classList.remove('hidden');
        return;
    }
    none.classList.add('hidden');
    arr.slice().reverse().forEach(r => {
        const card = document.createElement('div');
        card.className = 'p-4 border rounded-lg shadow-sm flex justify-between items-start';
        const left = document.createElement('div');
        left.innerHTML = `<div class="font-semibold">${escapeHTML(r.name)}</div>
            <div class="text-sm text-gray-600">${escapeHTML(r.date)} at ${escapeHTML(r.time)} · ${escapeHTML(r.guests)} guests</div>
            <div class="text-sm text-gray-600">${escapeHTML(r.phone)} ${r.email? '· ' + escapeHTML(r.email): ''}</div>`;
        const right = document.createElement('div');
        right.className = 'text-right';
        const cancel = document.createElement('button');
        cancel.className = 'px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', async () => {
            const ok = await showConfirm('Cancel this reservation?', 'Cancel reservation');
            if (!ok) return;
            const all = loadReservations();
            const next = all.filter(x => x.id !== r.id);
            saveReservations(next);
            renderReservations();
            showToast('Reservation canceled');
        });
        right.appendChild(cancel);

        // Render orders attached to this reservation (from cart)
        try {
            const cartItems = loadCart().filter(ci => ci.reservationId === r.id);
            if (cartItems && cartItems.length) {
                const ordersDiv = document.createElement('div');
                ordersDiv.className = 'mt-3';
                const ordersTitle = document.createElement('div');
                ordersTitle.className = 'text-sm font-semibold mb-2';
                ordersTitle.textContent = 'Orders';
                ordersDiv.appendChild(ordersTitle);

                cartItems.forEach(it => {
                    const row = document.createElement('div');
                    row.className = 'flex items-center justify-between text-sm bg-transparent p-2 rounded mb-2';

                    const leftInfo = document.createElement('div');
                    leftInfo.innerHTML = `${escapeHTML(it.name)} <span class="text-gray-400">x${escapeHTML(String(it.qty || 1))}</span>`;

                    const rightGroup = document.createElement('div');
                    rightGroup.className = 'flex items-center gap-2';

                    const priceSpan = document.createElement('div');
                    priceSpan.className = 'text-amber-400';
                    priceSpan.textContent = it.price || '';

                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'px-2 py-1 text-xs bg-red-500 text-white rounded-md';
                    removeBtn.textContent = 'Remove';
                    removeBtn.addEventListener('click', () => {
                        const cart = loadCart();
                        const next = cart.filter(ci => ci.id !== it.id);
                        saveCart(next);
                        renderReservations();
                        showToast('Order removed');
                    });

                    rightGroup.appendChild(priceSpan);
                    rightGroup.appendChild(removeBtn);

                    row.appendChild(leftInfo);
                    row.appendChild(rightGroup);
                    ordersDiv.appendChild(row);
                });

                left.appendChild(ordersDiv);
            }
        } catch (err) {
            console.error('Error rendering orders for reservation', err);
        }

        card.appendChild(left);
        card.appendChild(right);
        list.appendChild(card);
    });
}

if (form) {
    form.addEventListener('submit', e => {
        e.preventDefault();
        // basic validation
        const name = qs('#name').value.trim();
        const phone = qs('#phone').value.trim();
        const date = qs('#date').value;
        const time = qs('#time').value;
        const guests = qs('#guests').value;

        let ok = true;
        // name
        if (!name) { qs('#name-error').classList.remove('hidden'); ok = false; } 
        else qs('#name-error').classList.add('hidden');
        // phone (very simple check)
        if (!phone || phone.length < 6) { qs('#phone-error').classList.remove('hidden'); ok = false; } 
        else qs('#phone-error').classList.add('hidden');
        // date
        if (!date) { qs('#date-error').classList.remove('hidden'); ok = false; } 
        else qs('#date-error').classList.add('hidden');
        // time
        if (!time) { qs('#time-error').classList.remove('hidden'); ok = false; } 
        else qs('#time-error').classList.add('hidden');
        // guests
        if (!guests) { qs('#guests-error').classList.remove('hidden'); ok = false; } 
        else qs('#guests-error').classList.add('hidden');

        if (!ok) {
            showToast('Please fix the highlighted fields.');
            return;
        }

        // create reservation object and persist
        const reservation = {
            id: Date.now().toString(),
            name, phone, date, time, guests,
            email: (qs('#email') && qs('#email').value.trim()) || '' ,
            created: new Date().toISOString()
        };
        const all = loadReservations();
        all.push(reservation);
        saveReservations(all);
        renderReservations();

        showToast('Reservation successfully completed!');
        form.reset();
    });
}

// Menu filter buttons
qsa('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');
        qsa('.filter-btn').forEach(b => b.classList.remove('bg-amber-600','text-white'));
        // active style
        btn.classList.add('bg-amber-600','text-white');
        qsa('.menu-item').forEach(item => {
            const cat = item.getAttribute('data-category');
            if (filter === 'all' || cat === filter) {
                item.style.display = '';
                item.style.animationDelay = ''; // keep animation natural
            } else {
                item.style.display = 'none';
            }
        });
        // re-run AOS refresh if present
        if (window.AOS && AOS.refresh) AOS.refresh();
    });
});

// Activation: set initial active filter to 'all'
const initialBtn = qsa('.filter-btn').find(b => b.getAttribute('data-filter') === 'all');
if (initialBtn) initialBtn.click();

// Smooth scroll on nav links
qsa('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (ev) => {
        const href = a.getAttribute('href');
        if (href.length > 1) {
            ev.preventDefault();
            const target = document.querySelector(href);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// render reservations on load
renderReservations();

// --- Simple cart for Add to Order buttons (stored in localStorage) ---
const CART_KEY = 'dineeaseCart';
function loadCart() {
    try { 
        const raw = localStorage.getItem(CART_KEY); 
        return raw ? JSON.parse(raw) : []; 
    } catch (e) { 
        return []; 
    }
}
function saveCart(arr) { 
    try { 
        localStorage.setItem(CART_KEY, JSON.stringify(arr)); 
    } catch (e) {} 
}

// Delegated handler: listens for Add to Order clicks inside #menu-grid
const menuGrid = qs('#menu-grid');
if (menuGrid) {
    menuGrid.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        // identify Add to Order buttons by their visible text
        const txt = (btn.textContent || '').trim();
        if (!txt.startsWith('+') || !txt.toLowerCase().includes('add to order')) return;

        const item = btn.closest('.menu-item');
        if (!item) return;

        // find a name and price from the menu card
        const nameEl = item.querySelector('h3') || item.querySelector('.font-semibold');
        const priceEl = item.querySelector('.text-amber-600') || item.querySelector('.font-bold');
        const name = nameEl ? nameEl.textContent.trim() : 'Item';
        const price = priceEl ? priceEl.textContent.trim() : '';

        // ensure we have a reservation to attach to
        const reservationId = await getReservationForOrder();
        if (!reservationId) {
            // user cancelled or no reservation -> do nothing
            return;
        }

        // add to cart (merge by name + reservationId)
        const cart = loadCart();
        const existing = cart.find(c => c.name === name && c.price === price && c.reservationId === reservationId);
        if (existing) {
            existing.qty = (existing.qty || 1) + 1;
        } else {
            cart.push({ id: Date.now().toString(), name, price, qty: 1, reservationId });
        }
        saveCart(cart);

        // give immediate feedback: small temporary change to button text and toast
        const originalText = btn.textContent;
        btn.textContent = 'Added ✓';
        btn.setAttribute('disabled','true');
        setTimeout(() => { 
            btn.removeAttribute('disabled'); 
            btn.textContent = originalText; 
        }, 900);

        // show reservation-aware toast
        const res = loadReservations().find(r => r.id === reservationId);
        const when = res ? ` (${res.date}${res.time? ' at ' + res.time : ''})` : '';
        showToast(`${name} added to reservation${when}`);
        // refresh reservations list so attached orders are visible immediately
        try { 
            renderReservations(); 
        } catch (e) { /* ignore */ }
    });
}

// Helper: getReservationForOrder ensures there's a reservation and if multiple, asks user to pick one
async function getReservationForOrder() {
    const reservations = loadReservations();
    if (!reservations || !reservations.length) {
        showToast('Please create a reservation first');
        // scroll to reservation section to help the user
        const sec = qs('#reservation'); 
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return null;
    }
    if (reservations.length === 1) return reservations[0].id;
    // multiple -> show picker
    const choice = await showReservationPicker(reservations);
    return choice || null;
}

// showReservationPicker: renders a list of reservations and returns the selected id or null
function showReservationPicker(reservations) {
    return new Promise((resolve) => {
        const modal = qs('#picker-modal');
        const list = qs('#picker-list');
        const ok = qs('#picker-ok');
        const cancel = qs('#picker-cancel');

        if (!modal || !list || !ok || !cancel) { 
            resolve(null); 
            return; 
        }

        // build list
        list.innerHTML = '';
        reservations.forEach(r => {
            const div = document.createElement('div');
            div.className = 'picker-item';
            div.tabIndex = 0;
            div.dataset.id = r.id;
            const left = document.createElement('div');
            left.innerHTML = `<div class="font-semibold">${escapeHTML(r.name)}</div><div class="picker-meta">${escapeHTML(r.date)}${r.time? ' · ' + escapeHTML(r.time): ''} · ${escapeHTML(r.guests)} guests</div>`;
            const right = document.createElement('div');
            right.innerHTML = `<div class="text-sm text-amber-400">Select</div>`;
            div.appendChild(left);
            div.appendChild(right);
            div.addEventListener('click', () => {
                // mark selected
                qsa('.picker-item').forEach(i => i.classList.remove('selected'));
                div.classList.add('selected');
            });
            div.addEventListener('keydown', (e) => { if (e.key === 'Enter') div.click(); });
            list.appendChild(div);
        });

        modal.classList.add('open');
        modal.setAttribute('aria-hidden','false');
        // focus first item
        const first = list.querySelector('.picker-item'); 
        if (first) first.focus();

        const cleanup = () => {
            ok.removeEventListener('click', onOk);
            cancel.removeEventListener('click', onCancel);
            modal.removeEventListener('keydown', onKey);
        };

        const onOk = () => {
            const sel = list.querySelector('.picker-item.selected');
            const id = sel ? sel.dataset.id : (list.querySelector('.picker-item') ? list.querySelector('.picker-item').dataset.id : null);
            cleanup(); 
            modal.classList.remove('open'); 
            modal.setAttribute('aria-hidden','true'); 
            resolve(id);
        };
        const onCancel = () => { 
            cleanup(); 
            modal.classList.remove('open'); 
            modal.setAttribute('aria-hidden','true'); 
            resolve(null); 
        };
        const onKey = (e) => { 
            if (e.key === 'Escape') onCancel(); 
            if (e.key === 'Enter') onOk(); 
        };

        ok.addEventListener('click', onOk);
        cancel.addEventListener('click', onCancel);
        modal.addEventListener('keydown', onKey);
    });
}
