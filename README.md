# Mind Map

A simple, interactive mind mapping application that runs in your browser.

## Features

- **Interactive Canvas**: Pan and zoom to navigate your mind map
- **Node Management**: Add, edit, delete, and rearrange nodes
- **Auto-layout**: Child nodes are automatically positioned in a radial pattern
- **Save & Load**: Persist your mind maps using browser local storage (when served via HTTP)
- **Export**: Download your mind map as a JSON file
- **Keyboard Shortcuts**: Efficient editing with keyboard commands

## Controls

| Key | Action |
|-----|--------|
| `Tab` | Add child node |
| `Enter` | Add sibling node |
| `Delete` / `Backspace` | Delete selected node |
| `Click` | Select / Edit node |
| `Drag` | Move node |
| `Shift + Drag` | Pan canvas |
| `Double Click` | Edit node text |

## Running Locally

Since this application uses `localStorage` for saving (which doesn't work with `file://` protocol), you should serve it via a local HTTP server.

### Using Python

**Python 3:**
```bash
python -m http.server 8000
```

**Python 2:**
```bash
python -m SimpleHTTPServer 8000
```

Then open your browser and navigate to:
```
http://localhost:8000
```

### Using Node.js (npx)

If you have Node.js installed:
```bash
npx serve
```

### Using VS Code

Install the **Live Server** extension, right-click on `index.html`, and select "Open with Live Server".

## Data Storage

- **Save/Load**: Uses browser's `localStorage` (only available when served via HTTP/HTTPS)
- **Export**: Downloads a JSON file that you can keep as a backup or share

## Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge).
