import { useState, useEffect } from 'react'
import './App.css'

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:5173/top2000-to-spotify/';
const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SPOTIFY_SCOPES = 'playlist-modify-public playlist-modify-private';

function App() {
  const [npoLink, setNpoLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [songs, setSongs] = useState([]);
  const [accessToken, setAccessToken] = useState('');

  // Get access token from URL query params after Spotify redirect (PKCE flow)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      console.log('📝 Authorization code received:', code.substring(0, 20) + '...');
      // Exchange authorization code for access token
      const codeVerifier = localStorage.getItem('code_verifier');
      if (codeVerifier) {
        console.log('✅ Code verifier found in localStorage');
        exchangeCodeForToken(code, codeVerifier);
      } else {
        console.error('❌ Code verifier not found in localStorage');
        setError('Authentication session expired. Please try connecting to Spotify again.');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const generateRandomString = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
  };

  const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  };

  const base64encode = (input) => {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  const exchangeCodeForToken = async (code, codeVerifier) => {
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
      setAccessToken(data.access_token);
      localStorage.removeItem('code_verifier');
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setSuccess('Successfully authenticated with Spotify! You can now create playlists.');
    } catch (err) {
      setError(`Failed to authenticate with Spotify: ${err.message}`);
      console.error('Token exchange error:', err);
      localStorage.removeItem('code_verifier');
    }
  };

  const authenticateSpotify = async () => {
    if (!SPOTIFY_CLIENT_ID) {
      setError('Spotify Client ID is not configured. Please check the setup instructions in the README.');
      return;
    }

    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);

    localStorage.setItem('code_verifier', codeVerifier);

    const authUrl = `${SPOTIFY_AUTH_ENDPOINT}?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}&response_type=code&code_challenge_method=S256&code_challenge=${codeChallenge}&show_dialog=true`;
    window.location.href = authUrl;
  };

  const fetchSongsFromNPO = async (url) => {
    setLoading(true);
    setError('');
    setSuccess('');
    setSongs([]);

    try {
      console.log('🔍 Fetching submission page:', url);

      // Use CORS proxy to bypass browser CORS restrictions
      // Note: For production, you should use your own backend proxy
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      console.log('🔄 Using CORS proxy:', proxyUrl);

      // Fetch the HTML page directly (server-rendered Next.js with embedded data)
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

      // Look for self.__next_f.push blocks - they contain the song data
      const pushBlocks = html.match(/self\.__next_f\.push\(\[.*?\]\)/g);
      if (!pushBlocks) {
        throw new Error('Could not find Next.js data in the page. The page structure may have changed.');
      }

      console.log(`✅ Found ${pushBlocks.length} self.__next_f.push blocks`);
      
      // Log blocks that contain artist/title
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
      
      // Search through all blocks for the tracks array
      let extractedSongs = [];
      for (let i = 0; i < pushBlocks.length; i++) {
        const block = pushBlocks[i];
        
        // Look for blocks containing artist and title
        if (!block.includes('artist') || !block.includes('title')) {
          continue;
        }
        
        console.log(`🎵 Processing block ${i} for song extraction`);
        console.log('🎵 Block length:', block.length);
        console.log('🎵 Block preview (first 1000):', block.substring(0, 1000));
        
        try {
          // Extract all track objects using a more flexible regex
          const trackPattern = /\{[^}]*?"artist"[^}]*?"title"[^}]*?\}/g;
          const trackMatches = block.match(trackPattern);
            
            if (!trackMatches) {
              console.log('⚠️ No track objects found with simple pattern, trying alternative...');
              
              // Try alternative: look for escaped JSON
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
            
            // Try to parse each track object
            const tracks = [];
            for (const trackStr of trackMatches) {
              try {
                // Clean up the string and try to parse it
                let cleaned = trackStr.replace(/\\\\/g, '\\').replace(/\\"/g, '"');
                const track = JSON.parse(cleaned);
                
                if (track.artist && track.title) {
                  tracks.push({
                    artist: track.artist,
                    title: track.title
                  });
                }
              } catch (e) {
                // Try extracting with regex if JSON parse fails
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

      // Display the extracted songs
      console.log('🎵 Final extracted songs:', extractedSongs);
      setSongs(extractedSongs);
      setSuccess(`Successfully loaded ${extractedSongs.length} songs from your Top 2000 submission!`);
    } catch (err) {
      setError(err.message || 'An error occurred while fetching the songs.');
      console.error('❌ Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchSpotifyTrack = async (title, artist, token) => {
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
  };

  const createSpotifyPlaylist = async () => {
    if (!accessToken) {
      authenticateSpotify();
      return;
    }

    if (songs.length === 0) {
      setError('Please fetch songs from NPO first.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

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

      setSuccess(`Playlist created successfully! Found ${trackUris.length} out of ${songs.length} tracks on Spotify.`);
      
      // Open playlist in Spotify
      window.open(playlist.external_urls.spotify, '_blank');
    } catch (err) {
      setError(err.message || 'An error occurred while creating the playlist.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (npoLink.trim()) {
      fetchSongsFromNPO(npoLink);
    }
  };

  return (
    <div className="container">
      <h1>Top 2000 to Spotify Converter</h1>
      <p className="subtitle">
        Convert your NPO Radio 2 Top 2000 voting list to a Spotify playlist
      </p>

      {!SPOTIFY_CLIENT_ID && (
        <div className="message error-message" style={{ marginBottom: '1rem' }}>
          <strong>Configuration Required:</strong> Spotify Client ID is not configured. Please check the README for setup instructions.
        </div>
      )}

      {accessToken && (
        <div className="message success-message" style={{ marginBottom: '1rem' }}>
          <strong>✅ Connected to Spotify!</strong> You can now create playlists.
        </div>
      )}

      <form onSubmit={handleSubmit} className="input-form">
        <div className="input-group">
          <input
            type="text"
            value={npoLink}
            onChange={(e) => setNpoLink(e.target.value)}
            placeholder="Paste your NPO Radio 2 Top 2000 submission link here..."
            className="link-input"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !npoLink.trim()} className="fetch-button">
            {loading ? 'Fetching...' : 'Fetch Songs'}
          </button>
        </div>
      </form>

      {error && (
        <div className="message error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="message success-message">
          <strong>Success:</strong> {success}
        </div>
      )}

      {songs.length > 0 && (
        <div className="songs-section">
          <h2>Songs Found ({songs.length})</h2>
          <div className="songs-list">
            {songs.slice(0, 10).map((song, index) => (
              <div key={index} className="song-item">
                <strong>{song.title}</strong> - {song.artist}
              </div>
            ))}
            {songs.length > 10 && (
              <div className="song-item more">
                ... and {songs.length - 10} more songs
              </div>
            )}
          </div>
          <button 
            onClick={createSpotifyPlaylist} 
            disabled={loading}
            className="spotify-button"
          >
            {accessToken ? 'Create Spotify Playlist' : 'Connect to Spotify'}
          </button>
        </div>
      )}

      <div className="instructions">
        <h3>How to use:</h3>
        <ol>
          <li>Go to the NPO Radio 2 Top 2000 voting site and create your list</li>
          <li>Copy the submission URL (e.g., https://npo.nl/luister/stem/.../inzending/...)</li>
          <li>Paste the URL above and click "Fetch Songs"</li>
          <li>Click "Connect to Spotify" to authorize the app</li>
          <li>Your playlist will be created and opened in Spotify!</li>
        </ol>
        <p className="note">
          <strong>Note:</strong> You need to configure your Spotify Client ID in the code for this to work.
          Visit the <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">Spotify Developer Dashboard</a> to create an app and get your Client ID.
        </p>
      </div>
    </div>
  )
}

export default App
