
function parseFrDate(dateStr) {
    if (!dateStr) return new Date(0);
    // Gestion format "JJ/MM/AAAA HH:MM:SS" ou "JJ/MM/AAAA, HH:MM:SS"
    const datePart = dateStr.split(',')[0].split(' ')[0];
    const [d, m, y] = datePart.split('/');
    if (!d || !m || !y) return new Date(0);
    return new Date(y, m - 1, d);
}

function decodeWebhook(token) {
    if (!token) return '';
    if (token.startsWith('http')) return token;
    try { return atob(token); } catch (e) { return token; }
}

async function hashCode(code) {
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function checkBruteForce() {
    const attempts = JSON.parse(sessionStorage.getItem('ltd_login_attempts') || '{"count":0,"lockUntil":0}');

    if (attempts.lockUntil > Date.now()) {
        const remainingSeconds = Math.ceil((attempts.lockUntil - Date.now()) / 1000);
        return { blocked: true, remaining: remainingSeconds };
    }

    return { blocked: false, count: attempts.count };
}

function recordFailedAttempt() {
    let attempts = JSON.parse(sessionStorage.getItem('ltd_login_attempts') || '{"count":0,"lockUntil":0}');
    attempts.count++;

    if (attempts.count >= 5) {
        attempts.lockUntil = Date.now() + (5 * 60 * 1000);
        attempts.count = 0;
    }

    sessionStorage.setItem('ltd_login_attempts', JSON.stringify(attempts));
    return attempts.count;
}

function resetAttempts() {
    sessionStorage.removeItem('ltd_login_attempts');
}

function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function logAudit(action, user = null) {
    const userName = user || sessionStorage.getItem('ltd_user_name') || 'Système';
    const logs = JSON.parse(localStorage.getItem('ltd_audit_log') || '[]');

    logs.unshift({
        time: new Date().toLocaleString('fr-FR'),
        user: userName,
        action: action
    });

    if (logs.length > 100) logs.pop();

    localStorage.setItem('ltd_audit_log', JSON.stringify(logs));
}

function renderAuditLog() {
    const container = document.getElementById('audit-log');
    if (!container) return;

    const logs = JSON.parse(localStorage.getItem('ltd_audit_log') || '[]');

    if (logs.length === 0) {
        container.innerHTML = '<p style="color: #666; font-style: italic;">Aucune activité enregistrée.</p>';
        return;
    }

    container.innerHTML = logs.map(log => `
        <div class="audit-entry">
            <span class="audit-time">${log.time}</span>
            <span class="audit-action"><strong>${log.user}</strong> : ${log.action}</span>
        </div>
    `).join('');
}

const PROMOTIONS = JSON.parse(localStorage.getItem('ltd_promotions') || '{}');

function applyPromotions() {
    const promos = JSON.parse(localStorage.getItem('ltd_promotions') || '{}');

    document.querySelectorAll('.tarif-categorie li[data-id]').forEach(item => {
        const id = item.dataset.id;
        if (promos[id]) {
            const originalPrice = parseInt(item.dataset.price);
            const discount = promos[id].discount;
            const newPrice = Math.round(originalPrice * (1 - discount / 100));

            item.dataset.price = newPrice;
            const priceSpan = item.querySelector('span:last-of-type');
            if (priceSpan && !priceSpan.classList.contains('item-controls')) {
                priceSpan.innerHTML = `<s style="opacity:0.5">${originalPrice} $</s> ${newPrice} $`;
            }

            if (!item.querySelector('.promo-badge')) {
                const badge = document.createElement('span');
                badge.className = 'promo-badge';
                badge.textContent = `-${discount}%`;
                item.appendChild(badge);
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('admin.html')) return;

    const maintenance = localStorage.getItem('ltd_maintenance');
    if (maintenance === 'true') {
        document.body.innerHTML = `
            <div style="
                height: 100vh; 
                display: flex; 
                flex-direction: column; 
                justify-content: center; 
                align-items: center; 
                background: #0f172a; 
                color: white; 
                font-family: 'Inter', sans-serif;
                text-align: center;
            ">
                <h1 style="font-size: 3rem; color: #ef4444; margin-bottom: 20px;">⚠️ EN MAINTENANCE</h1>
                <p style="font-size: 1.2rem; color: #94a3b8;">Le site est actuellement fermé pour travaux.</p>
                <p style="font-size: 1rem; color: #64748b; margin-top: 10px;">Nous revenons très vite !</p>
            </div>
        `;
        throw new Error("Maintenance Mode Active - Stopping Script Execution");
    }
});


// Charger les employés par défaut depuis config.js
function loadDefaultEmployees() {
    if (typeof DEFAULT_EMPLOYEES === 'undefined' || DEFAULT_EMPLOYEES.length === 0) return;

    const employees = JSON.parse(localStorage.getItem('ltd_employees') || '[]');
    let changed = false;

    DEFAULT_EMPLOYEES.forEach(def => {
        // Vérifier si l'employé existe déjà (par hash de code ou nom)
        // On utilise le hash comme identifiant unique de "sécurité"
        const exists = employees.some(e => e.codeHash === def.codeHash);

        if (!exists) {
            employees.push(def);
            changed = true;
            console.log(`Employé par défaut ajouté: ${def.name}`);
        }
    });

    if (changed) {
        localStorage.setItem('ltd_employees', JSON.stringify(employees));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initStatusBadge();
    loadDefaultEmployees(); // Charger les employés par défaut ici

    if (document.querySelector('.tarif-categorie')) {
        loadDynamicPrices();
        initTarifCalculator();
    }

    initContactForm();

    if (window.location.pathname.includes('admin.html')) {
        initAdminPanel();
    }
});


function getStoredPrices() {
    const stored = localStorage.getItem('ltd_prices');
    if (stored) {
        return { ...DEFAULT_PRICES, ...JSON.parse(stored) };
    }
    return DEFAULT_PRICES;
}

function savePrices(prices) {
    localStorage.setItem('ltd_prices', JSON.stringify(prices));
}

function loadDynamicPrices() {
    const prices = getStoredPrices();
    const promos = JSON.parse(localStorage.getItem('ltd_promos') || '{}');

    document.querySelectorAll('[data-id]').forEach(item => {
        const id = item.dataset.id;

        let normalPrice = prices[id];

        if (normalPrice === undefined) {
            normalPrice = DEFAULT_PRICES[id];
        }

        let finalPrice = normalPrice;
        let isPromo = false;

        if (promos[id] !== undefined) {
            finalPrice = promos[id];
            isPromo = true;
        }

        if (finalPrice !== undefined) {
            item.dataset.price = finalPrice;

            const priceSpan = item.querySelector('span:last-child');
            if (priceSpan) {
                if (isPromo) {
                    priceSpan.innerHTML = `<span style="text-decoration:line-through; font-size:0.8em; opacity:0.7; margin-right:5px;">${normalPrice} $</span><span style="color:#facc15; font-weight:bold; text-shadow:0 0 5px rgba(250,204,21,0.5);">${finalPrice} $</span>`;
                    if (!item.querySelector('.promo-badge-mini')) {
                        const badge = document.createElement('span');
                        badge.className = 'promo-badge-mini';
                        badge.textContent = 'PROMO';
                        badge.style.cssText = "background:#facc15; color:black; font-size:0.6em; padding:2px 4px; border-radius:4px; font-weight:bold; margin-left:5px; vertical-align:middle;";
                        item.appendChild(badge);
                    }
                } else {
                    priceSpan.textContent = finalPrice + ' $';
                    const badge = item.querySelector('.promo-badge-mini');
                    if (badge) badge.remove();
                }
            }
        }
    });
}


function initStatusBadge() {
    const header = document.querySelector('.ltd-header');
    if (!header) return;

    const badge = document.createElement('div');
    badge.className = 'status-badge';

    const manualStatus = localStorage.getItem('ltd_status');
    let isOpen = false;

    if (manualStatus === 'OPEN') {
        isOpen = true;
    } else if (manualStatus === 'CLOSED') {
        isOpen = false;
    } else {
        const hour = new Date().getHours();
        isOpen = hour >= 10 && hour < 22;
    }

    if (isOpen) {
        badge.textContent = '🟢 OUVERT';
        badge.classList.add('open');
    } else {
        badge.textContent = '🔴 FERMÉ';
        badge.classList.add('closed');
    }

    header.appendChild(badge);
}


function initTarifCalculator() {
    const tarifItems = document.querySelectorAll('.tarif-categorie li');
    if (tarifItems.length === 0) return;

    let totalBar = document.querySelector('.total-bar');
    if (!totalBar) {
        totalBar = document.createElement('div');
        totalBar.className = 'total-bar hidden';
        totalBar.innerHTML = `
            <div class="total-content">
                <span>Total Estimé:</span>
                <span id="total-price">0 $</span>
            </div>
            <button id="reset-calc" class="btn-small">Réinitialiser</button>
            <button id="order-btn" class="btn-small" style="background:var(--secondary); margin-left:10px;">Commander</button>
        `;
        document.body.appendChild(totalBar);
    }

    const orderBtn = document.getElementById('order-btn');
    if (orderBtn) {
        orderBtn.addEventListener('click', openCheckoutModal);
    }

    tarifItems.forEach(item => {
        let price = parseInt(item.dataset.price, 10);
        if (isNaN(price)) {
            const priceText = item.querySelector('span:last-child').textContent;
            price = parseInt(priceText.replace(/[^0-9]/g, ''), 10);
            item.dataset.price = price;
        }

        if (item.querySelector('.item-controls')) return;

        const controls = document.createElement('div');
        controls.className = 'item-controls';
        controls.innerHTML = `
            <button class="btn-minus">-</button>
            <span class="count">0</span>
            <button class="btn-plus">+</button>
        `;

        item.appendChild(controls);
        item.dataset.count = 0;

        const btnPlus = controls.querySelector('.btn-plus');
        const btnMinus = controls.querySelector('.btn-minus');
        const countDisplay = controls.querySelector('.count');

        btnPlus.addEventListener('click', () => updateItemCount(item, 1, countDisplay));
        btnMinus.addEventListener('click', () => updateItemCount(item, -1, countDisplay));
    });

    function updateItemCount(item, change, display) {
        let count = parseInt(item.dataset.count, 10);
        count += change;
        if (count < 0) count = 0;

        item.dataset.count = count;
        display.textContent = count;

        if (count > 0) item.classList.add('selected');
        else item.classList.remove('selected');

        recalculateTotal();
    }

    function recalculateTotal() {
        let total = 0;
        document.querySelectorAll('.tarif-categorie li').forEach(item => {
            const p = parseInt(item.dataset.price || 0, 10);
            const c = parseInt(item.dataset.count || 0, 10);
            total += p * c;
        });

        const totalDisplay = document.getElementById('total-price');
        if (totalDisplay) totalDisplay.textContent = total.toLocaleString('fr-FR') + ' $';

        if (total > 0) {
            totalBar.classList.remove('hidden');
            totalBar.classList.add('visible');
        } else {
            totalBar.classList.remove('visible');
            totalBar.classList.add('hidden');
        }
    }

    document.getElementById('reset-calc')?.addEventListener('click', () => {
        document.querySelectorAll('.tarif-categorie li').forEach(item => {
            item.dataset.count = 0;
            item.classList.remove('selected');
            item.querySelector('.count').textContent = '0';
        });
        recalculateTotal();
    });
}

function openCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;

    let total = 0;
    document.querySelectorAll('.tarif-categorie li').forEach(item => {
        const p = parseInt(item.dataset.price || 0, 10);
        const c = parseInt(item.dataset.count || 0, 10);
        total += p * c;
    });

    document.getElementById('modal-total-price').textContent = total.toLocaleString('fr-FR') + ' $';
    modal.classList.remove('hidden');

    modal.querySelector('.close-modal').onclick = () => modal.classList.add('hidden');
    window.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };

    const form = document.getElementById('checkout-form');
    form.onsubmit = (e) => {
        e.preventDefault();
        const orderId = saveOrder(total);

        const modalBody = modal.querySelector('.modal-content');

        form.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 4rem; margin-bottom: 20px;">✅</div>
                <h2 style="color: var(--success); margin-bottom: 10px;">Commande Validée !</h2>
                <p>Merci pour votre commande.</p>
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="font-size: 0.9em; color: #aaa;">Votre code de suivi :</p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: var(--primary); letter-spacing: 2px;">${orderId}</p>
                </div>
                <p style="font-size: 0.8em; color: #aaa; margin-bottom: 20px;">Notez ce code pour suivre l'état de votre commande.</p>
                <button type="button" class="btn" id="close-success-btn">Fermer</button>
            </div>
        `;

        document.getElementById('close-success-btn').addEventListener('click', () => {
            modal.classList.add('hidden');
            setTimeout(() => {
                window.location.reload();
            }, 300);
        });
    };
}

function saveOrder(total) {
    const nom = document.getElementById('order-nom').value;
    const prenom = document.getElementById('order-prenom').value;
    const tel = document.getElementById('order-tel').value;
    const idGta = document.getElementById('order-id').value;

    const items = [];
    document.querySelectorAll('.tarif-categorie li').forEach(item => {
        const count = parseInt(item.dataset.count || 0, 10);
        if (count > 0) {
            let itemName = item.dataset.id || "Article";
            const spanName = item.querySelector('span:first-child');
            if (spanName) itemName = spanName.innerText.trim();

            items.push({
                name: itemName,
                qty: count,
                price: parseInt(item.dataset.price, 10)
            });
        }
    });

    const newOrder = {
        id: 'ORD-' + Date.now().toString().slice(-6),
        date: new Date().toLocaleString('fr-FR'),
        client: { nom, prenom, tel, idGta },
        items: items,
        total: total,
        status: 'En attente'
    };

    const orders = JSON.parse(localStorage.getItem('ltd_orders') || '[]');
    orders.push(newOrder);
    localStorage.setItem('ltd_orders', JSON.stringify(orders));

    sendArrivalWebhook(newOrder);

    return newOrder.id;
}

function sendArrivalWebhook(order) {
    if (typeof DISCORD_WEBHOOK_NOUVELLE_COMMANDE === 'undefined' || DISCORD_WEBHOOK_NOUVELLE_COMMANDE.includes("ACTION_REQUISE")) {
        console.log("Webhook Arrivage non configuré.");
        return;
    }

    const itemsList = order.items.map(i => `- ${i.qty}x ${i.name}`).join('\n');

    const payload = {
        content: `📦 **Nouvelle Commande Reçue !** (#${order.id})`,
        embeds: [{
            title: `Client : ${order.client.nom} ${order.client.prenom}`,
            description: "Une nouvelle commande vient d'être passée sur le site.",
            color: 16776960,
            fields: [
                { name: "📞 Contact", value: `Tel: ${order.client.tel}\nID: ${order.client.idGta}`, inline: true },
                { name: "🛒 Panier", value: itemsList },
                { name: "💰 Total", value: `${order.total.toLocaleString()} $` }
            ],
            footer: { text: "En attente de prise en charge..." },
            timestamp: new Date().toISOString()
        }]
    };

    fetch(decodeWebhook(DISCORD_WEBHOOK_NOUVELLE_COMMANDE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(err => console.error("Webhook arrival fail", err));
}


function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;

        btn.textContent = 'Envoi en cours...';
        btn.disabled = true;

        const name = document.getElementById('contact-name').value;
        const email = document.getElementById('contact-email').value;
        const message = document.getElementById('contact-message').value;

        const payload = {
            username: "Formulaire de Contact",
            embeds: [{
                title: "Nouveau message de contact",
                color: 3447003,
                fields: [
                    { name: "Nom", value: name, inline: true },
                    { name: "Email", value: email, inline: true },
                    { name: "Message", value: message }
                ],
                timestamp: new Date().toISOString()
            }]
        };

        fetch(decodeWebhook(DISCORD_WEBHOOK_AUTRE), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(response => {
            if (response.ok) {
                console.log("Webhook sent!");
                alert("Notification Discord envoyée avec succès ! ✅");
                btn.textContent = 'Message envoyé ! ✅';
                btn.style.backgroundColor = '#166534';
            } else {
                console.error("Webhook error", response);
                alert("Erreur Discord : " + response.status + " " + response.statusText + "\nVérifiez que le lien Webhook est correct.");
                btn.textContent = 'Erreur ! ❌';
                btn.style.backgroundColor = '#991b1b';
            }
        }).catch(err => {
            console.error("Webhook fail", err);
            alert("Impossible de contacter Discord. ❌\nSi vous êtes en local (fichier html sur l'ordi), c'est souvent bloqué par le navigateur.\nEssayez de changer d'article pour tester.");
            btn.textContent = 'Erreur ! ❌';
            btn.style.backgroundColor = '#991b1b';
        }).finally(() => {
            setTimeout(() => {
                form.reset();
                btn.textContent = originalText;
                btn.disabled = false;
                btn.style.backgroundColor = '';
            }, 3000);
        });
    });
}


function initAdminPanel() {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    const loginBtn = document.getElementById('login-btn');
    const passwordInput = document.getElementById('password');
    const logoutBtn = document.getElementById('logout-btn');
    const saveBtn = document.getElementById('save-btn');
    const tableBody = document.getElementById('price-table-body');
    const saveStatus = document.getElementById('save-status');
    const refreshOrdersBtn = document.getElementById('refresh-orders');

    const toggleStatusBtn = document.getElementById('toggle-status-btn');
    const toggleMaintenanceBtn = document.getElementById('toggle-maintenance-btn');
    const maintenanceControlDiv = document.getElementById('maintenance-control');

    const employeeSection = document.getElementById('employee-section');
    const addEmpBtn = document.getElementById('add-emp-btn');
    const empNameInput = document.getElementById('emp-name');
    const empCodeInput = document.getElementById('emp-code');
    const empRoleInput = document.getElementById('emp-role');

    const ROLES = {

        'employe': { rank: 1, label: 'Employé' },
        'gerant': { rank: 2, label: 'Gérant' },
        'co-patron': { rank: 3, label: 'Co-Patron' },
        'admin': { rank: 4, label: 'Patron' }
    };

    const loggedUserRole = sessionStorage.getItem('ltd_user_role');
    if (loggedUserRole) {
        showDashboard(loggedUserRole);
    }

    loginBtn.addEventListener('click', async () => {
        const loginError = document.getElementById('login-error');
        const input = passwordInput.value.trim();

        const bruteCheck = checkBruteForce();
        if (bruteCheck.blocked) {
            loginError.textContent = `⏳ Trop de tentatives ! Réessayez dans ${bruteCheck.remaining} secondes.`;
            loginError.style.display = 'block';
            return;
        }

        let role = null;
        let userName = 'Inconnu';

        const inputHash = await hashCode(input);

        if (inputHash === ADMIN_CODE_HASH) {
            role = 'admin';
            userName = 'Patron';
        } else {
            const employees = JSON.parse(localStorage.getItem('ltd_employees') || '[]');
            const found = employees.find(e => e.codeHash === inputHash);
            if (found) {
                role = found.role || 'employe';
                userName = found.name;
            }
        }

        if (role) {
            resetAttempts();
            sessionStorage.setItem('ltd_user_role', role);
            sessionStorage.setItem('ltd_user_name', userName);
            loginError.style.display = 'none';
            showDashboard(role);
        } else {
            const remaining = 5 - recordFailedAttempt();
            if (remaining > 0) {
                loginError.textContent = `❌ Code incorrect. ${remaining} tentative(s) restante(s).`;
            } else {
                loginError.textContent = `🔒 Compte bloqué pendant 5 minutes.`;
            }
            loginError.style.display = 'block';
        }
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('ltd_user_role');
        sessionStorage.removeItem('ltd_user_name');
        loginScreen.style.display = 'block';
        dashboard.style.display = 'none';
        passwordInput.value = '';
    });

    function updateStatusUI() {
        const status = localStorage.getItem('ltd_status');
        if (status === 'OPEN') {
            toggleStatusBtn.textContent = '🟢 OUVERT (Manuel)';
            toggleStatusBtn.style.backgroundColor = '#166534';
        } else if (status === 'CLOSED') {
            toggleStatusBtn.textContent = '🔴 FERMÉ (Manuel)';
            toggleStatusBtn.style.backgroundColor = '#991b1b';
        } else {
            toggleStatusBtn.textContent = '🕒 AUTO (10h-22h)';
            toggleStatusBtn.style.backgroundColor = '#475569';
        }
        initStatusBadge();
    }

    toggleStatusBtn?.addEventListener('click', () => {
        const current = localStorage.getItem('ltd_status');
        let next = null;
        if (!current) next = 'OPEN';
        else if (current === 'OPEN') next = 'CLOSED';
        else if (current === 'CLOSED') next = null;

        if (next) localStorage.setItem('ltd_status', next);
        else localStorage.removeItem('ltd_status');

        updateStatusUI();
    });

    function updateMaintenanceUI() {
        const maint = localStorage.getItem('ltd_maintenance');
        if (maint === 'true') {
            toggleMaintenanceBtn.textContent = 'ON 🔴';
            toggleMaintenanceBtn.style.backgroundColor = '#ef4444';
        } else {
            toggleMaintenanceBtn.textContent = 'OFF';
            toggleMaintenanceBtn.style.backgroundColor = '#475569';
        }
    }

    toggleMaintenanceBtn?.addEventListener('click', () => {
        const current = localStorage.getItem('ltd_maintenance');
        if (current === 'true') {
            if (confirm('Désactiver la maintenance ? Le site sera visible.')) {
                localStorage.setItem('ltd_maintenance', 'false');
            }
        } else {
            if (confirm('ACTIVER LA MAINTENANCE ? Le site sera inaccessible aux clients.')) {
                localStorage.setItem('ltd_maintenance', 'true');
            }
        }
        updateMaintenanceUI();
    });

    saveBtn.addEventListener('click', () => {
        const newPrices = getStoredPrices();
        const newPromos = {};

        const rows = tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const normalInput = row.querySelector('.input-price');
            const promoCheck = row.querySelector('.input-promo-check');
            const promoInput = row.querySelector('.input-promo-price');

            if (!normalInput) return;

            const id = normalInput.dataset.id;
            const normalVal = parseInt(normalInput.value, 10);

            if (!isNaN(normalVal)) newPrices[id] = normalVal;

            if (promoCheck && promoCheck.checked) {
                const promoVal = parseInt(promoInput.value, 10);
                if (!isNaN(promoVal)) {
                    newPromos[id] = promoVal;
                }
            }
        });

        savePrices(newPrices);
        localStorage.setItem('ltd_promos', JSON.stringify(newPromos));

        logAudit("Modification des prix et promotions");
        saveStatus.textContent = '✅ Prix & Promos sauvegardés !';
        saveStatus.style.opacity = '1';
        setTimeout(() => { saveStatus.style.opacity = '0'; }, 3000);
    });

    refreshOrdersBtn?.addEventListener('click', renderOrders);

    addEmpBtn?.addEventListener('click', async () => {
        const name = empNameInput.value.trim();
        const code = empCodeInput.value.trim();
        const role = empRoleInput.value;

        if (!name || !code) {
            alert('Veuillez remplir le nom et le code.');
            return;
        }

        if (code.length < 4) {
            alert('Le code doit contenir au moins 4 caractères.');
            return;
        }

        const codeHash = await hashCode(code);

        if (codeHash === ADMIN_CODE_HASH) {
            alert('Ce code est réservé.');
            return;
        }

        const employees = JSON.parse(localStorage.getItem('ltd_employees') || '[]');

        if (employees.find(e => e.codeHash === codeHash)) {
            alert('Ce code est déjà utilisé.');
            return;
        }

        employees.push({ name, codeHash, role });
        localStorage.setItem('ltd_employees', JSON.stringify(employees));

        logAudit(`Ajout employé ${name} (${role})`);

        empNameInput.value = '';
        empCodeInput.value = '';
        alert(`✅ Employé "${name}" ajouté avec succès !\nCode sécurisé (hashé).`);
        updateStats();
    });

    function showDashboard(role) {
        loginScreen.style.display = 'none';
        dashboard.style.display = 'block';

        renderPriceTable();
        renderOrders();
        updateStatusUI();
        updateMaintenanceUI();

        updateStats();
        renderAuditLog();
        initNotesSystem();

        const userRank = ROLES[role] ? ROLES[role].rank : 1;
        const managerSection = document.getElementById('manager-section');
        const priceSection = document.getElementById('price-section');
        const notesSection = document.getElementById('notes-section');
        const auditSection = document.getElementById('audit-section');
        const statsDashboard = document.getElementById('stats-dashboard');

        if (userRank >= 1) {
            managerSection.style.display = 'block';

            const sectionTitle = managerSection.querySelector('h2');
            if (sectionTitle) {
                if (userRank >= 3) {
                    sectionTitle.textContent = 'Gestion des Prix & Statut';
                } else {
                    sectionTitle.textContent = 'Statut Magasin';
                }
            }

            statsDashboard.style.display = 'block';
            notesSection.style.display = 'block';

            if (userRank >= 3) {
                priceSection.style.display = 'block';
                renderPriceTable();
                auditSection.style.display = 'block';
            } else {
                priceSection.style.display = 'none';
                auditSection.style.display = 'none';
            }

        } else {
            managerSection.style.display = 'none';
        }

        if (userRank >= 2) {
            employeeSection.style.display = 'block';
            renderEmployees();

            const roleSelect = document.getElementById('emp-role');
            if (roleSelect) {
                roleSelect.innerHTML = '';
                const optEmp = document.createElement('option');
                optEmp.value = 'employe';
                optEmp.textContent = 'Employé';
                optEmp.style.color = 'black';
                roleSelect.appendChild(optEmp);

                if (userRank > 2) {
                    const optGerant = document.createElement('option');
                    optGerant.value = 'gerant';
                    optGerant.textContent = 'Gérant';
                    optGerant.style.color = 'black';
                    roleSelect.appendChild(optGerant);
                }

                if (userRank > 3) {
                    const optCo = document.createElement('option');
                    optCo.value = 'co-patron';
                    optCo.textContent = 'Co-Patron';
                    optCo.style.color = 'black';
                    roleSelect.appendChild(optCo);
                }

                if (userRank >= 4) {
                    const optAdmin = document.createElement('option');
                    optAdmin.value = 'admin';
                    optAdmin.textContent = 'Patron';
                    optAdmin.style.color = 'black';
                    roleSelect.appendChild(optAdmin);
                }
            }

        } else {
            employeeSection.style.display = 'none';
        }

        const roleBadge = document.getElementById('current-role-display');
        const roleLabel = ROLES[role] ? ROLES[role].label : 'Inconnu';
        if (roleBadge) {
            roleBadge.textContent = `Rôle : ${roleLabel}`;
        }

        if (userRank >= 3) {
            maintenanceControlDiv.style.display = 'block';
        } else {
            maintenanceControlDiv.style.display = 'none';
        }
    }

    function updateStats() {
        const orders = JSON.parse(localStorage.getItem('ltd_orders') || '[]');
        const employees = JSON.parse(localStorage.getItem('ltd_employees') || '[]');

        const currentUserRole = sessionStorage.getItem('ltd_user_role');
        const currentUserName = sessionStorage.getItem('ltd_user_name');
        const userRank = ROLES[currentUserRole] ? ROLES[currentUserRole].rank : 1;

        const isManager = userRank >= 2;

        let revenueHtml = '';
        let revenueLabel = 'Ventes Aujourd\'hui';

        if (isManager) {
            const today = new Date().toLocaleDateString('fr-FR');
            const revenueGlobal = orders
                .filter(o => o.date.includes(today))
                .reduce((sum, o) => sum + (o.total || 0), 0);

            const revenuePersonal = orders
                .filter(o => o.takenBy === currentUserName)
                .reduce((sum, o) => sum + (o.total || 0), 0);

            revenueHtml = `${revenueGlobal.toLocaleString()} <span style="font-size:0.5em;">$</span><div style="font-size:0.4em; color:#94a3b8; font-weight:normal; margin-top:5px;">Vous : ${revenuePersonal.toLocaleString()} $</div>`;
        } else {
            revenueLabel = 'Mes Ventes';
            const revenuePersonal = orders
                .filter(o => o.takenBy === currentUserName)
                .reduce((sum, o) => sum + (o.total || 0), 0);
            revenueHtml = `${revenuePersonal.toLocaleString()} <span style="font-size:0.5em;">$</span>`;
        }

        document.getElementById('stat-revenue-today').innerHTML = revenueHtml;
        document.querySelector('#stat-revenue-today + .stat-label').textContent = revenueLabel;

        const pending = orders.filter(o => !o.takenBy).length;
        document.getElementById('stat-orders-pending').textContent = pending;

        let doneHtml = '';
        let doneLabel = 'Commandes Traitées';

        if (isManager) {
            const doneGlobal = orders.filter(o => o.takenBy).length;
            const donePersonal = orders.filter(o => o.takenBy === currentUserName).length;

            doneHtml = `${doneGlobal}<div style="font-size:0.4em; color:#94a3b8; font-weight:normal; margin-top:5px;">Vous : ${donePersonal}</div>`;
        } else {
            doneLabel = 'Mes Commandes';
            const donePersonal = orders.filter(o => o.takenBy === currentUserName).length;
            doneHtml = `${donePersonal}`;
        }

        document.getElementById('stat-orders-done').innerHTML = doneHtml;
        document.querySelector('#stat-orders-done + .stat-label').textContent = doneLabel;

        const employeesCard = document.getElementById('stat-employees').parentElement;
        if (isManager) {
            employeesCard.style.display = 'block';
            document.getElementById('stat-employees').textContent = employees.length;

            const rptBtn = document.getElementById('report-controls');
            if (rptBtn) rptBtn.style.display = 'block';
        } else {
            employeesCard.style.display = 'none';

            const rptBtn = document.getElementById('report-controls');
            if (rptBtn) rptBtn.style.display = 'none';
        }
    }

    function initNotesSystem() {
        const textarea = document.getElementById('internal-notes');
        const status = document.getElementById('notes-status');

        textarea.value = localStorage.getItem('ltd_internal_notes') || '';

        let timeout;
        textarea.addEventListener('input', () => {
            clearTimeout(timeout);
            status.style.opacity = '1';
            status.textContent = 'Écriture...';
            status.style.color = '#fbbf24';

            timeout = setTimeout(() => {
                localStorage.setItem('ltd_internal_notes', textarea.value);
                status.textContent = 'Sauvegardé ✅';
                status.style.color = '#10b981';
                setTimeout(() => status.style.opacity = '0', 2000);
            }, 1000);
        });
    }

    document.getElementById('clear-audit')?.addEventListener('click', () => {
        if (confirm('Vider tout l\'historique d\'activité ?')) {
            localStorage.removeItem('ltd_audit_log');
            renderAuditLog();
        }
    });

    function renderPriceTable() {
        const currentPrices = getStoredPrices();
        const currentPromos = JSON.parse(localStorage.getItem('ltd_promos') || '{}');

        tableBody.innerHTML = '';
        Object.keys(DEFAULT_PRICES).forEach(key => {
            const price = currentPrices[key] !== undefined ? currentPrices[key] : DEFAULT_PRICES[key];
            const name = key.charAt(0).toUpperCase() + key.slice(1);

            const isPromo = currentPromos[key] !== undefined;
            const promoPrice = isPromo ? currentPromos[key] : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${name}</strong> <span style="color:#888; font-size:0.8em">(${key})</span></td>
                <td><input type="number" value="${price}" data-id="${key}" class="input-price" style="width:100px; padding:5px; border-radius:5px; border:1px solid #444; background:#222; color:white;"> $</td>
                <td style="text-align:center;"><input type="checkbox" class="input-promo-check" ${isPromo ? 'checked' : ''} style="transform:scale(1.5); cursor:pointer;"></td>
                <td><input type="number" value="${promoPrice}" class="input-promo-price" placeholder="Prix Promo" style="width:100px; padding:5px; border-radius:5px; border:1px solid #444; background:#222; color:var(--secondary);"> $</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    function renderOrders() {
        const container = document.getElementById('orders-container');
        if (!container) return;
        const orders = JSON.parse(localStorage.getItem('ltd_orders') || '[]');
        container.innerHTML = '';

        if (orders.length === 0) {
            container.innerHTML = '<p style="color: #666; font-style: italic;">Aucune commande pour le moment.</p>';
            return;
        }

        orders.map((o, i) => ({ ...o, originalIndex: i })).reverse().forEach((order) => {
            const card = document.createElement('div');
            card.className = 'order-card';
            let itemsHtml = order.items.map(i => `
                <div style="display:flex; justify-content:space-between;">
                    <span>${i.qty}x ${i.name}</span>
                    <span>${i.qty * i.price} $</span>
                </div>
            `).join('');

            let statusHtml = '';
            if (order.takenBy) {
                statusHtml = `<div style="margin-top:10px; padding:12px; background:rgba(16, 185, 129, 0.2); border:2px solid #059669; border-radius:8px; color:#34d399; font-weight:bold; font-size:1.1em; text-align:center; box-shadow:0 0 10px rgba(16, 185, 129, 0.2);">
                    👮 Pris en charge par : <span style="color:white; text-transform:uppercase;">${order.takenBy}</span>
                </div>`;
            } else {
                statusHtml = `<button class="btn-small" style="background:var(--primary); margin-top:10px; width:100%; font-size:1em; padding:10px;" onclick="takeOrder(${order.originalIndex})">✋ Prendre en charge cette commande</button>`;
            }

            card.innerHTML = `
                <div class="order-header">
                    <div><strong>${order.client.nom} ${order.client.prenom}</strong><br><span style="font-size:0.8em; color:#666;">${order.date}</span></div>
                    <div style="text-align:right"><div>Tel: ${order.client.tel}</div><div>ID: ${order.client.idGta}</div></div>
                </div>
                <div class="order-items">${itemsHtml}</div>
                <div class="order-total" style="font-size:1.2em; border-bottom:1px solid #333; margin-bottom:10px;">Total: ${order.total.toLocaleString()} $</div>
                ${statusHtml}
                <button class="btn-small" style="background:#ef4444; margin-top:15px; width:100%;" onclick="deleteOrder(${order.originalIndex})">Supprimer</button>
            `;
            container.appendChild(card);
        });
    }

    window.takeOrder = function (index) {
        let currentUser = sessionStorage.getItem('ltd_user_name');

        if (!currentUser || currentUser === 'Inconnu') {
            alert("⚠️ IDENTITÉ INCONNUE !\n\nVeuillez vous DÉCONNECTER et vous RECONNECTER avec votre code pour que le système sache qui vous êtes.");
            return;
        }

        const orders = JSON.parse(localStorage.getItem('ltd_orders') || '[]');

        if (orders[index].takenBy) {
            alert('Cette commande est déjà prise !');
            renderOrders();
            return;
        }

        orders[index].takenBy = currentUser;
        localStorage.setItem('ltd_orders', JSON.stringify(orders));

        logAudit(`Prise en charge commande #${orders[index].id}`, currentUser);
        sendDiscordWebhook(orders[index], currentUser);
        renderOrders();
        updateStats();
    };

    window.sendDiscordWebhook = function (order, takenBy) {
        if (typeof DISCORD_WEBHOOK_PRISE_COMMANDE === 'undefined' || DISCORD_WEBHOOK_PRISE_COMMANDE.includes("ACTION_REQUISE")) {
            console.log("Webhook Prise Commande non configuré.");
            alert("Lien Webhook 'Prise Commande' non configuré dans webhooks.js !");
            return;
        }

        const itemsList = order.items.map(i => `- ${i.qty}x ${i.name} (${i.qty * i.price} $)`).join('\n');

        const payload = {
            content: `🚨 **${takenBy} a pris en charge la commande #${order.id || '??'} !**`,
            embeds: [{
                title: `Détails de la commande`,
                color: 65280,
                fields: [
                    { name: "Client", value: `${order.client.nom} ${order.client.prenom}`, inline: true },
                    { name: "Pris par", value: takenBy, inline: true },
                    { name: "Articles", value: itemsList },
                    { name: "Total", value: `${order.total} $` }
                ],
                footer: { text: "LTD System" },
                timestamp: new Date().toISOString()
            }]
        };

        fetch(decodeWebhook(DISCORD_WEBHOOK_PRISE_COMMANDE), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(response => {
            if (response.ok) {
                console.log("Webhook sent!");
                alert("Notification Commande envoyée sur Discord ! ✅");
            } else {
                console.error("Webhook error", response);
                alert("Erreur Discord : " + response.status);
            }
        }).catch(err => {
            console.error("Webhook fail", err);
            alert("Erreur réseau Discord (Bloqué par navigateur ?).");
        });
    };


    function renderEmployees() {
        const employees = JSON.parse(localStorage.getItem('ltd_employees') || '[]');
        const grid = document.getElementById('employee-grid');
        if (!grid) return;

        grid.innerHTML = '';

        const currentUserRole = sessionStorage.getItem('ltd_user_role');
        const myRank = ROLES[currentUserRole] ? ROLES[currentUserRole].rank : 1;

        if (employees.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666; font-style: italic;">Aucun employé enregistré.</p>';
            return;
        }

        employees.forEach((emp, index) => {
            const empRole = emp.role || 'employe';
            const empRank = ROLES[empRole].rank;
            const empLabel = ROLES[empRole].label;

            const card = document.createElement('div');
            card.className = 'employee-card-item';

            const currentUserName = sessionStorage.getItem('ltd_user_name');
            const isMasterAdmin = currentUserName === 'Patron';

            const canDelete = isMasterAdmin || myRank > empRank;
            const canPromote = isMasterAdmin || (myRank > empRank && (empRank + 1) < myRank);
            const canDemote = isMasterAdmin || (myRank > empRank && empRank > 1);

            let actionsHtml = '';


            if (canDemote) {
                actionsHtml += `<button class="btn-small" style="background:#64748b; flex:1;" onclick="changeUserRank(${index}, -1)" title="Rétrograder">🔽</button>`;
            }
            if (canPromote) {
                actionsHtml += `<button class="btn-small" style="background:#16a34a; flex:1;" onclick="changeUserRank(${index}, 1)" title="Promouvoir">🔼</button>`;
            }
            if (canDelete) {
                actionsHtml += `<button class="btn-small" style="background:#ef4444; flex:1;" onclick="deleteEmployee(${index})" title="Supprimer">🗑️</button>`;
            }
            if (!canDelete && !canPromote && !canDemote) {
                actionsHtml = `<span style="font-size:0.8em; color:#ccc; width:100%; text-align:center;">Lecture seule</span>`;
            }

            let codeHtml = '<span style="color:#10b981;">🔒 Code Sécurisé</span>';
            if (canDelete) {
                codeHtml = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#10b981;">🔒 Hashé</span>
                        <button class="btn-small" style="background:#f59e0b; padding:2px 8px; font-size:0.75em;" 
                            onclick="resetEmployeeCode(${index})" title="Réinitialiser le code">🔄 Reset</button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="emp-card-header">
                    <span class="emp-name" onclick="showEmployeeStats('${emp.name}')" title="Voir les stats">
                        ${emp.name} 📊
                    </span>
                    <span class="emp-role-badge ${empRole}">${empLabel}</span>
                </div>
                
                <div class="emp-card-details">
                    ${codeHtml}
                </div>

                <div class="emp-card-actions">
                    ${actionsHtml}
                </div>
            `;
            grid.appendChild(card);
        });
    }


    window.resetEmployeeCode = async function (index) {
        const newCode = prompt('Entrez le nouveau code (minimum 4 caractères) :');

        if (!newCode || newCode.length < 4) {
            alert('Le code doit contenir au moins 4 caractères.');
            return;
        }

        const newHash = await hashCode(newCode);

        if (newHash === ADMIN_CODE_HASH) {
            alert('Ce code est réservé.');
            return;
        }

        const employees = JSON.parse(localStorage.getItem('ltd_employees') || '[]');

        const existing = employees.find((e, i) => e.codeHash === newHash && i !== index);
        if (existing) {
            alert('Ce code est déjà utilisé par un autre employé.');
            return;
        }

        employees[index].codeHash = newHash;
        localStorage.setItem('ltd_employees', JSON.stringify(employees));

        alert(`✅ Code de ${employees[index].name} mis à jour avec succès !`);
        renderEmployees();
    };

    window.changeUserRank = function (index, direction) {
        const employees = JSON.parse(localStorage.getItem('ltd_employees') || '[]');
        const emp = employees[index];
        if (!emp) return;

        const currentRole = emp.role || 'employe';
        let currentRank = 1;
        if (ROLES[currentRole]) currentRank = ROLES[currentRole].rank;

        const newRank = currentRank + direction;

        let newRoleKey = null;
        for (const [key, val] of Object.entries(ROLES)) {
            if (val.rank === newRank) {
                newRoleKey = key;
                break;
            }
        }

        if (newRoleKey) {
            employees[index].role = newRoleKey;
            localStorage.setItem('ltd_employees', JSON.stringify(employees));
            logAudit(`Modification rôle ${emp.name} -> ${newRoleKey}`);
            renderEmployees();
        }
    };

    window.deleteOrder = function (realIndex) {
        if (!confirm('Supprimer cette commande ?')) return;
        const orders = JSON.parse(localStorage.getItem('ltd_orders') || '[]');
        const removed = orders.splice(realIndex, 1)[0];
        localStorage.setItem('ltd_orders', JSON.stringify(orders));
        logAudit(`Suppression commande #${removed.id || '?'}`);
        renderOrders();
        updateStats();
    };

    window.deleteEmployee = function (index) {
        if (!confirm('Supprimer cet employé ?')) return;
        const employees = JSON.parse(localStorage.getItem('ltd_employees') || '[]');
        const removed = employees.splice(index, 1)[0];
        localStorage.setItem('ltd_employees', JSON.stringify(employees));
        logAudit(`Suppression employé ${removed.name}`);
        renderEmployees();
        updateStats();
    };

    function checkWeeklyReport() {
        const now = new Date();
        const isSunday = now.getDay() === 0;

        if (!isSunday) return;

        const todayStr = now.toLocaleDateString('fr-FR');
        const lastSent = localStorage.getItem('ltd_last_weekly_report');

        if (lastSent === todayStr) return;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        generateAndSendReport("📊 Rapport Hebdomadaire Automatique", (o) => {
            const d = parseFrDate(o.date);
            return d >= sevenDaysAgo;
        });

        localStorage.setItem('ltd_last_weekly_report', todayStr);
    }

    window.openReportModal = function () {
        document.getElementById('report-modal').classList.remove('hidden');
    };
    window.closeReportModal = function () {
        document.getElementById('report-modal').classList.add('hidden');
    };

    window.generateManualReport = function (type) {
        const now = new Date();
        const todayStr = now.toLocaleDateString('fr-FR');
        let title = "Rapport Manuel";
        let filter = null;

        if (type === 'today') {
            title = "Rapport Journalier (" + todayStr + ")";
            filter = (o) => o.date && o.date.includes(todayStr);
        } else if (type === 'week') {
            title = "Rapport Hebdomadaire (7 derniers jours)";
            const limit = new Date();
            limit.setDate(limit.getDate() - 7);
            limit.setHours(0, 0, 0, 0);
            filter = (o) => parseFrDate(o.date) >= limit;
        } else if (type === 'month') {
            title = "Rapport Mensuel (30 derniers jours)";
            const limit = new Date();
            limit.setDate(limit.getDate() - 30);
            limit.setHours(0, 0, 0, 0);
            filter = (o) => parseFrDate(o.date) >= limit;
        } else {
            title = "Rapport Global (Tout depuis le début)";
            filter = () => true;
        }

        generateAndSendReport(title, filter);
        closeReportModal();
        alert("✅ Rapport envoyé sur Discord !");
    };

    function generateAndSendReport(reportTitle, filterFn) {
        const orders = JSON.parse(localStorage.getItem('ltd_orders') || '[]');

        const filteredOrders = filterFn ? orders.filter(filterFn) : orders;
        const dateStr = new Date().toLocaleDateString('fr-FR');

        const employees = JSON.parse(localStorage.getItem('ltd_employees') || '[]');
        const perf = {};

        // 1. Initialiser tous les employés avec 0
        employees.forEach(emp => {
            perf[emp.name] = { count: 0, total: 0 };
        });

        // 2. Ajouter le Patron s'il n'est pas déjà là (cas spécial)
        if (!perf['Patron']) {
            perf['Patron'] = { count: 0, total: 0 };
        }

        // 3. Remplir avec les données réelles
        filteredOrders.forEach(o => {
            if (o.takenBy) {
                // Si l'employé a été supprimé entre temps ou nom changé, on l'ajoute quand même pour pas perdre la stat
                if (!perf[o.takenBy]) perf[o.takenBy] = { count: 0, total: 0 };

                perf[o.takenBy].count++;
                perf[o.takenBy].total += (o.total || 0);
            }
        });

        const sortedPerf = Object.entries(perf)
            .sort(([, a], [, b]) => b.count - a.count)
            .map(([name, data]) => `• **${name}**: ${data.count} commandes (${data.total} $)`)
            .join('\n');

        const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        const totalOrders = filteredOrders.length;

        const webhookUrl = decodeWebhook(DISCORD_WEBHOOK_RAPPORTS);
        if (!webhookUrl || webhookUrl.includes("ACTION_REQUISE")) return;

        const payload = {
            embeds: [{
                title: reportTitle,
                color: 16776960,
                fields: [
                    { name: "📅 Date d'émission", value: dateStr, inline: true },
                    { name: "💰 CA Période", value: `${totalRevenue} $`, inline: true },
                    { name: "📦 Commandes Période", value: `${totalOrders}`, inline: true },
                    { name: "🏆 Top Employés", value: sortedPerf || "Aucune donnée sur cette période." }
                ],
                footer: { text: "LTD System Automation" },
                timestamp: new Date().toISOString()
            }]
        };

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(res => {
            console.log("Report sent");
            if (reportTitle.includes("Automatique")) logAudit("Rapport Hebdo envoyé");
        }).catch(err => console.error("Report error", err));
    }

    checkWeeklyReport();

    setInterval(() => {
        if (dashboard.style.display === 'block') {
            renderOrders();
        }
    }, 2000);
}

window.showEmployeeStats = function (name) {
    const modal = document.getElementById('emp-stats-modal');
    if (!modal) return;

    document.getElementById('emp-stats-name').textContent = `Stats de ${name}`;

    const orders = JSON.parse(localStorage.getItem('ltd_orders') || '[]');

    const userOrders = orders.filter(o => o.takenBy === name);

    const totalRev = userOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrd = userOrders.length;

    document.getElementById('emp-stats-total-rev').textContent = totalRev.toLocaleString() + ' $';
    document.getElementById('emp-stats-total-ord').textContent = totalOrd;

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekOrders = userOrders.filter(o => {
        try {
            const parts = o.date.split(',')[0].split('/');
            if (parts.length < 3) return false;
            const dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
            return dateObj >= oneWeekAgo;
        } catch (e) { return false; }
    });

    const weekRev = weekOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const weekOrd = weekOrders.length;

    document.getElementById('emp-stats-week-rev').textContent = weekRev.toLocaleString() + ' $';
    document.getElementById('emp-stats-week-ord').textContent = weekOrd;

    const list = document.getElementById('emp-last-orders');
    list.innerHTML = '';
    const last5 = [...userOrders].reverse().slice(0, 5);

    if (last5.length === 0) {
        list.innerHTML = '<li>Aucune commande traitée.</li>';
    } else {
        last5.forEach(o => {
            const li = document.createElement('li');
            li.style.marginBottom = '5px';
            li.innerHTML = `<span style="color:#aaa;">${o.date}</span> : <strong>${o.total}$</strong>` +
                (o.client ? ` (Client: ${o.client.nom})` : '');
            list.appendChild(li);
        });
    }

    modal.classList.remove('hidden');
}
