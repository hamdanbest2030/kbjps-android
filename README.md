# KB-JPS Online Package

Folder ini ada:
- `kbjps-backend/` -> API server real (Node.js + MongoDB + GridFS + Reset Email/WhatsApp real)
- `kbjps-android/` -> Frontend HTML (Android) yang boleh OFFLINE atau ONLINE.
  - Untuk ONLINE: buka Dashboard -> Mod Online (Real) -> isi URL API -> reload.

## Run Frontend (Android / Pydroid 3)
```bash
cd /storage/emulated/0/Download/kbjps-android
python -m http.server 8002
```
Chrome:
`http://127.0.0.1:8002/index.html`

## Run Backend
Lihat `kbjps-backend/README.md`.
