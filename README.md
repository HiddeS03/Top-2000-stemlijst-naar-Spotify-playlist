# Top 2000 to Spotify Playlist Converter

Convert your NPO Radio 2 Top 2000 voting list to a Spotify playlist with just one click!

🌐 **Live Demo:** [https://hiddes03.github.io/top2000-to-spotify/](https://hiddes03.github.io/top2000-to-spotify/)

## Features

- 🎵 Parse NPO Radio 2 Top 2000 submission links
- 🔍 Automatically search for songs on Spotify
- 📝 Create a playlist directly in your Spotify account
- 🚀 Fully static HTML/CSS/JavaScript website hosted on GitHub Pages
- ⚡ No build process required - runs directly in the browser

## How to Use

1. Visit the live application: **[https://hiddes03.github.io/top2000-to-spotify/](https://hiddes03.github.io/top2000-to-spotify/)**
2. Go to [NPO Radio 2 Top 2000 voting site](https://npo.nl/luister/stem/npo-radio-2-top-2000-2025) and create your list
3. Copy your submission URL (looks like: `https://npo.nl/luister/stem/npo-radio-2-top-2000-2025/inzending/019ae423-5404-729d-818e-b85e011a546f`)
4. Paste the URL into the input field on the website
5. Click "Fetch Songs" to retrieve your list
6. Click "Connect to Spotify" to authorize the app
7. Your playlist will be created and opened automatically!

## Spotify API Configuration

To use this application, you need to configure your Spotify Client ID:

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `https://hiddes03.github.io/top2000-to-spotify/` to the Redirect URIs
4. Copy your Client ID
5. Edit `app.js` and replace the empty `SPOTIFY_CLIENT_ID` variable with your Client ID:
   ```javascript
   const SPOTIFY_CLIENT_ID = "your_client_id_here";
   ```

## Deployment to GitHub Pages

### Option 1: Direct Deployment (Recommended)

Since this is a static website with no build process, you can deploy it directly:

1. Push all files (`index.html`, `styles.css`, `app.js`) to your repository
2. Go to your repository settings on GitHub
3. Navigate to Pages section
4. Set Source to "Deploy from a branch"
5. Select the `main` branch and `/ (root)` folder
6. Click Save
7. Your site will be available at `https://hiddes03.github.io/top2000-to-spotify/`

### Option 2: Using GitHub Actions

If you prefer automated deployments, create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: "."

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## Local Development

No build tools or dependencies required! Simply:

1. Clone the repository
2. Edit `app.js` to add your Spotify Client ID
3. Open `index.html` in your browser or use a local server:

   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js
   npx serve .
   ```

## Technologies Used

- Vanilla JavaScript (ES6+)
- HTML5
- CSS3
- Spotify Web API (with PKCE authentication flow)
- NPO Radio 2 API
- GitHub Pages

## License

MIT
