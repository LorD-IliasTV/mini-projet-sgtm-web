const API_URL = 'http://localhost:3000/api';

// --- AUTHENTIFICATION ---
async function checkAuth() {
    const token = localStorage.getItem('sgtm_token');
    const path = window.location.pathname;
    const isLoginPage = path.includes('login.html');
    const isRegisterPage = path.includes('register.html');
    const isForgotPage = path.includes('forgot-password.html');
    const isResetPage = path.includes('reset-password.html');

    if (!token && !isLoginPage && !isRegisterPage && !isForgotPage && !isResetPage) {
        window.location.href = 'login.html';
        return;
    } else if (token && (isLoginPage || isRegisterPage || isForgotPage || isResetPage)) {
        window.location.href = 'index.html';
        return;
    }

    // Vérification active du token auprès du serveur (si le serveur a redémarré, le token sera invalide)
    if (token && !isLoginPage && !isRegisterPage && !isForgotPage && !isResetPage) {
        try {
            const res = await fetch(`${API_URL}/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.status === 401 || res.status === 403) {
                logout(); // Déconnexion forcée
            }
        } catch (e) { console.error("Erreur vérification session:", e); }
    }
}

function logout() {
    localStorage.removeItem('sgtm_token');
    localStorage.removeItem('sgtm_username');
    window.location.href = 'login.html';
}

function getUserRole() {
    return localStorage.getItem('sgtm_role') || 'Observateur';
}

function getUsername() {
    return localStorage.getItem('sgtm_username') || 'Anonyme';
}

function applyRolePermissions() {
    const role = getUserRole();
    // Cacher les éléments "admin-only" si pas admin
    if (role !== 'Admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    }
    // Cacher les éléments "write-access" (Admin + Tech) si Observateur
    if (role === 'Observateur') { // Gestionnaire a accès write
        document.querySelectorAll('.write-access').forEach(el => el.classList.add('hidden'));
    }
}

// Helper pour les headers API
function getHeaders() {
    const token = localStorage.getItem('sgtm_token');
    return { 
        'Content-Type': 'application/json', 
        'x-username': getUsername(),
        'Authorization': `Bearer ${token}`
    };
}

// --- DARK MODE ---
function initDarkMode() {
    if (localStorage.getItem('sgtm_dark') === 'true') {
        document.documentElement.classList.add('dark');
    }
}

window.toggleDarkMode = function() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('sgtm_dark', isDark);
}

// --- NOTIFICATIONS (TOAST) ---
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-0 right-0 m-8 w-full max-w-sm z-50 pointer-events-none';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    let colors = 'bg-blue-500';
    if (type === 'warning') colors = 'bg-red-500';
    if (type === 'success') colors = 'bg-green-500';
    
    toast.className = `${colors} text-white px-6 py-4 border-0 rounded relative mb-4 shadow-lg opacity-0 transition-all duration-300 transform translate-x-full pointer-events-auto`;
    toast.innerHTML = `
        <span class="text-xl inline-block mr-5 align-middle"><i class="fas fa-bell"></i></span>
        <span class="inline-block align-middle mr-8 font-medium">${message}</span>
        <button class="absolute bg-transparent text-2xl font-semibold leading-none right-0 top-0 mt-4 mr-6 outline-none focus:outline-none" onclick="this.parentElement.remove()"><span>×</span></button>
    `;
    
    container.appendChild(toast);
    // Animation entrée
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-x-full');
    });
    
    // Auto remove
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

async function pollNotifications() {
    try {
        const res = await fetch(`${API_URL}/notifications/unread`);
        const notifs = await res.json();
        notifs.forEach(n => showToast(n.message, n.type));
    } catch(e) { console.error(e); }
}

let statusChart = null;

// --- DASHBOARD ---
async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/stats`);
        const data = await res.json();
        
        if(document.getElementById('stat-total')) {
            document.getElementById('stat-total').innerText = data.totalEngins;
            document.getElementById('stat-dispo').innerText = data.availableEngins;
            document.getElementById('stat-loue').innerText = data.rentedEngins;
            document.getElementById('stat-maint').innerText = data.maintenanceEngins;
            
            // Finance
            document.getElementById('stat-revenue').innerText = data.totalRevenue + ' €';
            document.getElementById('stat-cost').innerText = data.totalMaintCost + ' €';
            document.getElementById('stat-net').innerText = (data.totalRevenue - data.totalMaintCost) + ' €';

            // Détails Maintenance par Famille
            const maintDetails = document.getElementById('stat-maint-details');
            if (maintDetails && data.maintByFamily) {
                maintDetails.innerHTML = data.maintByFamily.map(item => `
                    <li class="flex justify-between"><span>${item._id || 'Autre'}</span> <span class="font-bold">${item.total} €</span></li>
                `).join('');
            }

            // Alerts
            const alertsContainer = document.getElementById('alerts-container');
            if (data.alerts && data.alerts.length > 0) {
                alertsContainer.innerHTML = data.alerts.map(a => {
                    let color = 'blue';
                    if (a.type === 'warning') color = 'red';
                    if (a.type === 'suggestion') color = 'purple';
                    return `
                        <div class="bg-${color}-100 border-l-4 border-${color}-500 text-${color}-700 p-3 text-sm">
                            <p class="font-bold">${a.type.toUpperCase()}</p>
                            <p>${a.message}</p>
                        </div>`;
                }).join('');
            } else {
                alertsContainer.innerHTML = '<p class="text-gray-400 italic">Aucune alerte pour le moment.</p>';
            }

            // Chart.js
            const ctx = document.getElementById('enginStatusChart');
            if (ctx) {
                if (statusChart) statusChart.destroy();
                statusChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Disponibles', 'Loués', 'Maintenance'],
                        datasets: [{
                            label: 'Nombre d\'engins',
                            data: [data.availableEngins, data.rentedEngins, data.maintenanceEngins],
                            backgroundColor: ['#22c55e', '#3b82f6', '#eab308'],
                            borderRadius: 5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                    }
                });
            }
        }
    } catch (error) {
        console.error("Erreur chargement stats:", error);
    }
}

// --- PANNES ---
async function loadPannes() {
    const tableBody = document.getElementById('pannes-table-body');
    if (!tableBody) return;

    try {
        const search = document.getElementById('search-panne')?.value.toLowerCase() || '';
        const gravite = document.getElementById('filter-panne-gravite')?.value || '';

        const res = await fetch(`${API_URL}/pannes`);
        const data = await res.json();

        const filtered = data.filter(p => {
            return (gravite === '' || p.gravite === gravite) &&
                   ((p.engin?.code_engin || '').toLowerCase().includes(search) || (p.description || '').toLowerCase().includes(search));
        });

        tableBody.innerHTML = filtered.map(p => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white">${p.engin?.code_engin || '?'}</td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">${new Date(p.date).toLocaleDateString()}</td>
                <td class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">${p.description}</td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700">
                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${p.gravite === 'Critique' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${p.gravite}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700">
                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${p.statut === 'En cours' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                        ${p.statut}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-right text-sm">
                    ${p.statut === 'En cours' ? `
                    <button onclick="resolvePanne('${p._id}')" class="text-green-600 hover:text-green-800 write-access transition transform hover:scale-110" title="Résoudre">
                        <i class="fas fa-check"></i> Résoudre
                    </button>` : `<span class="text-slate-400 text-xs">${new Date(p.date_resolution).toLocaleDateString()}</span>`}
                </td>
            </tr>
        `).join('');
    } catch (error) { console.error(error); }
}

async function addPanne(data) {
    try {
        await fetch(`${API_URL}/pannes`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        loadPannes();
    } catch (error) { alert("Erreur signalement panne"); }
}

async function resolvePanne(id) {
    if(!confirm("Confirmer la résolution de cette panne ? L'engin sera remis en service.")) return;
    await fetch(`${API_URL}/pannes/${id}/resolve`, { method: 'PUT', headers: getHeaders() });
    loadPannes();
}

// --- ENGINS ---
async function loadEngins() {
    const tableBody = document.getElementById('engins-table-body');
    if (!tableBody) return;

    try {
        // Récupérer les filtres
        const search = document.getElementById('search-engin')?.value || '';
        const statut = document.getElementById('filter-statut')?.value || '';
        const famille = document.getElementById('filter-famille')?.value || '';
        const marque = document.getElementById('filter-marque')?.value || '';
        
        const res = await fetch(`${API_URL}/engins?search=${search}&statut=${statut}&famille=${famille}&marque=${marque}`);
        const engins = await res.json();

        tableBody.innerHTML = engins.map(engin => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700">
                    ${engin.photo ? `<img src="${engin.photo}" class="h-10 w-10 rounded-full object-cover shadow-sm" alt="Photo">` : '<div class="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300"><i class="fas fa-camera"></i></div>'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700">
                    <p class="text-slate-800 dark:text-white font-bold">${engin.code_engin}</p>
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700">
                    <p class="text-slate-600 dark:text-slate-300">${engin.famille}</p>
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700">
                    <p class="text-slate-600 dark:text-slate-300">${engin.categorie || '-'}</p>
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700">
                    <p class="text-slate-600 dark:text-slate-300">${engin.marque} / ${engin.modele}</p>
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700">
                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-${getStatusColor(engin.statut)}-100 text-${getStatusColor(engin.statut)}-800">
                        ${engin.statut}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                    ${engin.cout_jour ? engin.cout_jour + ' €' : '<span class="text-slate-400">-</span>'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-right">
                    <button onclick="prepareEditEngin('${engin._id}')" class="text-blue-600 hover:text-blue-800 ml-3 write-access transition transform hover:scale-110" title="Modifier">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteEngin('${engin._id}')" class="text-red-500 hover:text-red-700 ml-3 write-access transition transform hover:scale-110" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        applyRolePermissions(); // Réappliquer les permissions après rendu
    } catch (error) {
        console.error("Erreur chargement engins:", error);
    }
}

async function addEngin(data) {
    try {
        await fetch(`${API_URL}/engins`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        loadEngins(); // Recharger la table
    } catch (error) {
        alert("Erreur lors de l'ajout");
    }
}

async function updateEngin(id, data) {
    try {
        await fetch(`${API_URL}/engins/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        loadEngins();
    } catch (error) { alert("Erreur modification"); }
}

window.prepareAddEngin = function() {
    const form = document.getElementById('engin-form');
    form.reset();
    form.id.value = ""; // Reset ID
    document.getElementById('engin-modal-title').innerText = "Nouvel Engin";
    openModal('engin-modal');
}

window.prepareEditEngin = async function(id) {
    try {
        const res = await fetch(`${API_URL}/engins/${id}`);
        const engin = await res.json();
        const form = document.getElementById('engin-form');
        
        // Remplir le formulaire
        for (const key in engin) {
            if (form[key]) form[key].value = engin[key];
        }
        form.id.value = engin._id; // Champ caché
        document.getElementById('engin-modal-title').innerText = "Modifier Engin";
        openModal('engin-modal');
    } catch(e) { console.error(e); }
}

async function deleteEngin(id) {
    if(!confirm('Êtes-vous sûr de vouloir supprimer cet engin ?')) return;
    await fetch(`${API_URL}/engins/${id}`, { method: 'DELETE', headers: getHeaders() });
    loadEngins();
    loadStats();
}

let chantierMap = null;

async function initChantierMap(chantiers) {
    if (!document.getElementById('map')) return;

    if (chantierMap) {
        chantierMap.remove(); // Nettoyer la carte existante pour éviter les doublons
    }

    chantierMap = L.map('map').setView([46.603354, 1.888334], 6); // Centré sur la France

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(chantierMap);

    // Récupérer les locations pour compter les engins par chantier
    let locations = [];
    try {
        const res = await fetch(`${API_URL}/locations`);
        locations = await res.json();
    } catch(e) {}

    chantiers.forEach(c => {
        if (c.latitude && c.longitude) {
            // Compter les engins actifs sur ce chantier
            const activeEngins = locations.filter(l => l.chantier && l.chantier._id === c._id && l.statut === 'En cours').length;
            
            // Couleur du marqueur selon statut
            const colorClass = c.statut === 'Actif' ? 'bg-green-500' : 'bg-red-500';
            
            const customIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="${colorClass} w-4 h-4 rounded-full border-2 border-white shadow-lg"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            L.marker([c.latitude, c.longitude], { icon: customIcon }).addTo(chantierMap)
                .bindPopup(`
                    <div class="font-sans">
                        <h3 class="font-bold text-sm">${c.chef_projet}</h3>
                        <p class="text-xs text-gray-500">${c.localisation}</p>
                        <div class="mt-2 flex items-center gap-2">
                            <span class="px-2 py-0.5 rounded-full text-xs ${c.statut === 'Actif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${c.statut}</span>
                            <span class="text-xs font-semibold"><i class="fas fa-truck-monster"></i> ${activeEngins} engins</span>
                        </div>
                    </div>
                `);
        }
    });
}

// Fonction utilitaire pour calculer la distance (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(2); // Distance en km
}

// --- AUTOCOMPLÉTION ADRESSE (Nominatim) ---
function setupAddressAutocomplete() {
    const input = document.getElementById('chantier-localisation');
    const suggestions = document.getElementById('localisation-suggestions');
    const latInput = document.getElementById('chantier-latitude');
    const lonInput = document.getElementById('chantier-longitude');
    let timeoutId;

    if (!input || !suggestions) return;

    input.addEventListener('input', (e) => {
        clearTimeout(timeoutId);
        const query = e.target.value;
        
        if (query.length < 3) {
            suggestions.classList.add('hidden');
            return;
        }

        // Debounce pour éviter trop d'appels API
        timeoutId = setTimeout(async () => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
                const data = await res.json();

                suggestions.innerHTML = data.map(item => `
                    <li class="px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-600 cursor-pointer text-sm border-b border-slate-100 dark:border-slate-600 last:border-0 text-slate-700 dark:text-slate-200" 
                        data-lat="${item.lat}" data-lon="${item.lon}" data-name="${item.display_name}">
                        <i class="fas fa-map-marker-alt text-red-500 mr-2"></i>${item.display_name}
                    </li>
                `).join('');
                suggestions.classList.remove('hidden');

                // Gestion du clic sur une suggestion
                suggestions.querySelectorAll('li').forEach(li => {
                    li.addEventListener('click', () => {
                        input.value = li.getAttribute('data-name');
                        latInput.value = li.getAttribute('data-lat');
                        lonInput.value = li.getAttribute('data-lon');
                        suggestions.classList.add('hidden');
                    });
                });
            } catch (err) { console.error("Erreur Nominatim:", err); }
        }, 500);
    });

    // Cacher les suggestions si on clique ailleurs
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.classList.add('hidden');
        }
    });
}

// --- CHANTIERS ---
async function loadChantiers() {
    const tableBody = document.getElementById('chantiers-table-body');
    if (!tableBody) return;

    try {
        const search = document.getElementById('search-chantier')?.value.toLowerCase() || '';
        const statut = document.getElementById('filter-chantier-statut')?.value || '';

        const res = await fetch(`${API_URL}/chantiers`);
        const chantiers = await res.json();

        initChantierMap(chantiers);
        setupAddressAutocomplete(); // Initialiser l'autocomplétion

        const filtered = chantiers.filter(c => {
            return (statut === '' || c.statut === statut) &&
                   ((c.chef_projet || '').toLowerCase().includes(search) || (c.localisation || '').toLowerCase().includes(search));
        });

        tableBody.innerHTML = filtered.map(c => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white">${c.chef_projet}</td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">${c.localisation}</td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700">
                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        ${c.statut}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-right">
                    <button onclick="prepareEditChantier('${c._id}')" class="text-blue-600 hover:text-blue-800 ml-3 write-access transition transform hover:scale-110" title="Modifier">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteChantier('${c._id}')" class="text-red-500 hover:text-red-700 ml-3 transition transform hover:scale-110" title="Marquer comme inactif">
                        <i class="fas fa-archive"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) { console.error(error); }
}

async function addChantier(data) {
    try {
        await fetch(`${API_URL}/chantiers`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        loadChantiers();
        return true;
    } catch (error) { alert("Erreur ajout chantier"); }
}

async function updateChantier(id, data) {
    try {
        await fetch(`${API_URL}/chantiers/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        loadChantiers();
    } catch (error) { alert("Erreur modification"); }
}

window.prepareAddChantier = function() {
    const form = document.getElementById('chantier-form');
    form.reset();
    form.id.value = "";
    document.getElementById('chantier-modal-title').innerText = "Nouveau Chantier";
    openModal('chantier-modal');
}

window.prepareEditChantier = async function(id) {
    try {
        const res = await fetch(`${API_URL}/chantiers/${id}`);
        const chantier = await res.json();
        const form = document.getElementById('chantier-form');
        
        form.chef_projet.value = chantier.chef_projet;
        document.getElementById('chantier-localisation').value = chantier.localisation;
        document.getElementById('chantier-latitude').value = chantier.latitude || '';
        document.getElementById('chantier-longitude').value = chantier.longitude || '';
        form.id.value = chantier._id;

        document.getElementById('chantier-modal-title').innerText = "Modifier Chantier";
        openModal('chantier-modal');
    } catch(e) { console.error(e); }
}

async function deleteChantier(id) {
    if(!confirm('Voulez-vous marquer ce chantier comme inactif ?')) return;
    await fetch(`${API_URL}/chantiers/${id}`, { method: 'DELETE', headers: getHeaders() });
    loadChantiers();
    loadStats();
}

// --- LOCATIONS ---
async function loadLocations() {
    const tableBody = document.getElementById('locations-table-body');
    if (!tableBody) return;

    try {
        const search = document.getElementById('search-location')?.value.toLowerCase() || '';
        const statut = document.getElementById('filter-location-statut')?.value || '';

        const res = await fetch(`${API_URL}/locations`);
        const locations = await res.json();

        const filtered = locations.filter(l => {
            return (statut === '' || l.statut === statut) &&
                   ((l.engin?.code_engin || '').toLowerCase().includes(search) || (l.chantier?.chef_projet || '').toLowerCase().includes(search));
        });

        tableBody.innerHTML = filtered.map(l => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700">
                    <div class="text-sm font-bold text-slate-800 dark:text-white">${l.engin?.code_engin || '?'}</div>
                    <div class="text-xs text-slate-500">${l.engin?.famille || ''}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">${l.chantier?.chef_projet || '?'}</td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">
                    <div class="flex flex-col"><span class="font-medium">Du ${new Date(l.date_debut).toLocaleDateString()}</span>
                    <span class="text-xs text-slate-400">Au ${l.date_fin ? new Date(l.date_fin).toLocaleDateString() : '?'}</span></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-center">
                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${l.statut === 'En cours' ? 'bg-blue-100 text-blue-800' : (l.statut === 'Terminée' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}">
                        ${l.statut}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-right text-sm font-bold text-slate-700 dark:text-slate-200">
                    ${l.cout_total ? l.cout_total + ' €' : '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-right text-sm font-medium">
                    ${l.statut === 'En cours' ? `
                    <div class="write-access inline">
                    <button onclick="updateLocationStatus('${l._id}', 'Terminée')" class="text-green-600 hover:text-green-900 mr-4 transition transform hover:scale-110" title="Terminer">
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button onclick="updateLocationStatus('${l._id}', 'Annulée')" class="text-red-500 hover:text-red-700 transition transform hover:scale-110" title="Annuler">
                        <i class="fas fa-times-circle"></i>
                    </button>
                    </div>
                    ` : ''}
                </td>
            </tr>
        `).join('');
        applyRolePermissions();
    } catch (error) { console.error(error); }
}

async function addLocation(data) {
    // Validation Frontend
    if (data.date_fin && new Date(data.date_fin) <= new Date(data.date_debut)) {
        alert("La date de fin doit être postérieure à la date de début.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/locations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Erreur lors de la création");
        }

        loadLocations();
    } catch (error) { alert("Erreur: " + error.message); }
}

async function updateLocationStatus(id, statut) {
    if(!confirm(`Passer la location à l'état : ${statut} ?`)) return;
    
    await fetch(`${API_URL}/locations/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ statut })
    });
    loadLocations();
    loadStats();
}

async function loadSelectOptions() {
    // Charger Engins et Chantiers pour le formulaire de location
    const [resEngins, resChantiers] = await Promise.all([
        fetch(`${API_URL}/engins`),
        fetch(`${API_URL}/chantiers`)
    ]);
    const engins = await resEngins.json();
    const chantiers = await resChantiers.json();

    const enginSelect = document.getElementById('select-engin');
    const chantierSelect = document.getElementById('select-chantier');

    if(enginSelect) {
        enginSelect.innerHTML = engins
            .filter(e => e.statut === 'Disponible' || e.statut === 'Maintenance')
            .map(e => `<option value="${e._id}">${e.code_engin} - ${e.famille} (${e.statut})</option>`)
            .join('');
    }
    if(chantierSelect) {
        chantierSelect.innerHTML = chantiers
            .filter(c => c.statut === 'Actif')
            .map(c => `<option value="${c._id}">${c.chef_projet} (${c.localisation})</option>`)
            .join('');
    }
}

// --- MAINTENANCE ---
async function loadMaintenances() {
    const tableBody = document.getElementById('maintenance-table-body');
    if (!tableBody) return;

    try {
        const search = document.getElementById('search-maintenance')?.value.toLowerCase() || '';
        const type = document.getElementById('filter-maintenance-type')?.value || '';

        const res = await fetch(`${API_URL}/maintenances`);
        const data = await res.json();

        const filtered = data.filter(m => {
            return (type === '' || m.type_maintenance === type) &&
                   ((m.engin?.code_engin || '').toLowerCase().includes(search) || (m.technicien || '').toLowerCase().includes(search));
        });

        tableBody.innerHTML = filtered.map(m => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white">${m.engin?.code_engin || '?'}</td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">${new Date(m.date).toLocaleDateString()}</td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">${m.type_maintenance}</td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">${m.technicien}</td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm font-bold text-red-600">-${m.cout || 0} €</td>
                <td class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 text-sm italic text-slate-500 dark:text-slate-400">${m.notes || ''}</td>
            </tr>
        `).join('');
    } catch (error) { console.error(error); }
}

async function addMaintenance(data) {
    try {
        await fetch(`${API_URL}/maintenances`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        loadMaintenances();
    } catch (error) { alert("Erreur ajout maintenance"); }
}

// --- UTILISATEURS ---
async function loadUsers() {
    const list = document.getElementById('users-list');
    if(!list) return;
    
    const search = document.getElementById('search-user')?.value.toLowerCase() || '';
    const role = document.getElementById('filter-user-role')?.value || '';

    const res = await fetch(`${API_URL}/users`);
    const users = await res.json();
    
    const filtered = users.filter(u => (role === '' || u.role === role) && u.username.toLowerCase().includes(search));

    list.innerHTML = filtered.map(u => `
        <li class="flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-100 dark:border-slate-600">
            <span class="text-slate-700 dark:text-slate-200"><i class="fas fa-user mr-3 text-blue-500"></i> <strong class="mr-2">${u.username}</strong> <span class="text-xs bg-slate-200 dark:bg-slate-600 px-2 py-1 rounded-full">${u.role}</span></span>
            <button onclick="deleteUser('${u._id}')" class="text-red-400 hover:text-red-600 transition"><i class="fas fa-trash"></i></button>
        </li>
    `).join('');
}

async function deleteUser(id) {
    if(confirm('Supprimer cet utilisateur ?')) {
        await fetch(`${API_URL}/users/${id}`, { method: 'DELETE', headers: getHeaders() });
        loadUsers();
    }
}

async function seedData() {
    if(!confirm("Attention : Cela va effacer toutes les données existantes et créer des données de test. Continuer ?")) return;
    try {
        const res = await fetch(`${API_URL}/seed`, { headers: getHeaders() });
        const data = await res.json();
        if(data.success) {
            alert(data.message);
            location.reload();
        }
    } catch(e) { console.error(e); alert("Erreur lors de la génération"); }
}

// --- SAUVEGARDE & RESTAURATION ---
async function backupData() {
    try {
        const res = await fetch(`${API_URL}/admin/backup`, { headers: getHeaders() });
        const data = await res.json();
        
        // Créer un fichier JSON téléchargeable
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "sgtm_backup_" + new Date().toISOString().slice(0,10) + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    } catch(e) { alert("Erreur lors de la sauvegarde"); }
}

function triggerRestore() {
    document.getElementById('restore-input').click();
}

async function restoreData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const res = await fetch(`${API_URL}/admin/restore`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if(result.success) {
                alert("Restauration réussie !");
                location.reload();
            } else { alert("Erreur restauration: " + result.error); }
        } catch(err) { alert("Fichier invalide"); }
    };
    reader.readAsText(file);
}

// --- PLANNING ---
async function loadPlanning() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    try {
        const res = await fetch(`${API_URL}/locations`);
        const locations = await res.json();

        const events = locations.map(l => ({
            title: `${l.engin?.code_engin} -> ${l.chantier?.chef_projet}`,
            start: l.date_debut,
            end: l.date_fin || l.date_debut, // Si pas de fin, événement sur 1 jour
            color: l.statut === 'En cours' ? '#3b82f6' : (l.statut === 'Terminée' ? '#10b981' : '#ef4444'),
            allDay: true
        }));

        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'fr',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listWeek'
            },
            events: events
        });
        calendar.render();
    } catch (error) { console.error("Erreur chargement planning:", error); }
}

function getStatusColor(status) {
    if (status === 'Disponible') return 'green';
    if (status === 'Loué') return 'blue';
    if (status === 'Maintenance') return 'yellow';
    if (status === 'En panne') return 'red';
    return 'red';
}

// --- LOGS ---
async function loadLogs() {
    const tableBody = document.getElementById('logs-table-body');
    if (!tableBody) return;
    try {
        const res = await fetch(`${API_URL}/logs`, { headers: getHeaders() });
        if (!res.ok) throw new Error("Accès refusé");
        const logs = await res.json();
        tableBody.innerHTML = logs.map(l => `
            <tr>
                <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">${new Date(l.date).toLocaleString()}</td>
                <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm font-bold">${l.user}</td>
                <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">${l.action}</td>
                <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm text-gray-500">${l.description}</td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

async function loadDashboardLogs() {
    const tableBody = document.getElementById('dashboard-logs-body');
    if (!tableBody) return;

    try {
        const res = await fetch(`${API_URL}/logs`, { headers: getHeaders() });
        if (!res.ok) throw new Error("Erreur accès logs");
        const logs = await res.json();
        // On ne garde que les 5 derniers pour le dashboard
        const recentLogs = logs.slice(0, 5);

        tableBody.innerHTML = recentLogs.map(l => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition duration-150">
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">${new Date(l.date).toLocaleString('fr-FR')}</td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white">${l.user || 'Anonyme'}</td>
                <td class="px-6 py-4 whitespace-nowrap border-b border-slate-100 dark:border-slate-700"><span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">${l.action}</span></td>
                <td class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 italic">${l.description}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Erreur chargement logs dashboard:", e);
        tableBody.innerHTML = '<tr><td colspan="4" class="px-5 py-5 text-center text-red-500 text-sm">Erreur de chargement</td></tr>';
    }
}

// --- PROFIL ---
async function changePassword(newPassword) {
    const token = localStorage.getItem('sgtm_token'); // Token est l'ID user dans ce projet simple
    try {
        await fetch(`${API_URL}/users/${token}/password`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ password: newPassword })
        });
        alert("Mot de passe modifié avec succès !");
    } catch (e) { alert("Erreur modification mot de passe"); }
}

async function loadProfile() {
    const usernameEl = document.getElementById('profile-username');
    if (!usernameEl) return;

    try {
        const res = await fetch(`${API_URL}/profile`, { headers: getHeaders() });
        const data = await res.json();

        if (data.user) {
            document.getElementById('profile-username').innerText = data.user.username;
            document.getElementById('profile-role').innerText = data.user.role;
        }

        const logsList = document.getElementById('profile-logs');
        if (data.logs && data.logs.length > 0) {
            logsList.innerHTML = data.logs.map(l => `
                <li class="flex items-start gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-slate-700 last:border-0 last:mb-0 last:pb-0">
                    <div class="mt-1 p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs">
                        <i class="fas fa-bolt"></i>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-slate-800 dark:text-white">${l.action}</p>
                        <p class="text-sm text-slate-600 dark:text-slate-400">${l.description}</p>
                        <p class="text-xs text-slate-400 mt-1"><i class="far fa-clock mr-1"></i> ${new Date(l.date).toLocaleString()}</p>
                    </div>
                </li>
            `).join('');
        } else {
            logsList.innerHTML = '<div class="text-center py-10 text-slate-400"><i class="fas fa-wind text-4xl mb-3 block opacity-30"></i>Aucune activité récente.</div>';
        }
    } catch (e) { console.error(e); }
}

// --- EXPORT ---
function exportToPDF(tableId, filename) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Rapport SGTM", 14, 10);
    doc.autoTable({ html: `#${tableId}` });
    doc.save(`${filename}.pdf`);
}

function exportToExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    const wb = XLSX.utils.table_to_book(table, {sheet: "Sheet 1"});
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

// --- UI & UX FUNCTIONS ---

window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex'); // Utiliser flex pour centrer
    }
}

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier l'auth immédiatement
    checkAuth();
    applyRolePermissions();
    initDarkMode();

    // Lancer le polling des notifications
    setInterval(pollNotifications, 5000);

    // Dashboard
    if(document.getElementById('stat-total')) loadStats();

    // Dashboard Logs
    if(document.getElementById('dashboard-logs-body')) loadDashboardLogs();

    // Engins
    if(document.getElementById('engins-table-body')) {
        loadEngins();
        // Filtres
        document.getElementById('search-engin')?.addEventListener('input', loadEngins);
        document.getElementById('filter-statut')?.addEventListener('change', loadEngins);
        document.getElementById('filter-famille')?.addEventListener('input', loadEngins);
        document.getElementById('filter-marque')?.addEventListener('input', loadEngins);

        const form = document.getElementById('engin-form');
        if(form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                
                if (data.id) {
                    await updateEngin(data.id, data);
                } else {
                    await addEngin(data);
                }
                closeModal('engin-modal');
                form.reset();
            });
        }
    }

    // Chantiers
    if(document.getElementById('chantiers-table-body')) {
        loadChantiers();
        const form = document.getElementById('chantier-form');
        if(form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                
                if (data.id) {
                    await updateChantier(data.id, data);
                } else {
                    await addChantier(data);
                }
                closeModal('chantier-modal');
                form.reset();
            });
        }
    }

    // Locations
    if(document.getElementById('locations-table-body')) {
        loadLocations();
        document.getElementById('search-location')?.addEventListener('input', loadLocations);
        document.getElementById('filter-location-statut')?.addEventListener('change', loadLocations);
    }

    // Maintenance
    if(document.getElementById('maintenance-table-body')) {
        loadMaintenances();
        const form = document.getElementById('maintenance-form');
        if(form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                await addMaintenance(data);
                closeModal('maintenance-modal');
                form.reset();
            });
        }
        // Listeners filtres
        document.getElementById('search-maintenance')?.addEventListener('input', loadMaintenances);
        document.getElementById('filter-maintenance-type')?.addEventListener('change', loadMaintenances);
    }

    // Pannes
    if(document.getElementById('pannes-table-body')) {
        loadPannes();
        const form = document.getElementById('panne-form');
        if(form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                await addPanne(data);
                closeModal('panne-modal');
                form.reset();
            });
        }
        // Listeners filtres
        document.getElementById('search-panne')?.addEventListener('input', loadPannes);
        document.getElementById('filter-panne-gravite')?.addEventListener('change', loadPannes);
    }

    // Utilisateurs
    if(document.getElementById('users-list')) {
        loadUsers();
        document.getElementById('search-user')?.addEventListener('input', loadUsers);
        document.getElementById('filter-user-role')?.addEventListener('change', loadUsers);
    }

    // Logs
    if(document.getElementById('logs-table-body')) loadLogs();

    // Profil
    const pwdForm = document.getElementById('password-form');
    if(pwdForm) {
        pwdForm.addEventListener('submit', (e) => {
            e.preventDefault();
            changePassword(pwdForm.password.value);
        });
        loadProfile(); // Charger les infos du profil
    }

    // Gestionnaire de fichier pour la restauration
    const restoreInput = document.getElementById('restore-input');
    if(restoreInput) {
        restoreInput.addEventListener('change', () => restoreData(restoreInput));
    }

    // Login Page
    const loginForm = document.getElementById('login-form');
    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());
            
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();

            if(result.success) {
                localStorage.setItem('sgtm_token', result.token);
                localStorage.setItem('sgtm_role', result.role);
                localStorage.setItem('sgtm_username', result.username);
                window.location.href = 'index.html';
            } else {
                const errorEl = document.getElementById('login-error');
                errorEl.innerText = result.error;
                errorEl.classList.remove('hidden');
            }
        });
    }

    // Register Page
    const registerForm = document.getElementById('register-form');
    if(registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            const data = Object.fromEntries(formData.entries());
            
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();

            if(result.success) {
                alert('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
                window.location.href = 'login.html';
            } else {
                const errorEl = document.getElementById('register-error');
                errorEl.innerText = result.error;
                errorEl.classList.remove('hidden');
            }
        });
    }

    // Forgot Password Page
    const forgotForm = document.getElementById('forgot-password-form');
    if(forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = forgotForm.username.value;
            const btn = forgotForm.querySelector('button');
            const msg = document.getElementById('forgot-message');
            
            btn.disabled = true;
            try {
                const res = await fetch(`${API_URL}/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });
                const data = await res.json();
                msg.innerText = data.message;
                msg.classList.remove('hidden');
            } catch(e) { console.error(e); }
            btn.disabled = false;
        });
    }

    // Reset Password Page
    const resetForm = document.getElementById('reset-password-form');
    if(resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            const newPassword = resetForm.password.value;

            const res = await fetch(`${API_URL}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });
            const data = await res.json();
            
            if(data.success) {
                alert(data.message);
                window.location.href = 'login.html';
            } else {
                alert(data.error);
            }
        });
    }
});