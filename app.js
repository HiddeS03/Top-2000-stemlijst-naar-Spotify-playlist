// Configuration - Replace with your Spotify Client ID
const SPOTIFY_CLIENT_ID = '85433013fad94ad6815d46f523e92768'; // Add your Spotify Client ID here
const SPOTIFY_REDIRECT_URI = window.location.origin + window.location.pathname;
const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SPOTIFY_SCOPES = 'playlist-modify-public playlist-modify-private';

// State
let npoLink = '';
let loading = false;
let error = '';
let success = '';
let songs = [];
let accessToken = '';

// DOM Elements
const npoLinkInput = document.getElementById('npo-link-input');
const inputForm = document.getElementById('input-form');
const errorMessageDiv = document.getElementById('error-message');
const successMessageDiv = document.getElementById('success-message');
const songsSection = document.getElementById('songs-section');
const songsList = document.getElementById('songs-list');
const songsCount = document.getElementById('songs-count');
const configWarning = document.getElementById('config-warning');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const loadingProgress = document.getElementById('loading-progress');
const playlistContext = document.getElementById('playlist-context');

// Step sections
const stepConnect = document.getElementById('step-connect');
const stepPlaylist = document.getElementById('step-playlist');
const stepUrl = document.getElementById('step-url');
const logoutSection = document.getElementById('logout-section');

// Buttons
const connectSpotifyButton = document.getElementById('connect-spotify-button');
const logoutButton = document.getElementById('logout-button');
const createNewPlaylistButton = document.getElementById('create-new-playlist-button');
const selectExistingPlaylistButton = document.getElementById('select-existing-playlist-button');
const changePlaylistButton = document.getElementById('change-playlist-button');
const loadSongsButton = document.getElementById('load-songs-button');
const addAllButton = document.getElementById('add-all-button');

// Playlist selection
const existingPlaylistSelector = document.getElementById('existing-playlist-selector');
const playlistDropdown = document.getElementById('playlist-dropdown');

// State
let selectedPlaylistMode = 'new'; // 'new' or 'existing'
let selectedPlaylistId = null;
let selectedPlaylistName = null;
let userPlaylists = [];

// Utility Functions
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = window.crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

function base64encode(input) {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function setLoading(isLoading, text = 'Bezig...', progress = '') {
    loading = isLoading;
    if (loadSongsButton) {
        loadSongsButton.disabled = isLoading;
    }
    npoLinkInput.disabled = isLoading;
    loadingOverlay.style.display = isLoading ? 'flex' : 'none';
    loadingText.textContent = text;
    loadingProgress.textContent = progress;
}

function showError(message) {
    error = message;
    errorMessageDiv.innerHTML = `<strong>Fout:</strong> ${message}`;
    errorMessageDiv.style.display = 'block';
    successMessageDiv.style.display = 'none';
}

function showSuccess(message) {
    success = message;
    successMessageDiv.innerHTML = `<strong>Gelukt:</strong> ${message}`;
    successMessageDiv.style.display = 'block';
    errorMessageDiv.style.display = 'none';
}

function hideMessages() {
    errorMessageDiv.style.display = 'none';
    successMessageDiv.style.display = 'none';
}

function updateUISteps() {
    if (!accessToken) {
        // Step 1: Not connected - show connect button
        stepConnect.style.display = 'block';
        stepPlaylist.style.display = 'none';
        stepUrl.style.display = 'none';
        songsSection.style.display = 'none';
        logoutSection.style.display = 'none';
    } else {
        // Step 2: Connected - show playlist selection and logout button
        stepConnect.style.display = 'none';
        stepPlaylist.style.display = 'block';
        stepUrl.style.display = 'none';
        logoutSection.style.display = 'block';
    }
}

function updatePlaylistContext() {
    if (selectedPlaylistMode === 'new') {
        const year = new Date().getFullYear();
        playlistContext.innerHTML = `Nieuwe afspeellijst maken: "NPO Radio 2 Top 2000 - ${year}"`;
    } else if (selectedPlaylistMode === 'existing' && selectedPlaylistName) {
        // Escape HTML to prevent XSS
        const escapedName = selectedPlaylistName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        playlistContext.innerHTML = `<strong>📝 Nummers toevoegen aan:</strong>"${escapedName}"`;
    }
}

function showUrlStep() {
    // Step 3: Show URL input, hide playlist selection, keep logout button visible
    stepPlaylist.style.display = 'none';
    stepUrl.style.display = 'block';
    logoutSection.style.display = 'block';
    updatePlaylistContext();
}

function showPlaylistSelection() {
    // Go back to playlist selection
    stepPlaylist.style.display = 'block';
    stepUrl.style.display = 'none';
    songsSection.style.display = 'none';
    existingPlaylistSelector.style.display = 'none';
    logoutSection.style.display = 'block';
    hideMessages();
}

function logout() {
    accessToken = '';
    songs = [];
    selectedPlaylistId = null;
    selectedPlaylistName = null;
    selectedPlaylistMode = 'new';
    userPlaylists = [];
    hideMessages();
    updateUISteps();
}

// Authentication Functions
async function exchangeCodeForToken(code, codeVerifier) {
    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier: codeVerifier,
    });

    try {
        console.log('🔄 Exchanging authorization code for access token...');
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Token exchange failed:', errorData);
            throw new Error(`Failed to exchange code for token: ${errorData.error_description || errorData.error}`);
        }

        const data = await response.json();
        console.log('✅ Successfully obtained access token');
        accessToken = data.access_token;
        sessionStorage.removeItem('code_verifier');
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Load user playlists
        loadUserPlaylists();
        
        updateUISteps();
        showSuccess('Succesvol verbonden met Spotify! Kies nu een afspeellijst optie.');
    } catch (err) {
        showError(`Failed to authenticate with Spotify: ${err.message}`);
        console.error('Token exchange error:', err);
        sessionStorage.removeItem('code_verifier');
    }
}

async function authenticateSpotify() {
    if (!SPOTIFY_CLIENT_ID) {
        showError('Spotify Client ID is niet geconfigureerd. Bekijk de setup-instructies in de README.');
        return;
    }

    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);

    sessionStorage.setItem('code_verifier', codeVerifier);

    const authUrl = `${SPOTIFY_AUTH_ENDPOINT}?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}&response_type=code&code_challenge_method=S256&code_challenge=${codeChallenge}&show_dialog=true`;
    window.location.href = authUrl;
}

async function loadUserPlaylists() {
    try {
        setLoading(true, 'Afspeellijsten ophalen...');
        
        const profileResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!profileResponse.ok) {
            throw new Error('Kon gebruikersprofiel niet ophalen');
        }
        
        const profile = await profileResponse.json();
        const userId = profile.id;
        
        // Fetch all user playlists
        let allPlaylists = [];
        let offset = 0;
        const limit = 50;
        
        while (true) {
            const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists?limit=${limit}&offset=${offset}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!response.ok) break;
            
            const data = await response.json();
            allPlaylists.push(...data.items);
            
            if (data.items.length < limit) break;
            offset += limit;
        }
        
        userPlaylists = allPlaylists;
        
        // Populate dropdown
        playlistDropdown.innerHTML = '<option value="">Selecteer een afspeellijst...</option>';
        allPlaylists.forEach(playlist => {
            const option = document.createElement('option');
            option.value = playlist.id;
            option.textContent = playlist.name;
            playlistDropdown.appendChild(option);
        });
        
        setLoading(false);
    } catch (err) {
        console.error('Error loading playlists:', err);
        setLoading(false);
    }
}

// NPO Fetching Functions
async function fetchSongsFromNPO(url) {
    setLoading(true, 'Nummers ophalen van NPO...');
    hideMessages();
    songs = [];
    songsSection.style.display = 'none';

    try {
        console.log('🔍 Fetching submission page:', url);

        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        console.log('🔄 Using CORS proxy:', proxyUrl);

        const response = await fetch(proxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            console.error('❌ HTTP Error:', response.status, response.statusText);
            throw new Error(`Kon de inzending niet ophalen (${response.status}). De link is mogelijk ongeldig of verlopen.`);
        }

        const html = await response.text();
        console.log('📄 HTML length:', html.length);
        console.log('📄 First 500 chars:', html.substring(0, 500));

        // Look for __NEXT_DATA__ script tag
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        if (nextDataMatch) {
            console.log('✅ Found __NEXT_DATA__ script tag');
            try {
                const nextData = JSON.parse(nextDataMatch[1]);
                console.log('📦 __NEXT_DATA__ structure:', JSON.stringify(nextData, null, 2));
            } catch (e) {
                console.error('❌ Failed to parse __NEXT_DATA__:', e);
            }
        } else {
            console.log('⚠️ No __NEXT_DATA__ script tag found');
        }

        // Look for self.__next_f.push blocks
        const pushBlocks = html.match(/self\.__next_f\.push\(\[.*?\]\)/g);
        if (!pushBlocks) {
            throw new Error('Kon geen Next.js data vinden op de pagina. De paginastructuur is mogelijk gewijzigd.');
        }

        console.log(`✅ Found ${pushBlocks.length} self.__next_f.push blocks`);
        
        let blocksWithSongs = [];
        for (let i = 0; i < pushBlocks.length; i++) {
            const block = pushBlocks[i];
            const hasArtist = block.includes('artist');
            const hasTitle = block.includes('title');
            const hasTracks = block.includes('tracks');
            
            if (hasArtist && hasTitle) {
                console.log(`📋 Block ${i}: length=${block.length}, hasArtist=${hasArtist}, hasTitle=${hasTitle}, hasTracks=${hasTracks}`);
                blocksWithSongs.push(i);
            }
        }
        
        console.log(`🎵 Blocks with song data: ${blocksWithSongs.join(', ')}`);
        
        let extractedSongs = [];
        for (let i = 0; i < pushBlocks.length; i++) {
            const block = pushBlocks[i];
            
            if (!block.includes('artist') || !block.includes('title')) {
                continue;
            }
            
            console.log(`🎵 Processing block ${i} for song extraction`);
            console.log('🎵 Block length:', block.length);
            console.log('🎵 Block preview (first 1000):', block.substring(0, 1000));
            
            try {
                const trackPattern = /\{[^}]*?"artist"[^}]*?"title"[^}]*?\}/g;
                const trackMatches = block.match(trackPattern);
                
                if (!trackMatches) {
                    console.log('⚠️ No track objects found with simple pattern, trying alternative...');
                    
                    const escapedPattern = /\{\\"artist\\":\\"([^"]+)\\",.*?\\"title\\":\\"([^"]+)\\"/g;
                    let match;
                    const tracks = [];
                    while ((match = escapedPattern.exec(block)) !== null) {
                        tracks.push({
                            artist: match[1],
                            title: match[2]
                        });
                    }
                    
                    if (tracks.length > 0) {
                        console.log(`✅ Extracted ${tracks.length} songs using escaped pattern`);
                        extractedSongs = tracks;
                        break;
                    }
                    continue;
                }
                
                console.log(`🔍 Found ${trackMatches.length} potential track objects`);
                
                const tracks = [];
                for (const trackStr of trackMatches) {
                    try {
                        let cleaned = trackStr.replace(/\\\\/g, '\\').replace(/\\"/g, '"');
                        const track = JSON.parse(cleaned);
                        
                        if (track.artist && track.title) {
                            tracks.push({
                                artist: track.artist,
                                title: track.title
                            });
                        }
                    } catch (e) {
                        const artistMatch = trackStr.match(/"artist"\s*:\s*"([^"]+)"/);
                        const titleMatch = trackStr.match(/"title"\s*:\s*"([^"]+)"/);
                        
                        if (artistMatch && titleMatch) {
                            tracks.push({
                                artist: artistMatch[1],
                                title: titleMatch[1]
                            });
                        }
                    }
                }
                
                if (tracks.length > 0) {
                    console.log(`✅ Extracted ${tracks.length} songs from track objects`);
                    extractedSongs = tracks;
                    break;
                }
            } catch (e) {
                console.error('❌ Error parsing tracks:', e);
            }
        }
        
        if (extractedSongs.length === 0) {
            throw new Error('Kon geen nummers vinden in de inzending. De pagina bevat mogelijk geen geldige inzending.');
        }

        console.log('🎵 Final extracted songs:', extractedSongs);
        songs = extractedSongs;
        displaySongs();
        return true;
    } catch (err) {
        showError(err.message || 'Er is een fout opgetreden bij het ophalen van de nummers.');
        console.error('❌ Error:', err);
        setLoading(false);
        throw err;
    }
}

// Spotify Functions
async function searchSpotifyTrack(title, artist, token) {
    const query = encodeURIComponent(`${title} ${artist}`);
    const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error('Zoeken op Spotify mislukt');
    }

    const data = await response.json();
    if (data.tracks && data.tracks.items.length > 0) {
        return data.tracks.items[0].uri;
    }
    return null;
}

async function findExistingPlaylist(userId, playlistName) {
    let offset = 0;
    const limit = 50;
    
    while (true) {
        const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists?limit=${limit}&offset=${offset}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const existingPlaylist = data.items.find(p => p.name === playlistName);
        
        if (existingPlaylist) {
            return existingPlaylist;
        }
        
        if (data.items.length < limit) {
            break;
        }
        
        offset += limit;
    }
    
    return null;
}

async function getExistingPlaylistTracks(playlistId) {
    const trackUris = [];
    let offset = 0;
    const limit = 100;
    
    while (true) {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            return trackUris;
        }

        const data = await response.json();
        trackUris.push(...data.items.map(item => item.track.uri));
        
        if (data.items.length < limit) {
            break;
        }
        
        offset += limit;
    }
    
    return trackUris;
}

async function addSongsToPlaylist(songIndices = null) {
    if (songs.length === 0) {
        showError('Haal eerst nummers op van NPO.');
        return;
    }

    setLoading(true, 'Voorbereiding...');
    hideMessages();

    try {
        let playlist;
        let playlistName;
        
        // Determine which playlist to use
        if (selectedPlaylistMode === 'new') {
            // Create new playlist
            setLoading(true, 'Nieuwe afspeellijst aanmaken...');
            const profileResponse = await fetch('https://api.spotify.com/v1/me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!profileResponse.ok) {
                throw new Error('Kon Spotify gebruikersprofiel niet ophalen.');
            }

            const profile = await profileResponse.json();
            playlistName = `NPO Radio 2 Top 2000 - ${new Date().getFullYear()}`;
            
            // Check if it already exists
            const existingPlaylist = await findExistingPlaylist(profile.id, playlistName);
            
            if (existingPlaylist) {
                playlist = existingPlaylist;
                console.log('✅ Using existing playlist:', playlist.name);
            } else {
                const playlistResponse = await fetch(`https://api.spotify.com/v1/users/${profile.id}/playlists`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: playlistName,
                        description: 'Gegenereerd van NPO Radio 2 Top 2000 stem-inzending',
                        public: false
                    })
                });

                if (!playlistResponse.ok) {
                    throw new Error('Kon Spotify afspeellijst niet aanmaken.');
                }

                playlist = await playlistResponse.json();
                console.log('✅ Created new playlist:', playlist.name);
            }
            
            // Cache the playlist ID and switch to 'existing' mode to prevent creating duplicate playlists
            selectedPlaylistId = playlist.id;
            selectedPlaylistName = playlist.name;
            selectedPlaylistMode = 'existing';
            console.log('✅ Cached playlist ID for future song additions:', selectedPlaylistId);
        } else {
            // Use selected existing playlist
            if (!selectedPlaylistId) {
                throw new Error('Geen afspeellijst geselecteerd.');
            }
            
            const playlistResponse = await fetch(`https://api.spotify.com/v1/playlists/${selectedPlaylistId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!playlistResponse.ok) {
                throw new Error('Kon afspeellijst niet ophalen.');
            }
            
            playlist = await playlistResponse.json();
            playlistName = playlist.name;
        }

        // Get existing tracks
        setLoading(true, 'Bestaande nummers ophalen...');
        const existingTrackUris = await getExistingPlaylistTracks(playlist.id);
        console.log(`📋 Playlist has ${existingTrackUris.length} existing tracks`);

        // Determine which songs to add
        const songsToAdd = songIndices ? songIndices.map(i => songs[i]) : songs;
        
        // Search for tracks
        setLoading(true, 'Nummers zoeken op Spotify...', '0/' + songsToAdd.length);
        const trackUris = [];
        let foundCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < songsToAdd.length; i++) {
            const song = songsToAdd[i];
            try {
                const uri = await searchSpotifyTrack(song.title, song.artist, accessToken);
                if (uri) {
                    // Only add if not already in playlist
                    if (!existingTrackUris.includes(uri)) {
                        trackUris.push(uri);
                        song.spotifyUri = uri;
                        song.added = true;
                    } else {
                        skippedCount++;
                        song.added = true;
                    }
                    foundCount++;
                }
            } catch {
                console.warn(`Niet gevonden: ${song.title} van ${song.artist}`);
            }
            
            if ((i + 1) % 10 === 0 || i === songsToAdd.length - 1) {
                setLoading(true, 'Nummers zoeken op Spotify...', `${i + 1}/${songsToAdd.length}`);
            }
        }

        if (trackUris.length === 0 && skippedCount === 0) {
            throw new Error('Kon geen nummers vinden op Spotify.');
        }

        // Add new tracks to playlist
        if (trackUris.length > 0) {
            setLoading(true, 'Nummers toevoegen aan afspeellijst...', `${trackUris.length} nieuwe nummers`);
            for (let i = 0; i < trackUris.length; i += 100) {
                const chunk = trackUris.slice(i, i + 100);
                await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        uris: chunk
                    })
                });
            }
        }

        setLoading(false);
        
        let message = '';
        if (trackUris.length > 0 && skippedCount > 0) {
            message = `${trackUris.length} nieuwe nummers toegevoegd! ${skippedCount} nummers stonden al in de afspeellijst.`;
        } else if (trackUris.length > 0) {
            message = `${trackUris.length} nummers toegevoegd aan "${playlistName}"!`;
        } else if (skippedCount > 0) {
            message = `Alle ${skippedCount} nummers stonden al in de afspeellijst.`;
        }
        
        showSuccess(message);
        
        // Refresh the song list to show added status
        displaySongs();
        
        // Open playlist in Spotify
        window.open(playlist.external_urls.spotify, '_blank');
    } catch (err) {
        showError(err.message || 'Er is een fout opgetreden bij het toevoegen van nummers.');
        console.error('Error:', err);
        setLoading(false);
    }
}

// Display Functions
function displaySongs() {
    songsList.innerHTML = '';
    songsCount.textContent = songs.length;
    
    for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        const songItem = document.createElement('div');
        songItem.className = 'song-item';
        
        const songInfo = document.createElement('div');
        songInfo.className = 'song-info';
        songInfo.innerHTML = `<strong>${song.title}</strong> - ${song.artist}`;
        
        const addButton = document.createElement('button');
        addButton.className = 'song-add-button';
        addButton.textContent = song.added ? '✓ Toegevoegd' : '➕ Toevoegen';
        addButton.disabled = song.added || false;
        if (song.added) {
            addButton.classList.add('added');
        }
        
        addButton.addEventListener('click', async () => {
            addButton.disabled = true;
            await addSongsToPlaylist([i]);
        });
        
        songItem.appendChild(songInfo);
        songItem.appendChild(addButton);
        songsList.appendChild(songItem);
    }
    
    songsSection.style.display = 'block';
}

// Event Listeners
connectSpotifyButton.addEventListener('click', () => {
    authenticateSpotify();
});

logoutButton.addEventListener('click', () => {
    logout();
});

changePlaylistButton.addEventListener('click', () => {
    showPlaylistSelection();
});

createNewPlaylistButton.addEventListener('click', () => {
    selectedPlaylistMode = 'new';
    selectedPlaylistId = null;
    selectedPlaylistName = null;
    hideMessages();
    showUrlStep();
});

selectExistingPlaylistButton.addEventListener('click', () => {
    selectedPlaylistMode = 'existing';
    existingPlaylistSelector.style.display = 'block';
    hideMessages();
});

playlistDropdown.addEventListener('change', (e) => {
    selectedPlaylistId = e.target.value;
    const selectedPlaylist = userPlaylists.find(p => p.id === selectedPlaylistId);
    selectedPlaylistName = selectedPlaylist ? selectedPlaylist.name : null;
    
    // Automatically proceed to URL input step when a playlist is selected
    if (selectedPlaylistId) {
        showUrlStep();
    }
});

inputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const link = npoLinkInput.value.trim();
    if (!link) {
        showError('Voer eerst een NPO link in.');
        return;
    }

    try {
        // Fetch songs
        await fetchSongsFromNPO(link);
        setLoading(false);
    } catch (err) {
        // Error already shown by fetchSongsFromNPO
        console.error('Process error:', err);
    }
});

addAllButton.addEventListener('click', async () => {
    addAllButton.disabled = true;
    await addSongsToPlaylist();
    addAllButton.disabled = false;
});

// Initialize
function init() {
    // Check for Spotify Client ID
    if (!SPOTIFY_CLIENT_ID) {
        configWarning.style.display = 'block';
    }

    // Get access token from URL query params after Spotify redirect
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        console.log('📝 Authorization code received:', code.substring(0, 20) + '...');
        const codeVerifier = sessionStorage.getItem('code_verifier');
        if (codeVerifier) {
            console.log('✅ Code verifier found in sessionStorage');
            exchangeCodeForToken(code, codeVerifier);
        } else {
            console.error('❌ Code verifier not found in sessionStorage');
            showError('Authenticatie sessie verlopen. Probeer opnieuw verbinding te maken met Spotify.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    updateUISteps();
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
