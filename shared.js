/**
 * SHARED.JS - Controle de Estoque Amazon Aço
 * Funções globais e utilitárias compartilhadas entre todos os módulos independentes.
 */

const DEFAULT_SUPABASE_URL = 'https://wpwerdaiqyfhfhhioosp.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_BGgecij1uLNAr-2XWMTPCA_y8_lT9Go';

let supabaseClient = null;
let currentUser = null;
let isSyncing = false;

const DIC_FILIAIS_MAP = {
    1: "01 - Alvorada",
    2: "02 - Matriz CD",
    4: "04 - Raiz",
    5: "05 - Cidade Nova",
    6: "06 - Jorge Teixeira"
};

const DIC_FILIAIS_INDUSTRIA = {
    1: "01 - Telhas",
    2: "02 - Tubos",
    3: "03 - Perfis",
    4: "04 - Matéria Prima",
    5: "05 - Sucata"
};

// --- INICIALIZAÇÃO DO SUPABASE ---
function initSupabase() {
    if (DEFAULT_SUPABASE_URL && DEFAULT_SUPABASE_KEY) {
        try {
            if (typeof supabase !== 'undefined' && supabase.createClient) {
                supabaseClient = supabase.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);
                updateStatusIndicators(true);
                return supabaseClient;
            }
        } catch (e) {
            console.error("Erro ao inicializar Supabase:", e);
            supabaseClient = null;
            updateStatusIndicators(false);
        }
    }
    updateStatusIndicators(false);
    return null;
}

// --- CONTROLE DE SESSÃO E AUTENTICAÇÃO ---
function getCurrentUser() {
    if (currentUser) return currentUser;
    try {
        const raw = localStorage.getItem('amazon_user_session');
        if (!raw) return null;
        const sessionData = JSON.parse(raw);
        if (sessionData && sessionData.user && sessionData.user.matricula) {
            currentUser = sessionData.user;
            return currentUser;
        }
    } catch (e) {
        console.error("Erro ao ler sessão:", e);
    }
    return null;
}

function saveUserSession(user) {
    if (!user) return;
    currentUser = user;
    const sessionObj = {
        user: user,
        loginTime: new Date().toISOString()
    };
    localStorage.setItem('amazon_user_session', JSON.stringify(sessionObj));
}

function clearUserSession() {
    currentUser = null;
    localStorage.removeItem('amazon_user_session');
    localStorage.removeItem('amazon_user_pwd');
    sessionStorage.removeItem('amazon_user_pwd');
}

/**
 * Verifica autenticação ao carregar qualquer módulo independente.
 * Se o usuário não estiver logado, redireciona para index.html.
 * Se a página exigir permissões específicas (ex: admin, almoxarife), verifica e redireciona se necessário.
 */
async function checkAuth(requiredRole = null) {
    initSupabase();
    const user = getCurrentUser();

    if (!user || !user.matricula) {
        console.warn("Nenhum usuário logado. Redirecionando para login...");
        window.location.href = 'index.html';
        return null;
    }

    if (user.status !== true) {
        alert("Sua conta está inativa ou pendente de aprovação.");
        clearUserSession();
        window.location.href = 'index.html';
        return null;
    }

    const isAlmox = user.eh_almoxarife === true || user.eh_admin === true;
    const isAdmin = user.eh_admin === true;

    if (requiredRole === 'almox' && !isAlmox) {
        alert("Acesso restrito a Almoxarifes e Administradores.");
        window.location.href = 'index.html';
        return null;
    }

    if (requiredRole === 'admin' && !isAdmin) {
        alert("Acesso restrito a Administradores.");
        window.location.href = 'index.html';
        return null;
    }

    // Atualiza cabeçalho
    updateHeaderUserInfo(user);
    updateRolePermissionsUI(user);

    // Sincroniza perfil do usuário em background
    if (supabaseClient && user.matricula) {
        try {
            const { data: userProfile } = await supabaseClient.rpc('get_user_profile', {
                p_matricula: parseInt(user.matricula, 10)
            });
            if (userProfile && userProfile.length > 0) {
                currentUser = userProfile[0];
                saveUserSession(currentUser);
                updateHeaderUserInfo(currentUser);
                updateRolePermissionsUI(currentUser);
            }
        } catch (e) {
            console.warn("Sincronização de perfil em segundo plano falhou:", e);
        }
    }

    return user;
}

function updateHeaderUserInfo(user) {
    if (!user) return;
    const headerName = document.getElementById('headerUserName');
    const headerFilial = document.getElementById('headerUserFilial');
    const homeName = document.getElementById('homeUserName');
    const homeBadge = document.getElementById('homeUserFilialBadge');

    const filialVal = user.filial_atual || user.filial_comercio || '01';
    const filialDisplay = getFilialDisplayName(filialVal);

    if (headerName) headerName.innerText = user.nome || 'Usuário';
    if (headerFilial) headerFilial.innerText = filialDisplay;
    if (homeName) homeName.innerText = user.nome || 'Usuário';
    if (homeBadge) homeBadge.innerText = filialDisplay;
}

function updateRolePermissionsUI(user = null) {
    const usr = user || getCurrentUser();
    if (!usr) return;

    const isAlmox = usr.eh_almoxarife === true || usr.eh_admin === true;
    const isAdmin = usr.eh_admin === true;

    // Elementos Desktop
    const desktopAlmox = document.getElementById('desktopAlmoxGroupContainer');
    const desktopAdmin = document.getElementById('desktopBtnAdmin');

    if (desktopAlmox) {
        if (isAlmox) {
            desktopAlmox.classList.remove('hidden');
        } else {
            desktopAlmox.classList.add('hidden');
        }
    }

    if (desktopAdmin) {
        if (isAdmin) {
            desktopAdmin.classList.remove('hidden');
            desktopAdmin.classList.add('inline-flex');
        } else {
            desktopAdmin.classList.add('hidden');
            desktopAdmin.classList.remove('inline-flex');
        }
    }

    // Elementos Mobile Bottom Nav
    const bottomAlmox = document.getElementById('bottomBtnAlmoxGroup');
    const bottomAdmin = document.getElementById('bottomBtnAdmin');
    const bottomEstoque = document.getElementById('bottomBtnEstoqueGroup');

    if (bottomEstoque) {
        bottomEstoque.classList.remove('hidden');
        bottomEstoque.classList.add('flex');
    }

    if (bottomAlmox) {
        if (isAlmox) {
            bottomAlmox.classList.remove('hidden');
            bottomAlmox.classList.add('flex');
        } else {
            bottomAlmox.classList.add('hidden');
            bottomAlmox.classList.remove('flex');
        }
    }

    if (bottomAdmin) {
        if (isAdmin) {
            bottomAdmin.classList.remove('hidden');
            bottomAdmin.classList.add('flex');
        } else {
            bottomAdmin.classList.add('hidden');
            bottomAdmin.classList.remove('flex');
        }
    }
}

// --- LOGOUT ---
function confirmLogout() {
    const modal = document.getElementById('logoutModal');
    if (modal) modal.classList.remove('hidden');
}

function closeLogoutModal() {
    const modal = document.getElementById('logoutModal');
    if (modal) modal.classList.add('hidden');
}

function executeLogout() {
    clearUserSession();
    window.location.href = 'index.html';
}

function handleLogout() {
    confirmLogout();
}

function getFilialDisplayName(numFilial, context = 'comercio') {
    if (!numFilial) return "01 - Alvorada";
    const num = parseInt(numFilial, 10);
    const padStr = String(numFilial).padStart(2, '0');
    if (context === 'industria') {
        return DIC_FILIAIS_INDUSTRIA[num] || `Filial ${padStr}`;
    }
    return DIC_FILIAIS_MAP[num] || `Filial ${padStr}`;
}

// --- ALERTAS TOAST ---
let alertTimer = null;
function showAlert(msg, type = 'info') {
    const alertDiv = document.getElementById('feedbackAlert');
    const container = document.getElementById('alertContainer');
    const messageEl = document.getElementById('alertMessage');
    const iconEl = document.getElementById('alertIcon');
    
    if (!alertDiv || !container || !messageEl) {
        console.log(`[Alert - ${type}] ${msg}`);
        return;
    }
    
    messageEl.innerText = msg;
    
    container.className = "p-4 rounded-2xl border flex items-center justify-between shadow-2xl transition-all duration-300 min-w-[320px] max-w-md ";
    if (type === 'success') {
        container.classList.add('bg-emerald-50', 'border-emerald-300', 'text-emerald-900', 'dark:bg-emerald-950', 'dark:text-emerald-100', 'dark:border-emerald-800');
        if (iconEl) iconEl.setAttribute('data-lucide', 'check-circle-2');
    } else if (type === 'warning' || type === 'error') {
        container.classList.add('bg-rose-50', 'border-rose-300', 'text-rose-900', 'dark:bg-rose-950', 'dark:text-rose-100', 'dark:border-rose-800');
        if (iconEl) iconEl.setAttribute('data-lucide', 'alert-triangle');
    } else {
        container.classList.add('bg-blue-50', 'border-blue-300', 'text-blue-900', 'dark:bg-blue-950', 'dark:text-blue-100', 'dark:border-blue-800');
        if (iconEl) iconEl.setAttribute('data-lucide', 'info');
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    alertDiv.classList.remove('hidden');
    
    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = setTimeout(() => {
        hideAlert();
    }, 4000);
}

function hideAlert() {
    const alertDiv = document.getElementById('feedbackAlert');
    if (alertDiv) alertDiv.classList.add('hidden');
}

// --- DARK MODE ---
function toggleDarkMode() {
    const htmlEl = document.documentElement;
    const btn = document.getElementById('darkModeBtn');
    const isEnteringDark = !htmlEl.classList.contains('dark');
    
    if (isEnteringDark) {
        htmlEl.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        if (btn) btn.innerHTML = '<i data-lucide="sun" class="w-4 h-4"></i>';
    } else {
        htmlEl.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        if (btn) btn.innerHTML = '<i data-lucide="moon" class="w-4 h-4"></i>';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function initTheme() {
    if (localStorage.theme === 'dark') {
        document.documentElement.classList.add('dark');
        const btn = document.getElementById('darkModeBtn');
        if (btn) btn.innerHTML = '<i data-lucide="sun" class="w-4 h-4"></i>';
    } else {
        document.documentElement.classList.remove('dark');
    }
}

// --- SUBMENUS DE NAVEGAÇÃO ---
function toggleMobileSubmenu(group) {
    const menuEstoque = document.getElementById('mobileEstoqueSubmenu');
    const menuAlmox = document.getElementById('mobileAlmoxSubmenu');
    
    if (group === 'estoque') {
        if (menuAlmox) menuAlmox.classList.add('hidden');
        if (menuEstoque) menuEstoque.classList.toggle('hidden');
    } else if (group === 'almox') {
        if (menuEstoque) menuEstoque.classList.add('hidden');
        if (menuAlmox) menuAlmox.classList.toggle('hidden');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeMobileSubmenus() {
    const menuEstoque = document.getElementById('mobileEstoqueSubmenu');
    const menuAlmox = document.getElementById('mobileAlmoxSubmenu');
    if (menuEstoque) menuEstoque.classList.add('hidden');
    if (menuAlmox) menuAlmox.classList.add('hidden');
}

function toggleDesktopSubmenu(group) {
    const menuEstoque = document.getElementById('desktopEstoqueSubmenu');
    const menuAlmox = document.getElementById('desktopAlmoxSubmenu');
    
    if (group === 'estoque') {
        if (menuAlmox) menuAlmox.classList.add('hidden');
        if (menuEstoque) menuEstoque.classList.toggle('hidden');
    } else if (group === 'almox') {
        if (menuEstoque) menuEstoque.classList.add('hidden');
        if (menuAlmox) menuAlmox.classList.toggle('hidden');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeDesktopSubmenus() {
    const menuEstoque = document.getElementById('desktopEstoqueSubmenu');
    const menuAlmox = document.getElementById('desktopAlmoxSubmenu');
    if (menuEstoque) menuEstoque.classList.add('hidden');
    if (menuAlmox) menuAlmox.classList.add('hidden');
}

// Fecha submenus ao clicar fora
document.addEventListener('click', (e) => {
    const menuEst = document.getElementById('desktopEstoqueSubmenu');
    const btnEst = document.getElementById('desktopBtnEstoqueGroup');
    const menuAlm = document.getElementById('desktopAlmoxSubmenu');
    const btnAlm = document.getElementById('desktopBtnAlmoxGroup');

    if (menuEst && !menuEst.classList.contains('hidden') && btnEst && !btnEst.contains(e.target) && !menuEst.contains(e.target)) {
        menuEst.classList.add('hidden');
    }
    if (menuAlm && !menuAlm.classList.contains('hidden') && btnAlm && !btnAlm.contains(e.target) && !menuAlm.contains(e.target)) {
        menuAlm.classList.add('hidden');
    }
});

// --- ROLAGEM SUAVE ---
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function scrollToBottom() {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
}

// --- INDICADORES DE CONEXÃO E FILA OFFLINE ---
function updateStatusIndicators(isConnected) {
    const loginDot = document.getElementById('loginStatusDot');
    const appDot = document.getElementById('appStatusDot');
    if (isConnected) {
        if (loginDot) loginDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500";
        if (appDot) appDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500";
    } else {
        if (loginDot) loginDot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse";
        if (appDot) appDot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse";
    }
}

function updateOfflineBadgeUI() {
    const queue = JSON.parse(localStorage.getItem('amazon_offline_queue') || '[]');
    const badge = document.getElementById('offlineSyncBadge');
    const countSpan = document.getElementById('offlineSyncCount');
    if (badge && countSpan) {
        if (queue.length > 0) {
            countSpan.innerText = queue.length;
            badge.classList.remove('hidden');
            badge.classList.add('flex');
        } else {
            badge.classList.add('hidden');
            badge.classList.remove('flex');
        }
    }
}

function saveOfflineAction(action, table, payload, meta = null) {
    const queue = JSON.parse(localStorage.getItem('amazon_offline_queue') || '[]');
    queue.push({
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        action,
        table,
        payload,
        meta,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('amazon_offline_queue', JSON.stringify(queue));
    updateOfflineBadgeUI();
    showAlert("Lançamento salvo offline! Será sincronizado automaticamente assim que a conexão retornar.", "warning");
}

async function processOfflineQueue() {
    if (isSyncing || !supabaseClient) return;
    const queue = JSON.parse(localStorage.getItem('amazon_offline_queue') || '[]');
    if (queue.length === 0) {
        updateOfflineBadgeUI();
        return;
    }
    
    isSyncing = true;
    const loader = document.getElementById('globalLoader');
    if (loader) loader.classList.remove('hidden');
    
    const remaining = [];
    let successCount = 0;
    let errorOccurred = false;
    
    for (const item of queue) {
        if (errorOccurred) {
            remaining.push(item);
            continue;
        }
        
        try {
            if (item.payload) {
                const sanitizeObj = (obj) => {
                    if (obj && typeof obj === 'object') {
                        if ('orçamento' in obj) {
                            obj['orcamento'] = obj['orçamento'];
                            delete obj['orçamento'];
                        }
                    }
                };
                if (Array.isArray(item.payload)) {
                    item.payload.forEach(sanitizeObj);
                } else {
                    sanitizeObj(item.payload);
                }
            }

            let result;
            if (item.action === 'insert') {
                result = await supabaseClient.from(item.table).insert(item.payload);
            } else if (item.action === 'update') {
                result = await supabaseClient.from(item.table).update(item.payload).eq('id', item.meta.id);
            }
            
            if (result && result.error) {
                console.error("Erro ao sincronizar item offline:", result.error);
                if (result.error.status === 0 || result.error.code === 'PGRST102' || (result.error.message && result.error.message.includes('Fetch'))) {
                    errorOccurred = true;
                    remaining.push(item);
                } else {
                    console.warn("Item ignorado devido a erro de validação:", item);
                }
            } else {
                successCount++;
            }
        } catch (err) {
            console.error("Erro geral na sincronização offline:", err);
            errorOccurred = true;
            remaining.push(item);
        }
    }
    
    localStorage.setItem('amazon_offline_queue', JSON.stringify(remaining));
    isSyncing = false;
    if (loader) loader.classList.add('hidden');
    
    updateOfflineBadgeUI();
    
    if (successCount > 0) {
        showAlert(`${successCount} item(ns) sincronizado(s) com sucesso!`, "success");
        if (typeof fetchAllRecords === 'function') fetchAllRecords();
    }
    
    if (errorOccurred) {
        showAlert("Alguns itens pendentes não puderam ser sincronizados devido a falha de conexão.", "warning");
    }
}

window.addEventListener('online', () => {
    updateStatusIndicators(true);
    processOfflineQueue();
});
window.addEventListener('offline', () => {
    updateStatusIndicators(false);
});

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateOfflineBadgeUI();
    if (navigator.onLine) {
        processOfflineQueue();
    }
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});
