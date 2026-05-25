<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>LMS — Secure Document Upload</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Open+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
  <style>
    :root {
      --teal:    #00A8C6;
      --teal-dim: rgba(0,168,198,0.12);
      --teal-border: rgba(0,168,198,0.25);
      --navy:    #0B1F3A;
      --navy-2:  #132d4a;
      --navy-3:  #1a3a5c;
      --white:   #ffffff;
      --muted:   #7a9ab5;
      --dim:     #4a6a85;
      --success: #22c55e;
      --success-dim: rgba(34,197,94,0.12);
      --danger:  #ef4444;
      --radius:  14px;
    }
 
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
 
    body {
      background: var(--navy);
      font-family: 'Open Sans', sans-serif;
      color: var(--white);
      min-height: 100vh;
      padding: 0 0 60px;
    }
 
    /* ── HEADER ── */
    .header {
      background: rgba(11,31,58,0.95);
      border-bottom: 1px solid var(--navy-3);
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
    }
 
    .logo img {
      height: 40px;
      width: auto;
      border-radius: 6px;
      display: block;
    }
 
    .secure-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--teal);
      font-family: 'Montserrat', sans-serif;
    }
 
    .secure-badge svg { opacity: 0.9; }
 
    /* ── MAIN ── */
    .main {
      max-width: 640px;
      margin: 0 auto;
      padding: 36px 20px 0;
    }
 
    /* ── FILE BANNER ── */
    .file-banner {
      background: var(--navy-2);
      border: 1px solid var(--navy-3);
      border-radius: var(--radius);
      padding: 20px 24px;
      margin-bottom: 28px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
 
    .file-icon {
      width: 44px;
      height: 44px;
      background: var(--teal-dim);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
 
    .file-info { flex: 1; }
 
    .file-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-family: 'Montserrat', sans-serif;
      margin-bottom: 4px;
    }
 
    .file-address {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 17px;
      color: var(--white);
    }
 
    /* ── PROGRESS ── */
    .progress-section {
      margin-bottom: 28px;
    }
 
    .progress-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
 
    .progress-label {
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      font-size: 13px;
      color: var(--muted);
    }
 
    .progress-count {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 13px;
      color: var(--teal);
    }
 
    .progress-bar-track {
      height: 6px;
      background: var(--navy-3);
      border-radius: 99px;
      overflow: hidden;
    }
 
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--teal), #00d4ff);
      border-radius: 99px;
      transition: width 0.6s ease;
    }
 
    /* ── CHECKLIST ── */
    .checklist {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
 
    .item-card {
      background: var(--navy-2);
