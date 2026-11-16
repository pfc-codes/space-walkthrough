# Space — Interactive 3D Walkthrough

A browser-based interactive viewer for the supplied 3D space scan. Built with Three.js and static files; works on GitHub Pages without a server, build step, or paid hosting.

## Upload to GitHub Pages

1. Sign in at [github.com](https://github.com) and make a new **public** repository, such as `space-walkthrough`.
2. Upload the **contents** of this ZIP at the top level of the repository — `index.html`, `app.js`, `styles.css`, `.nojekyll`, and the entire `assets/` folder. **Do not upload the ZIP itself as the only file.** The GLB belongs at `assets/space.glb`.
3. Open the repository **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/(root)`, and **Save**.
5. Your link will be `https://YOUR-USERNAME.github.io/space-walkthrough/` (the exact address also appears in GitHub Pages settings).

### Important confidentiality warning

**A public GitHub Pages site makes the 3D scan accessible and downloadable to everyone with the link, and possibly to anyone who finds the repository.** GitHub Pages does not provide password-protected private-client access by default. Do not publish sensitive client interiors or layouts without the client's approval. For restricted sharing, use a host with access controls and private asset delivery instead.

## Controls

| Mode | Desktop | Mobile |
| --- | --- | --- |
| Overview | Left drag rotate, scroll zoom, right drag pan | One-finger rotate, pinch zoom/pan |
| Enter walk | Press **WALK** or double-click a floor | Tap **WALK** |
| Walk | Click scene, move mouse to look; WASD / arrow keys to move; Shift sprint; Q/E vertical; Esc releases cursor | Left joystick moves; drag the scene to look |
| Reset | RESET button | RESET button |

Walking is **free-roam**. This scan does not include navigational collisions or a floorplan; walls are not solid barriers to the camera, and scans can have holes.

## Model details

- The uploaded archive held a single valid glTF 2.0 binary file (`10_1_2026.glb`) containing 9 textured meshes and 9 embedded 4096px texture atlases.
- This version uses the **original geometry and UVs** and resampled **2048px JPEG atlases** for better load and GPU memory on phones.
- Model is self-contained at `assets/space.glb`; no external texture/image paths are necessary.
- Replace `assets/space.glb` with the original `10_1_2026.glb` (rename it to `space.glb`) at any time to use the full-resolution texture version.
- Three.js is imported from jsDelivr; viewers will need an internet connection to load the library and the scan.

## Local preview

Do not open `index.html` as a `file://` URL, as browsers block local model loading. In a terminal in this folder, run:

```bash
python -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000).

## Customization

- Site title and small identifying text are in `index.html`.
- Styling, accents and layout are in `styles.css`.
- GLB file path and controls are in `app.js`.
- To replace the model, name the new glTF binary `space.glb` and replace `assets/space.glb`.
