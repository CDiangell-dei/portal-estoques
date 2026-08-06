/**
 * js/common.js - Núcleo de Autenticação, Sessão e Navegação Compartilhada
 * Amazon Aço - Portal de Controle de Estoques
 */

const DEFAULT_SUPABASE_URL = 'https://wpwerdaiqyfhfhhioosp.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_BGgecij1uLNAr-2XWMTPCA_y8_lT9Go';

let supabaseClient = null;
let currentUser = null;
let knownFiliais = [];
let knownConferentes = [];
let priceHistory = [];

// --- INICIALIZAÇÃO DO SUPABASE ---
function initSupabase() {
    if (DEFAULT_SUPABASE_URL && DEFAULT_SUPABASE_KEY) {
        try {
            if (typeof supabase !== 'undefined' && supabase.createClient) {
                supabaseClient = supabase.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);
                updateStatusIndicators(true);
            }
        } catch (e) {
            supabaseClient = null;
            updateStatusIndicators(false);
        }
    } else {
        updateStatusIndicators(false);
    }
}

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

// --- GERENCIAMENTO DE SESSÃO DO USUÁRIO ---
function saveUserSession(user) {
    if (!user) return;
    localStorage.setItem('amazon_user_session', JSON.stringify(user));
}

function getStoredUser() {
    try {
        const stored = localStorage.getItem('amazon_user_session');
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
}

function clearUserSession() {
    localStorage.removeItem('amazon_user_session');
    sessionStorage.removeItem('amazon_user_pwd');
}

function checkPageAuth() {
    currentUser = getStoredUser();
    const path = window.location.pathname;
    const isIndex = path.endsWith('index.html') || path.endsWith('/') || path === '';
    
    if (!currentUser && !isIndex) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

function handleLogout() {
    currentUser = null;
    clearUserSession();
    window.location.href = 'index.html';
}

function confirmLogout() {
    if (confirm("Deseja realmente sair da sessão atual?")) {
        handleLogout();
    }
}

// --- MODO ESCURO E ALERTAS GLOBAIS ---
function toggleDarkMode() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
    }
}

function showAlert(message, type = 'info') {
    const alertBox = document.getElementById('feedbackAlert');
    const alertContainer = document.getElementById('alertContainer');
    const alertIcon = document.getElementById('alertIcon');
    const alertMessage = document.getElementById('alertMessage');
    
    if (!alertBox || !alertContainer || !alertMessage) return;
    
    alertMessage.innerHTML = message;
    
    if (type === 'success') {
        alertContainer.className = "p-4 rounded-2xl border flex items-center justify-between shadow-2xl transition-all duration-300 min-w-[320px] max-w-md bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/80 dark:border-emerald-800 dark:text-emerald-200";
        if (alertIcon) alertIcon.setAttribute('data-lucide', 'check-circle-2');
    } else if (type === 'error') {
        alertContainer.className = "p-4 rounded-2xl border flex items-center justify-between shadow-2xl transition-all duration-300 min-w-[320px] max-w-md bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/80 dark:border-rose-800 dark:text-rose-200";
        if (alertIcon) alertIcon.setAttribute('data-lucide', 'alert-circle');
    } else if (type === 'warning') {
        alertContainer.className = "p-4 rounded-2xl border flex items-center justify-between shadow-2xl transition-all duration-300 min-w-[320px] max-w-md bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/80 dark:border-amber-800 dark:text-amber-200";
        if (alertIcon) alertIcon.setAttribute('data-lucide', 'alert-triangle');
    } else {
        alertContainer.className = "p-4 rounded-2xl border flex items-center justify-between shadow-2xl transition-all duration-300 min-w-[320px] max-w-md bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/80 dark:border-blue-800 dark:text-blue-200";
        if (alertIcon) alertIcon.setAttribute('data-lucide', 'info');
    }
    
    alertBox.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    setTimeout(() => hideAlert(), 4000);
}

function hideAlert() {
    const alertBox = document.getElementById('feedbackAlert');
    if (alertBox) alertBox.classList.add('hidden');
}

function showGlobalLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.classList.remove('hidden');
}

function hideGlobalLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.classList.add('hidden');
}

// --- NAVEGAÇÃO ENTRE PÁGINAS ---
function navigateTo(pageUrl) {
    window.location.href = pageUrl;
}

function getFilialDisplayName(numFilial, context = 'comercio') {
    if (!numFilial) return context === 'industria' ? '06' : '01 - ALVORADA';
    const num = parseInt(numFilial, 10);
    if (isNaN(num)) return String(numFilial).toUpperCase();
    if (knownFiliais && knownFiliais.length > 0) {
        const found = knownFiliais.find(f => f.num_filial === num);
        if (found) return `${String(found.num_filial).padStart(2, '0')} - ${found.nome_filial}`;
    }
    const dicComercio = { 1: '01 - ALVORADA', 2: '02 - TORQUATO', 3: '03 - CENTRO', 4: '04 - PARINTINS', 5: '05 - BOA VISTA', 6: '06 - CASTANHAL', 7: '07 - ANANINDEUA', 8: '08 - MARABÁ', 9: '09 - PALMAS', 10: '10 - ARAGUAÍNA' };
    const dicIndustria = { 1: '01 - PERFILADOS', 2: '02 - TELHAS', 3: '03 - TUBOS', 6: '06 - INDÚSTRIA' };
    if (context === 'industria') return dicIndustria[num] || `${String(num).padStart(2, '0')} - INDÚSTRIA`;
    return dicComercio[num] || `${String(num).padStart(2, '0')} - UNIDADE`;
}

// Inicializar ao carregar o script
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    checkPageAuth();
    if (typeof lucide !== 'undefined') lucide.createIcons();
});
