import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
    'https://ixyirvchechxbkjocvlw.supabase.co',
    'sb_publishable__j0qhEE6GtGmF_FgCOcrKA_alIdEc-v'
);

let catches = [];

document.getElementById('fishDate').valueAsDate = new Date();

async function loadCatches() {
    const { data, error } = await supabase
        .from('catches')
        .select('*')
        .order('catch_date', { ascending: false });

    if (error) {
        console.error('Fel vid hämtning:', error);
        return;
    }

    catches = (data || []).map(item => ({
        id: item.id,
        species: item.species,
        weight: Number(item.weight),
        length: item.length ? Number(item.length) : null,
        location: item.location,
        date: item.catch_date,
        notes: item.notes,
        image: item.image_url
    }));

    updateFilterOptions();
    displayCollection();
    displayStats();
}

function showView(viewName, btn) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

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
    reader.onload = e => {
        const preview = document.getElementById('imagePreview');
        const uploadText = document.getElementById('uploadText');
        const uploadArea = document.getElementById('imageUploadArea');

        preview.src = e.target.result;
        preview.style.display = 'block';
        uploadText.style.display = 'none';
        uploadArea.classList.add('has-image');
    };

    reader.readAsDataURL(file);
}

document.getElementById('addFishForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const imageFile = document.getElementById('fishImage').files[0];

    if (!imageFile) {
        alert('⚠️ Du måste ladda upp en bild av fisken!');
        return;
    }

    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `catches/${fileName}`;

    const { error: uploadError } = await supabase
        .storage
        .from('fish-images')
        .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        console.error('Fel vid bilduppladdning:', uploadError);
        alert('Kunde inte ladda upp bilden. Kolla bucket/policies i Supabase.');
        return;
    }

    const { data: publicUrlData } = supabase
        .storage
        .from('fish-images')
        .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    const newCatch = {
        species: document.getElementById('fishSpecies').value,
        weight: parseFloat(document.getElementById('fishWeight').value),
        length: parseFloat(document.getElementById('fishLength').value) || null,
        location: document.getElementById('fishLocation').value,
        catch_date: document.getElementById('fishDate').value,
        notes: document.getElementById('fishNotes').value,
        image_url: imageUrl
    };

    const { error: insertError } = await supabase
        .from('catches')
        .insert([newCatch]);

    if (insertError) {
        console.error('Fel vid sparning:', insertError);
        alert('Kunde inte spara fångsten i databasen.');
        return;
    }

    showSuccess('🎉 Fångst sparad!');
    resetForm();
    await loadCatches();

    const collectionBtn = document.querySelectorAll('.nav-btn')[1];
    showView('collection', collectionBtn);
});

function resetForm() {
    document.getElementById('addFishForm').reset();
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('uploadText').style.display = 'block';
    document.getElementById('imageUploadArea').classList.remove('has-image');
    document.getElementById('fishDate').valueAsDate = new Date();
}

function showSuccess(message) {
    const div = document.createElement('div');
    div.className = 'success-message';
    div.textContent = message;
    document.body.appendChild(div);

    setTimeout(() => div.remove(), 3000);
}

function updateFilterOptions() {
    const species = [...new Set(catches.map(c => c.species))];
    const locations = [...new Set(catches.map(c => c.location))];

    const speciesSelect = document.getElementById('filterSpecies');
    const locationSelect = document.getElementById('filterLocation');

    speciesSelect.innerHTML = '<option value="">Alla fiskar</option>';
    locationSelect.innerHTML = '<option value="">Alla platser</option>';

    species.forEach(speciesName => {
        speciesSelect.innerHTML += `<option value="${speciesName}">${speciesName}</option>`;
    });

    locations.forEach(locationName => {
        locationSelect.innerHTML += `<option value="${locationName}">${locationName}</option>`;
    });
}

function filterCollection() {
    const speciesFilter = document.getElementById('filterSpecies').value;
    const locationFilter = document.getElementById('filterLocation').value;
    const sortBy = document.getElementById('sortBy').value;

    let filtered = catches.filter(c => {
        if (speciesFilter && c.species !== speciesFilter) return false;
        if (locationFilter && c.location !== locationFilter) return false;
        return true;
    });

    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'date-desc':
                return new Date(b.date) - new Date(a.date);
            case 'date-asc':
                return new Date(a.date) - new Date(b.date);
            case 'weight-desc':
                return b.weight - a.weight;
            case 'weight-asc':
                return a.weight - b.weight;
            default:
                return 0;
        }
    });

    displayCollection(filtered);
}

function displayCollection(fishList = catches) {
    const container = document.getElementById('collectionContainer');

    if (!fishList.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎣</div>
                <h3>Ingen fångst ännu</h3>
                <p>Börja logga dina fångster för att bygga din samling!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = fishList.map(fish => `
        <div class="fish-card" onclick="showFishDetail('${fish.id}')">
            <img src="${fish.image}" alt="${fish.species}" class="fish-image">
            <div class="fish-info">
                <div class="fish-species">${fish.species}</div>
                <div class="fish-details">
                    <span class="detail-badge">⚖️ ${fish.weight} kg</span>
                    ${fish.length ? `<span class="detail-badge">📏 ${fish.length} cm</span>` : ''}
                    <span class="detail-badge">📍 ${fish.location}</span>
                    <span class="detail-badge">📅 ${new Date(fish.date).toLocaleDateString('sv-SE')}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function showFishDetail(id) {
    const fish = catches.find(c => c.id === id);
    if (!fish) return;

    const modal = document.getElementById('fishModal');
    const content = document.getElementById('modalContent');

    content.innerHTML = `
        <img src="${fish.image}" alt="${fish.species}" style="width: 100%; border-radius: 12px; margin-bottom: 20px;">
        <h2 style="color: var(--primary); margin-bottom: 16px;">${fish.species}</h2>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div class="detail-badge" style="justify-content: center;">⚖️ ${fish.weight} kg</div>
            ${fish.length ? `<div class="detail-badge" style="justify-content: center;">📏 ${fish.length} cm</div>` : '<div></div>'}
        </div>

        <div class="detail-badge" style="width: 100%; justify-content: center; margin-bottom: 12px;">
            📍 ${fish.location}
        </div>

        <div class="detail-badge" style="width: 100%; justify-content: center; margin-bottom: 20px;">
            📅 ${new Date(fish.date).toLocaleDateString('sv-SE', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}
        </div>

        ${fish.notes ? `
            <div style="background: var(--bg-main); padding: 16px; border-radius: 8px; margin-top: 20px;">
                <strong style="color: var(--text-secondary); display: block; margin-bottom: 8px;">📝 Anteckningar:</strong>
                <p style="line-height: 1.6;">${fish.notes}</p>
            </div>
        ` : ''}

        <button class="delete-btn" onclick="deleteFish('${fish.id}')">🗑️ Ta bort fångst</button>
    `;

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('fishModal').classList.remove('active');
}

async function deleteFish(id) {
    if (!confirm('Är du säker på att du vill ta bort denna fångst?')) return;

    const fish = catches.find(c => c.id === id);

    const { error } = await supabase
        .from('catches')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Fel vid borttagning:', error);
        alert('Kunde inte ta bort fångsten.');
        return;
    }

    if (fish?.image) {
        try {
            const url = new URL(fish.image);
            const pathParts = url.pathname.split('/object/public/fish-images/');
            if (pathParts[1]) {
                await supabase.storage.from('fish-images').remove([pathParts[1]]);
            }
        } catch (e) {
            console.warn('Kunde inte ta bort bildfilen:', e);
        }
    }

    closeModal();
    await loadCatches();
    showSuccess('🗑️ Fångst borttagen');
}

function displayStats() {
    const statsContainer = document.getElementById('statsContainer');
    const topFishContainer = document.getElementById('topFishContainer');
    const topLocationsContainer = document.getElementById('topLocationsContainer');

    if (!catches.length) {
        statsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <h3>Ingen statistik ännu</h3>
                <p>Börja logga fångster för att se din statistik!</p>
            </div>
        `;
        topFishContainer.innerHTML = '';
        topLocationsContainer.innerHTML = '';
        return;
    }

    const totalCatches = catches.length;
    const totalWeight = catches.reduce((sum, c) => sum + c.weight, 0);
    const avgWeight = totalWeight / totalCatches;
    const heaviestFish = Math.max(...catches.map(c => c.weight));
    const uniqueSpecies = [...new Set(catches.map(c => c.species))].length;
    const uniqueLocations = [...new Set(catches.map(c => c.location))].length;

    statsContainer.innerHTML = `
        <div class="stat-card"><div class="stat-value">${totalCatches}</div><div class="stat-label">Totala fångster</div></div>
        <div class="stat-card"><div class="stat-value">${totalWeight.toFixed(1)}</div><div class="stat-label">kg total vikt</div></div>
        <div class="stat-card"><div class="stat-value">${avgWeight.toFixed(1)}</div><div class="stat-label">kg genomsnittsvikt</div></div>
        <div class="stat-card"><div class="stat-value">${heaviestFish}</div><div class="stat-label">kg största fisken</div></div>
        <div class="stat-card"><div class="stat-value">${uniqueSpecies}</div><div class="stat-label">olika arter</div></div>
        <div class="stat-card"><div class="stat-value">${uniqueLocations}</div><div class="stat-label">olika platser</div></div>
    `;

    const topFish = [...catches].sort((a, b) => b.weight - a.weight).slice(0, 5);
    topFishContainer.innerHTML = `
        <div class="card">
            ${topFish.map((fish, index) => `
                <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-main); border-radius: 8px; margin-bottom: 12px; cursor: pointer;" onclick="showFishDetail('${fish.id}')">
                    <div style="font-size: 32px; font-weight: 800; color: var(--primary); min-width: 40px;">#${index + 1}</div>
                    <img src="${fish.image}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 18px; margin-bottom: 4px;">${fish.species}</div>
                        <div style="color: var(--text-secondary); font-size: 14px;">
                            ⚖️ ${fish.weight} kg • 📍 ${fish.location} • 📅 ${new Date(fish.date).toLocaleDateString('sv-SE')}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    const locationCounts = {};
    catches.forEach(c => {
        locationCounts[c.location] = (locationCounts[c.location] || 0) + 1;
    });

    const topLocations = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    topLocationsContainer.innerHTML = `
        <div class="card">
            ${topLocations.map(([location, count], index) => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: var(--bg-main); border-radius: 8px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="font-size: 32px; font-weight: 800; color: var(--primary); min-width: 40px;">#${index + 1}</div>
                        <div>
                            <div style="font-weight: 700; font-size: 18px;">📍 ${location}</div>
                            <div style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">
                                ${count} fångst${count > 1 ? 'er' : ''}
                            </div>
                        </div>
                    </div>
                    <div style="background: var(--primary); color: white; padding: 8px 16px; border-radius: 8px; font-weight: 700;">
                        ${count}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

document.getElementById('fishModal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
});

const uploadArea = document.getElementById('imageUploadArea');

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--primary)';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = 'var(--border)';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--border)';

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const input = document.getElementById('fishImage');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        previewImage({ target: input });
    }
});

// Gör funktionerna tillgängliga för onclick i HTML
window.showView = showView;
window.previewImage = previewImage;
window.resetForm = resetForm;
window.filterCollection = filterCollection;
window.showFishDetail = showFishDetail;
window.closeModal = closeModal;
window.deleteFish = deleteFish;

loadCatches();