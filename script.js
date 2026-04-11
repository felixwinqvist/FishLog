import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
    'https://ixyirvchechxbkjocvlw.supabase.co',
    'sb_publishable__j0qhEE6GtGmF_FgCOcrKA_alIdEc-v'
);

let catches = [];

// ======================
// INIT
// ======================
const fishDateInput = document.getElementById('fishDate');
if (fishDateInput) {
    fishDateInput.valueAsDate = new Date();
}


// ======================
// LOAD DATA
// ======================
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


// ======================
// NAVIGATION
// ======================
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


// ======================
// IMAGE PREVIEW
// ======================
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


// ======================
// ADD FISH
// ======================
const addFishForm = document.getElementById('addFishForm');

if (addFishForm) {
    addFishForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const imageFile = document.getElementById('fishImage').files[0];

        if (!imageFile) {
            alert('⚠️ Du måste ladda upp en bild!');
            return;
        }

        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `catches/${fileName}`;

        const { error: uploadError } = await supabase
            .storage
            .from('fish-images')
            .upload(filePath, imageFile);

        if (uploadError) {
            console.error(uploadError);
            alert('Kunde inte ladda upp bild');
            return;
        }

        const { data } = supabase
            .storage
            .from('fish-images')
            .getPublicUrl(filePath);

        const imageUrl = data.publicUrl;

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


// ======================
// DELETE FISH
// ======================
async function deleteFish(id) {
    const confirmed = confirm('Är du säker på att du vill ta bort denna fångst?');
    if (!confirmed) return;

    const { error } = await supabase
        .from('catches')
        .delete()
        .eq('id', id);

    if (error) {
        console.error(error);
        alert('Kunde inte ta bort fångsten');
        return;
    }

    closeModal();
    await loadCatches();
    showSuccess('🗑️ Fångst borttagen');
}


// ======================
// RESET FORM
// ======================
function resetForm() {
    document.getElementById('addFishForm').reset();
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('uploadText').style.display = 'block';
    document.getElementById('imageUploadArea').classList.remove('has-image');
}


// ======================
// SUCCESS MESSAGE
// ======================
function showSuccess(msg) {
    const div = document.createElement('div');
    div.className = 'success-message';
    div.textContent = msg;
    document.body.appendChild(div);

    setTimeout(() => div.remove(), 3000);
}


// ======================
// FILTER OPTIONS
// ======================
function updateFilterOptions() {
    const species = [...new Set(catches.map(c => c.species))];
    const locations = [...new Set(catches.map(c => c.location))];

    const speciesSelect = document.getElementById('filterSpecies');
    const locationSelect = document.getElementById('filterLocation');

    if (!speciesSelect || !locationSelect) return;

    speciesSelect.innerHTML = '<option value="">Alla fiskar</option>';
    locationSelect.innerHTML = '<option value="">Alla platser</option>';

    species.forEach(s => {
        speciesSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });

    locations.forEach(l => {
        locationSelect.innerHTML += `<option value="${l}">${l}</option>`;
    });
}


// ======================
// FILTER COLLECTION
// ======================
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
            case 'date-desc': return new Date(b.date) - new Date(a.date);
            case 'date-asc': return new Date(a.date) - new Date(b.date);
            case 'weight-desc': return b.weight - a.weight;
            case 'weight-asc': return a.weight - b.weight;
            default: return 0;
        }
    });

    displayCollection(filtered);
}


// ======================
// DISPLAY COLLECTION
// ======================
function displayCollection(list = catches) {
    const container = document.getElementById('collectionContainer');

    if (!list.length) {
        container.innerHTML = '<p>Ingen fångst ännu</p>';
        return;
    }

    container.innerHTML = list.map(fish => `
        <div class="fish-card" onclick="showFishDetail('${fish.id}')">
            <img src="${fish.image}" class="fish-image">
            <div class="fish-info">
                <div class="fish-species">${fish.species}</div>
                <div>${fish.weight} kg</div>
            </div>
        </div>
    `).join('');
}


// ======================
// DETAIL MODAL
// ======================
function showFishDetail(id) {
    const fish = catches.find(c => c.id === id);
    if (!fish) return;

    const modal = document.getElementById('fishModal');
    const content = document.getElementById('modalContent');

    content.innerHTML = `
        <img src="${fish.image}" style="width:100%; margin-bottom:20px;">
        <h2>${fish.species}</h2>
        <p>${fish.weight} kg</p>
        <button class="delete-btn" onclick="deleteFish('${fish.id}')">🗑️ Ta bort fångst</button>
    `;

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('fishModal').classList.remove('active');
}


// ======================
// STATS
// ======================
function displayStats() {
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) return;

    statsContainer.innerHTML = `<div>${catches.length} fångster</div>`;
}


// ======================
// GLOBAL (VIKTIGT)
// ======================
window.showView = showView;
window.previewImage = previewImage;
window.resetForm = resetForm;
window.filterCollection = filterCollection;
window.showFishDetail = showFishDetail;
window.closeModal = closeModal;
window.deleteFish = deleteFish;


// ======================
// START
// ======================
loadCatches();