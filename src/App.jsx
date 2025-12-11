import { useState, useEffect } from 'react'
import './App.css'

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
const SPOTIFY_REDIRECT_URI = window.location.origin + '/top2000-to-spotify/';
const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SPOTIFY_SCOPES = 'playlist-modify-public playlist-modify-private';

function App() {
  const [npoLink, setNpoLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [songs, setSongs] = useState([]);
  const [accessToken, setAccessToken] = useState('');

  // Get access token from URL hash after Spotify redirect
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        setAccessToken(token);
        window.location.hash = '';
      }
    }
  }, []);

  const authenticateSpotify = () => {
    if (!SPOTIFY_CLIENT_ID) {
      setError('Spotify Client ID is not configured. Please check the setup instructions in the README.');
      return;
    }
    const authUrl = `${SPOTIFY_AUTH_ENDPOINT}?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}&response_type=token&show_dialog=true`;
    window.location.href = authUrl;
  };

  const fetchSongsFromNPO = async (url) => {
    setLoading(true);
    setError('');
    setSuccess('');
    setSongs([]);

    try {
      // Extract the submission ID from the URL
      const urlMatch = url.match(/inzending\/([a-f0-9-]+)/);
      if (!urlMatch) {
        throw new Error('Invalid NPO Radio 2 Top 2000 link. Please check the URL format.');
      }

      const submissionId = urlMatch[1];
      
      // Fetch the submission data from NPO API
      const response = await fetch(`https://npo.nl/api/stem/npo-radio-2-top-2000-2025/inzending/${submissionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch data from NPO. Please check if the link is valid.');
      }

      const data = await response.json();
      
      // Extract songs from the submission
      if (data && data.songs && Array.isArray(data.songs)) {
        const songList = data.songs.map(song => ({
          title: song.title || song.name,
          artist: song.artist || song.performer,
        }));
        setSongs(songList);
        setSuccess(`Found ${songList.length} songs in your Top 2000 list!`);
      } else {
        throw new Error('No songs found in the submission.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching the songs.');
      console.error('Error:', err);
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
