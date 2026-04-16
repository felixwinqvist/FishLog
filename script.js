import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
    'https://ixyirvchechxbkjocvlw.supabase.co',
    'sb_publishable__j0qhEE6GtGmF_FgCOcrKA_alIdEc-v'
);

let catches = [];
let currentUser = null;

const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const logoutBtn = document.getElementById('logoutBtn');
const userStatus = document.getElementById('userStatus');
const addFishForm = document.getElementById('addFishForm');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const fishDateInput = document.getElementById('fishDate');

if (fishDateInput) {
    fishDateInput.valueAsDate = new Date();
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function formatWeight(weight) {
    if (!Number.isFinite(weight)) return '-';
    return `${weight.toFixed(weight % 1 === 0 ? 0 : 2)} kg`;
}

function formatLength(length) {
    if (!Number.isFinite(length)) return 'Okänd längd';
    return `${length.toFixed(length % 1 === 0 ? 0 : 1)} cm`;
}

function formatDate(dateString) {
    if (!dateString) return 'Okänt datum';

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    return new Intl.DateTimeFormat('sv-SE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

function getStoragePathFromValue(value) {
    if (!value) return null;
    if (!value.startsWith('http')) return value;

    const marker = '/storage/v1/object/public/fish-images/';
    const markerIndex = value.indexOf(marker);
    if (markerIndex === -1) return null;

    return value.slice(markerIndex + marker.length);
}

async function resolveImageUrl(imageValue) {
    if (!imageValue) return '';
    if (imageValue.startsWith('http')) return imageValue;

    const { data, error } = await supabase
        .storage
        .from('fish-images')
        .createSignedUrl(imageValue, 60 * 60);

    if (error) {
        console.error('Fel vid hämtning av bild-URL:', error);
        return '';
    }

    return data.signedUrl;
}

function getLocationStats() {
    const locations = new Map();

    catches.forEach(catchItem => {
        const key = catchItem.location.trim();
        const current = locations.get(key) || { location: key, count: 0, totalWeight: 0 };
        current.count += 1;
        current.totalWeight += catchItem.weight || 0;
        locations.set(key, current);
    });

    return [...locations.values()].sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.totalWeight - a.totalWeight;
    });
}

function getSpeciesStats() {
    const speciesMap = new Map();

    catches.forEach(catchItem => {
        const key = catchItem.species.trim();
        const current = speciesMap.get(key) || { species: key, count: 0 };
        current.count += 1;
        speciesMap.set(key, current);
    });

    return [...speciesMap.values()].sort((a, b) => b.count - a.count);
}

function updateAuthUI() {
    const loggedIn = Boolean(currentUser);

    authSection.classList.toggle('hidden', loggedIn);
    appSection.classList.toggle('hidden', !loggedIn);
    logoutBtn.classList.toggle('visible', loggedIn);
    userStatus.textContent = loggedIn
        ? `Inloggad som ${currentUser.email}`
        : 'Inte inloggad';
}

function clearAppState() {
    catches = [];
    updateFilterOptions();
    displayCollection([]);
    displayStats();
    closeModal();
}

async function refreshAuthState(session) {
    currentUser = session?.user || null;
    updateAuthUI();

    if (currentUser) {
        await loadCatches();
        return;
    }

    clearAppState();
}

async function loadCatches() {
    if (!currentUser) {
        clearAppState();
        return;
    }

    const { data, error } = await supabase
        .from('catches')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('catch_date', { ascending: false });

    if (error) {
        console.error('Fel vid hämtning:', error);
        showSuccess('Kunde inte läsa in dina fångster just nu.');
        return;
    }

    catches = await Promise.all((data || []).map(async item => ({
        id: item.id,
        species: item.species,
        weight: Number(item.weight),
        length: item.length ? Number(item.length) : null,
        location: item.location,
        date: item.catch_date,
        notes: item.notes,
        imagePath: getStoragePathFromValue(item.image_url),
        image: await resolveImageUrl(item.image_url)
    })));

    updateFilterOptions();
    displayCollection();
    displayStats();
}

function showView(viewName, btn) {
    if (!currentUser) return;

    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(navButton => navButton.classList.remove('active'));

    document.getElementById(viewName).classList.add('active');
    if (btn) btn.classList.add('active');

    if (viewName === 'collection') {
        updateFilterOptions();
        displayCollection();
    }

    if (viewName === 'stats') {
        displayStats();
    }
}

function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = loadEvent => {
        const preview = document.getElementById('imagePreview');
        const uploadText = document.getElementById('uploadText');
        const uploadArea = document.getElementById('imageUploadArea');

        preview.src = loadEvent.target.result;
        preview.style.display = 'block';
        uploadText.style.display = 'none';
        uploadArea.classList.add('has-image');
    };

    reader.readAsDataURL(file);
}

function resetForm() {
    document.getElementById('addFishForm').reset();
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('uploadText').style.display = 'block';
    document.getElementById('imageUploadArea').classList.remove('has-image');

    if (fishDateInput) {
        fishDateInput.valueAsDate = new Date();
    }
}

function showSuccess(msg) {
    const div = document.createElement('div');
    div.className = 'success-message';
    div.textContent = msg;
    document.body.appendChild(div);

    setTimeout(() => div.remove(), 3000);
}

async function handleAuthFormSubmit(type, email, password) {
    if (!email || !password) return;

    const action = type === 'login'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { data, error } = await action;

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    if (type === 'signup') {
        if (data.session) {
            showSuccess('Konto skapat och du är nu inloggad.');
        } else {
            showSuccess('Konto skapat. Kolla din e-post om bekräftelse krävs.');
        }
    } else {
        showSuccess('Välkommen tillbaka!');
    }
}

if (loginForm) {
    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        await handleAuthFormSubmit(
            'login',
            document.getElementById('loginEmail').value.trim(),
            document.getElementById('loginPassword').value
        );
        loginForm.reset();
    });
}

if (signupForm) {
    signupForm.addEventListener('submit', async event => {
        event.preventDefault();
        await handleAuthFormSubmit(
            'signup',
            document.getElementById('signupEmail').value.trim(),
            document.getElementById('signupPassword').value
        );
        signupForm.reset();
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error(error);
            alert('Kunde inte logga ut just nu.');
            return;
        }

        showSuccess('Du är nu utloggad.');
    });
}

if (addFishForm) {
    addFishForm.addEventListener('submit', async event => {
        event.preventDefault();

        if (!currentUser) {
            alert('Du måste vara inloggad för att spara en fångst.');
            return;
        }

        const imageFile = document.getElementById('fishImage').files[0];

        if (!imageFile) {
            alert('⚠️ Du måste ladda upp en bild!');
            return;
        }

        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${currentUser.id}/${fileName}`;

        const { error: uploadError } = await supabase
            .storage
            .from('fish-images')
            .upload(filePath, imageFile, { upsert: false });

        if (uploadError) {
            console.error(uploadError);
            alert('Kunde inte ladda upp bild');
            return;
        }

        const newCatch = {
            user_id: currentUser.id,
            species: document.getElementById('fishSpecies').value,
            weight: parseFloat(document.getElementById('fishWeight').value),
            length: parseFloat(document.getElementById('fishLength').value) || null,
            location: document.getElementById('fishLocation').value,
            catch_date: document.getElementById('fishDate').value,
            notes: document.getElementById('fishNotes').value,
            image_url: filePath
        };

        const { error: insertError } = await supabase
            .from('catches')
            .insert([newCatch]);

        if (insertError) {
            console.error(insertError);
            alert('Kunde inte spara fångst');
            return;
        }

        showSuccess('🎉 Sparad!');
        resetForm();
        await loadCatches();

        const collectionBtn = document.querySelectorAll('.nav-btn')[1];
        showView('collection', collectionBtn);
    });
}

async function deleteFish(id) {
    if (!currentUser) return;

    const fish = catches.find(catchItem => catchItem.id === id);
    const confirmed = confirm('Är du säker på att du vill ta bort denna fångst?');
    if (!confirmed) return;

    const { error } = await supabase
        .from('catches')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id);

    if (error) {
        console.error(error);
        alert('Kunde inte ta bort fångsten');
        return;
    }

    if (fish?.imagePath) {
        const { error: storageError } = await supabase
            .storage
            .from('fish-images')
            .remove([fish.imagePath]);

        if (storageError) {
            console.error('Kunde inte ta bort bildfilen:', storageError);
        }
    }

    closeModal();
    await loadCatches();
    showSuccess('🗑️ Fångst borttagen');
}

function updateFilterOptions() {
    const species = [...new Set(catches.map(catchItem => catchItem.species))];
    const locations = [...new Set(catches.map(catchItem => catchItem.location))];

    const speciesSelect = document.getElementById('filterSpecies');
    const locationSelect = document.getElementById('filterLocation');

    if (!speciesSelect || !locationSelect) return;

    speciesSelect.innerHTML = '<option value="">Alla fiskar</option>';
    locationSelect.innerHTML = '<option value="">Alla platser</option>';

    species.forEach(species => {
        speciesSelect.innerHTML += `<option value="${species}">${species}</option>`;
    });

    locations.forEach(location => {
        locationSelect.innerHTML += `<option value="${location}">${location}</option>`;
    });
}

function filterCollection() {
    const speciesFilter = document.getElementById('filterSpecies').value;
    const locationFilter = document.getElementById('filterLocation').value;
    const sortBy = document.getElementById('sortBy').value;

    const filtered = catches.filter(catchItem => {
        if (speciesFilter && catchItem.species !== speciesFilter) return false;
        if (locationFilter && catchItem.location !== locationFilter) return false;
        return true;
    });

    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'date-desc': return new Date(b.date) - new Date(a.date);
            case 'date-asc': return new Date(a.date) - new Date(b.date);
            case 'weight-desc': return b.weight - a.weight;
            case 'weight-asc': return a.weight - b.weight;
            default: return 0;
        }
    });

    displayCollection(filtered);
}

function displayCollection(list = catches) {
    const container = document.getElementById('collectionContainer');
    if (!container) return;

    if (!list.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎣</div>
                <p>Ingen fångst ännu. Lägg till din första fisk för att fylla samlingen.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(fish => `
        <div class="fish-card" onclick="showFishDetail('${fish.id}')">
            <img src="${escapeHtml(fish.image)}" class="fish-image" alt="${escapeHtml(fish.species)}">
            <div class="fish-info">
                <div class="fish-species">${escapeHtml(fish.species)}</div>
                <div class="fish-details">
                    <span class="detail-badge">⚖️ ${formatWeight(fish.weight)}</span>
                    <span class="detail-badge">📍 ${escapeHtml(fish.location)}</span>
                    <span class="detail-badge">📅 ${formatDate(fish.date)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function showFishDetail(id) {
    const fish = catches.find(catchItem => catchItem.id === id);
    if (!fish) return;

    const modal = document.getElementById('fishModal');
    const content = document.getElementById('modalContent');

    content.innerHTML = `
        <img src="${escapeHtml(fish.image)}" alt="${escapeHtml(fish.species)}" class="modal-image">
        <h2 class="modal-title">${escapeHtml(fish.species)}</h2>
        <div class="modal-grid">
            <div class="detail-badge modal-badge">⚖️ ${formatWeight(fish.weight)}</div>
            <div class="detail-badge modal-badge">📏 ${formatLength(fish.length)}</div>
            <div class="detail-badge modal-badge-full">📍 ${escapeHtml(fish.location)}</div>
            <div class="detail-badge modal-badge-full last">📅 ${formatDate(fish.date)}</div>
        </div>
        ${fish.notes ? `
            <div class="notes-box">
                <strong class="notes-title">Anteckningar</strong>
                <p class="notes-text">${escapeHtml(fish.notes)}</p>
            </div>
        ` : ''}
        <button class="delete-btn" onclick="deleteFish('${fish.id}')">🗑️ Ta bort fångst</button>
    `;

    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('fishModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function displayStats() {
    const statsContainer = document.getElementById('statsContainer');
    const topFishContainer = document.getElementById('topFishContainer');
    const topLocationsContainer = document.getElementById('topLocationsContainer');

    if (!statsContainer || !topFishContainer || !topLocationsContainer) return;

    if (!catches.length) {
        statsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p>Ingen statistik ännu. När du loggar fångster visas din översikt här.</p>
            </div>
        `;
        topFishContainer.innerHTML = '';
        topLocationsContainer.innerHTML = '';
        return;
    }

    const totalCatches = catches.length;
    const totalWeight = catches.reduce((sum, fish) => sum + (fish.weight || 0), 0);
    const averageWeight = totalWeight / totalCatches;
    const biggestCatch = catches.reduce((biggest, fish) => (
        !biggest || fish.weight > biggest.weight ? fish : biggest
    ), null);
    const speciesStats = getSpeciesStats();
    const locationStats = getLocationStats();
    const heaviestFive = [...catches]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5);

    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalCatches}</div>
            <div class="stat-label">Totala fångster</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalWeight.toFixed(1)}</div>
            <div class="stat-label">Total vikt i kilo</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${averageWeight.toFixed(2)}</div>
            <div class="stat-label">Snittvikt per fisk</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${speciesStats.length}</div>
            <div class="stat-label">Unika fiskarter</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${escapeHtml(biggestCatch.species)}</div>
            <div class="stat-label">Största fisken: ${formatWeight(biggestCatch.weight)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${escapeHtml(locationStats[0].location)}</div>
            <div class="stat-label">Mest fiskade platsen (${locationStats[0].count} st)</div>
        </div>
    `;

    topFishContainer.innerHTML = heaviestFive.map((fish, index) => `
        <div class="top-item" onclick="showFishDetail('${fish.id}')">
            <div class="rank-number">#${index + 1}</div>
            <img src="${escapeHtml(fish.image)}" alt="${escapeHtml(fish.species)}" class="top-fish-image">
            <div class="top-item-content">
                <div class="top-item-title">${escapeHtml(fish.species)} • ${formatWeight(fish.weight)}</div>
                <div class="top-item-meta">${escapeHtml(fish.location)} • ${formatDate(fish.date)}${fish.length ? ` • ${formatLength(fish.length)}` : ''}</div>
            </div>
        </div>
    `).join('');

    topLocationsContainer.innerHTML = locationStats.slice(0, 5).map((location, index) => `
        <div class="location-item">
            <div class="location-left">
                <div class="rank-number">#${index + 1}</div>
                <div>
                    <div class="top-item-title">${escapeHtml(location.location)}</div>
                    <div class="top-item-meta">${location.totalWeight.toFixed(1)} kg total fångstvikt</div>
                </div>
            </div>
            <div class="location-count">${location.count} st</div>
        </div>
    `).join('');
}

async function initAuth() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Fel vid sessionshämtning:', error);
    }

    await refreshAuthState(data?.session || null);

    supabase.auth.onAuthStateChange(async (_event, session) => {
        await refreshAuthState(session);
    });
}

window.showView = showView;
window.previewImage = previewImage;
window.resetForm = resetForm;
window.filterCollection = filterCollection;
window.showFishDetail = showFishDetail;
window.closeModal = closeModal;
window.deleteFish = deleteFish;

initAuth();
