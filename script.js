import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
    'https://ixyirvchechxbkjocvlw.supabase.co',
    'sb_publishable__j0qhEE6GtGmF_FgCOcrKA_alIdEc-v'
);

let catches = [];

// Sätt dagens datum
document.getElementById('fishDate').valueAsDate = new Date();


// ======================
// LOAD DATA
// ======================
async function loadCatches() {
    const { data, error } = await supabase
        .from('catches')
        .select('*')
        .order('catch_date', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    catches = data.map(item => ({
        id: item.id,
        species: item.species,
        weight: Number(item.weight),
        length: item.length,
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

    if (viewName === 'collection') displayCollection();
    if (viewName === 'stats') displayStats();
}


// ======================
// IMAGE PREVIEW
// ======================
function previewImage(event) {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('imagePreview').src = e.target.result;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('uploadText').style.display = 'none';
        document.getElementById('imageUploadArea').classList.add('has-image');
    };

    reader.readAsDataURL(file);
}


// ======================
// ADD FISH
// ======================
document.getElementById('addFishForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const imageFile = document.getElementById('fishImage').files[0];

    if (!imageFile) {
        alert('Ladda upp bild!');
        return;
    }

    // Upload bild
    const fileName = `${Date.now()}-${imageFile.name}`;

    const { error: uploadError } = await supabase
        .storage
        .from('fish-images')
        .upload(fileName, imageFile);

    if (uploadError) {
        console.error(uploadError);
        alert('Bild upload fail');
        return;
    }

    const { data } = supabase
        .storage
        .from('fish-images')
        .getPublicUrl(fileName);

    const imageUrl = data.publicUrl;

    // Spara i DB
    const { error } = await supabase
        .from('catches')
        .insert([{
            species: document.getElementById('fishSpecies').value,
            weight: parseFloat(document.getElementById('fishWeight').value),
            length: parseFloat(document.getElementById('fishLength').value) || null,
            location: document.getElementById('fishLocation').value,
            catch_date: document.getElementById('fishDate').value,
            notes: document.getElementById('fishNotes').value,
            image_url: imageUrl
        }]);

    if (error) {
        console.error(error);
        alert('DB fail');
        return;
    }

    showSuccess('Sparad!');
    resetForm();
    await loadCatches();
});


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
// SUCCESS
// ======================
function showSuccess(msg) {
    const div = document.createElement('div');
    div.className = 'success-message';
    div.textContent = msg;
    document.body.appendChild(div);

    setTimeout(() => div.remove(), 3000);
}


// ======================
// COLLECTION
// ======================
function displayCollection(list = catches) {
    const container = document.getElementById('collectionContainer');

    if (list.length === 0) {
        container.innerHTML = 'Inga fiskar ännu';
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
// DETAIL
// ======================
function showFishDetail(id) {
    const fish = catches.find(f => f.id == id);
    if (!fish) return;

    document.getElementById('modalContent').innerHTML = `
        <img src="${fish.image}" style="width:100%">
        <h2>${fish.species}</h2>
        <p>${fish.weight} kg</p>
        <button onclick="deleteFish('${fish.id}')">Delete</button>
    `;

    document.getElementById('fishModal').classList.add('active');
}

function closeModal() {
    document.getElementById('fishModal').classList.remove('active');
}


// ======================
// DELETE
// ======================
async function deleteFish(id) {
    await supabase.from('catches').delete().eq('id', id);
    await loadCatches();
    closeModal();
}


// ======================
// STATS
// ======================
function displayStats() {
    document.getElementById('statsContainer').innerHTML =
        `<div>${catches.length} fångster</div>`;
}


// ======================
// FILTER OPTIONS
// ======================
function updateFilterOptions() {
    // (kan fyllas i senare)
}


// ======================
// INIT
// ======================
loadCatches();