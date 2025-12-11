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
const fetchButton = document.getElementById('fetch-button');
const inputForm = document.getElementById('input-form');
const errorMessageDiv = document.getElementById('error-message');
const successMessageDiv = document.getElementById('success-message');
const songsSection = document.getElementById('songs-section');
const songsList = document.getElementById('songs-list');
const songsCount = document.getElementById('songs-count');
const spotifyButton = document.getElementById('spotify-button');
const configWarning = document.getElementById('config-warning');
const spotifyConnected = document.getElementById('spotify-connected');

// Utility Functions
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
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

function setLoading(isLoading) {
    loading = isLoading;
    fetchButton.disabled = isLoading;
    npoLinkInput.disabled = isLoading;
    spotifyButton.disabled = isLoading;
    fetchButton.textContent = isLoading ? 'Fetching...' : 'Fetch Songs';
}

function showError(message) {
    error = message;
    errorMessageDiv.innerHTML = `<strong>Error:</strong> ${message}`;
    errorMessageDiv.style.display = 'block';
    successMessageDiv.style.display = 'none';
}

function showSuccess(message) {
    success = message;
    successMessageDiv.innerHTML = `<strong>Success:</strong> ${message}`;
    successMessageDiv.style.display = 'block';
    errorMessageDiv.style.display = 'none';
}

function hideMessages() {
    errorMessageDiv.style.display = 'none';
    successMessageDiv.style.display = 'none';
}

function updateSpotifyConnectionStatus() {
    if (accessToken) {
        spotifyConnected.style.display = 'block';
        spotifyButton.textContent = 'Create Spotify Playlist';
    } else {
        spotifyConnected.style.display = 'none';
        spotifyButton.textContent = 'Connect to Spotify';
    }
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
        localStorage.removeItem('code_verifier');
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        showSuccess('Successfully authenticated with Spotify! You can now create playlists.');
        updateSpotifyConnectionStatus();
    } catch (err) {
        showError(`Failed to authenticate with Spotify: ${err.message}`);
        console.error('Token exchange error:', err);
        localStorage.removeItem('code_verifier');
    }
}

async function authenticateSpotify() {
    if (!SPOTIFY_CLIENT_ID) {
        showError('Spotify Client ID is not configured. Please check the setup instructions in the README.');
        return;
    }

    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);

    localStorage.setItem('code_verifier', codeVerifier);

    const authUrl = `${SPOTIFY_AUTH_ENDPOINT}?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}&response_type=code&code_challenge_method=S256&code_challenge=${codeChallenge}&show_dialog=true`;
    window.location.href = authUrl;
}

// NPO Fetching Functions
async function fetchSongsFromNPO(url) {
    setLoading(true);
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
            throw new Error(`Failed to fetch the submission page (${response.status}). The link may be invalid or expired.`);
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
            throw new Error('Could not find Next.js data in the page. The page structure may have changed.');
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
            throw new Error('Could not find any songs in the submission. The page may not contain a valid submission.');
        }

        console.log('🎵 Final extracted songs:', extractedSongs);
        songs = extractedSongs;
        displaySongs();
        showSuccess(`Successfully loaded ${extractedSongs.length} songs from your Top 2000 submission!`);
    } catch (err) {
        showError(err.message || 'An error occurred while fetching the songs.');
        console.error('❌ Error:', err);
    } finally {
        setLoading(false);
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
        throw new Error('Failed to search Spotify');
    }

    const data = await response.json();
    if (data.tracks && data.tracks.items.length > 0) {
        return data.tracks.items[0].uri;
    }
    return null;
}

async function createSpotifyPlaylist() {
    if (!accessToken) {
        authenticateSpotify();
        return;
    }

    if (songs.length === 0) {
        showError('Please fetch songs from NPO first.');
        return;
    }

    setLoading(true);
    hideMessages();

    try {
        // Get user profile
        const profileResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!profileResponse.ok) {
            throw new Error('Failed to get Spotify user profile. Please re-authenticate.');
        }

        const profile = await profileResponse.json();

        // Create playlist
        const playlistResponse = await fetch(`https://api.spotify.com/v1/users/${profile.id}/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: `NPO Radio 2 Top 2000 - ${new Date().getFullYear()}`,
                description: 'Generated from NPO Radio 2 Top 2000 voting submission',
                public: false
            })
        });

        if (!playlistResponse.ok) {
            throw new Error('Failed to create Spotify playlist.');
        }

        const playlist = await playlistResponse.json();

        // Search for tracks and add to playlist
        const trackUris = [];
        for (const song of songs) {
            try {
                const uri = await searchSpotifyTrack(song.title, song.artist, accessToken);
                if (uri) {
                    trackUris.push(uri);
                }
            } catch {
                console.warn(`Failed to find: ${song.title} by ${song.artist}`);
            }
        }

        if (trackUris.length === 0) {
            throw new Error('Could not find any tracks on Spotify.');
        }

        // Add tracks to playlist (Spotify allows max 100 tracks per request)
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

        showSuccess(`Playlist created successfully! Found ${trackUris.length} out of ${songs.length} tracks on Spotify.`);
        
        // Open playlist in Spotify
        window.open(playlist.external_urls.spotify, '_blank');
    } catch (err) {
        showError(err.message || 'An error occurred while creating the playlist.');
        console.error('Error:', err);
    } finally {
        setLoading(false);
    }
}

// Display Functions
function displaySongs() {
    songsList.innerHTML = '';
    songsCount.textContent = songs.length;
    
    const displayCount = Math.min(10, songs.length);
    for (let i = 0; i < displayCount; i++) {
        const song = songs[i];
        const songItem = document.createElement('div');
        songItem.className = 'song-item';
        songItem.innerHTML = `<strong>${song.title}</strong> - ${song.artist}`;
        songsList.appendChild(songItem);
    }
    
    if (songs.length > 10) {
        const moreItem = document.createElement('div');
        moreItem.className = 'song-item more';
        moreItem.textContent = `... and ${songs.length - 10} more songs`;
        songsList.appendChild(moreItem);
    }
    
    songsSection.style.display = 'block';
}

// Event Listeners
inputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const link = npoLinkInput.value.trim();
    if (link) {
        fetchSongsFromNPO(link);
    }
});

spotifyButton.addEventListener('click', createSpotifyPlaylist);

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
        const codeVerifier = localStorage.getItem('code_verifier');
        if (codeVerifier) {
            console.log('✅ Code verifier found in localStorage');
            exchangeCodeForToken(code, codeVerifier);
        } else {
            console.error('❌ Code verifier not found in localStorage');
            showError('Authentication session expired. Please try connecting to Spotify again.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    updateSpotifyConnectionStatus();
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
