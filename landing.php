<!DOCTYPE html>
<html lang="en">
    <link rel="stylesheet" href="assets/css/style.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Roboto, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            line-height: 1.6;
        }

        header {
            background-color: var(--card-bg);
            border-bottom: 1px solid var(--border);
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
            z-index: 100;
            box-shadow: var(--shadow);
        }

        .nav-wrapper {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .nav-brand {
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--primary-dark);
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        .nav-brand img { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; display: inline-block; }

        .nav-menu {
            display: flex;
            gap: 2.5rem;
            align-items: center;
            list-style: none;
        }

        .nav-menu a {
            color: var(--text-muted);
            text-decoration: none;
            font-weight: 500;
            transition: var(--transition);
        }

        .nav-menu a:hover { color: var(--primary); }

        /* Reveal animation helpers */
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .reveal { opacity: 0; transform: translateY(12px); will-change: transform, opacity; }
        .reveal.is-visible { opacity: 1; transform: none; animation: fadeUp 520ms cubic-bezier(.2,.9,.2,1) both; }

        .btn-signin {
            background-color: var(--primary);
            color: white;
            padding: 0.6rem 1.5rem;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(20, 72, 61, 0.18);
            transition: var(--transition), box-shadow 0.2s ease, transform 0.2s ease;
        }

        .btn-signin:hover {
            background-color: var(--primary-dark);
            box-shadow: 0 8px 18px rgba(20, 72, 61, 0.28);
            transform: translateY(-2px);
        }

        /* Hero with asymmetric layout */
        .hero {
            padding: calc(4rem + 74px) 2rem 4rem;
            background: var(--bg-gradient-sheer);
        }

        .hero-wrapper {
            max-width: 1200px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4rem;
            align-items: center;
        }

        .hero-content h1 {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--primary-darker);
            margin-bottom: 1.25rem;
            line-height: 1.3;
        }

        .hero-content p {
            font-size: 1.05rem;
            color: var(--text-muted);
            margin-bottom: 1.5rem;
            line-height: 1.7;
        }

        .hero-stats {
            display: flex;
            gap: 2.5rem;
            margin-top: 2.5rem;
        }

        .stat-item {
            text-align: center;
        }

        .stat-number {
            font-size: 2rem;
            font-weight: 700;
            color: var(--primary);
            display: block;
        }

        .stat-label {
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-top: 0.25rem;
        }

        .hero-visual {
            background: var(--logincard-gradient);
            border-radius: 16px;
            padding: 3rem;
            text-align: center;
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-height: 350px;
            box-shadow: 0 10px 40px rgba(20, 72, 61, 0.12);
        }

        .hero-visual .icon-svg { color: white; }

        .hero-icon {
            font-size: 4rem;
            margin-bottom: 1.5rem;
        }

        .hero-visual h3 {
            font-size: 1.5rem;
            line-height: 1.3;
            min-height: 1.95rem;
            margin-bottom: 0.75rem;
        }

        .hero-visual p {
            opacity: 0.9;
            font-size: 0.95rem;
            line-height: 1.6;
            min-height: 3.04em;
        }

        /* Section layout */
        section {
            padding: 4.5rem 2rem;
        }

        .section-wrapper {
            max-width: 1200px;
            margin: 0 auto;
        }

        .section-header {
            max-width: 600px;
            margin-bottom: 3.5rem;
        }

        .section-label {
            font-size: 0.8rem;
            font-weight: 700;
            color: var(--primary);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 0.75rem;
        }

        .section-title {
            font-size: 2rem;
            font-weight: 700;
            color: var(--primary-darker);
            margin-bottom: 1rem;
        }

        /* Checklist section */
        .checklist-section {
            background-color: var(--card-bg);
        }

        .checklist-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3rem;
            align-items: center;
        }

        .checklist-items {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .checklist-item {
            display: flex;
            gap: 1rem;
            align-items: flex-start;
        }

        .check-icon {
            color: var(--primary);
            font-size: 1.3rem;
            flex-shrink: 0;
            margin-top: 0.2rem;
        }

        .check-content h4 {
            color: var(--primary-dark);
            margin-bottom: 0.3rem;
            font-size: 1.1rem;
        }

        .check-content p {
            color: var(--text-muted);
            font-size: 0.9rem;
            line-height: 1.5;
        }

        .checklist-visual {
            background: var(--logincard-gradient);
            border-radius: 12px;
            padding: 2.5rem;
            text-align: center;
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            color: white;
            box-shadow: 0 10px 28px rgba(20, 72, 61, 0.16);
        }

        .hero-visual,
        .checklist-visual {
            min-height: 350px;
        }

        .checklist-visual-icon {
            font-size: 3.5rem;
            margin-bottom: 1rem;
        }

        .checklist-visual .icon-svg { color: white; }

        .checklist-visual p { color: rgba(255,255,255,0.92); }

        /* Make the encrypted card heading green to match brand */
        .checklist-visual strong,
        .checklist-visual p strong {
            color: var(--primary-dark);
            font-weight: 700;
        }

        /* Ensure Sign In link text stays white inside the nav */
        .nav-menu a.btn-signin {
            color: #fff;
        }
        .nav-menu a.btn-signin:hover { color: #fff; }
        }

        .checklist-visual p {
            color: var(--text-muted);
            font-size: 0.95rem;
        }

        .checklist-visual p:first-of-type {
            font-size: 1.5rem;
            line-height: 1.3;
            min-height: 1.95rem;
            margin: 0 0 0.75rem;
        }

        .checklist-visual p:last-of-type {
            font-size: 0.95rem;
            line-height: 1.6;
            min-height: 3.04em;
        }

        /* Card grid section */
        .features-section {
            background: var(--bg-gradient-sheer);
        }

        .card-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
        }

        .card {
            background-color: var(--card-bg);
            padding: 2rem;
            border-radius: 12px;
            border-left: 4px solid var(--primary);
            min-height: 280px;
            height: 100%;
            display: flex;
            flex-direction: column;
            transition: var(--transition);
            box-shadow: 0 6px 18px rgba(20, 72, 61, 0.1);
        }

        .card:hover {
            transform: translateY(-6px);
            box-shadow: 0 14px 28px rgba(20, 72, 61, 0.18);
        }

        .card-icon {
            height: 48px;
            display: flex;
            align-items: center;
            margin-bottom: 1rem;
            flex-shrink: 0;
        }

        .card h3 {
            color: var(--primary-dark);
            margin-bottom: 0.75rem;
            font-size: 1.15rem;
            line-height: 1.3;
            min-height: 2.6em;
        }

        .card p {
            color: var(--text-muted);
            font-size: 0.9rem;
            line-height: 1.6;
            min-height: 4.8em;
            margin: 0;
        }

        /* CTA Band */
        .cta-band {
            background: var(--logincard-gradient);
            color: white;
            padding: 3rem 2rem;
            border-radius: 12px;
            margin: 4rem 2rem 0 2rem;
            text-align: center;
            box-shadow: 0 12px 32px rgba(20, 72, 61, 0.18);
        }

        .cta-band h2 {
            font-size: 1.75rem;
            margin-bottom: 0.75rem;
        }

        .cta-band p {
            font-size: 1rem;
            opacity: 0.95;
            margin-bottom: 1.5rem;
        }

        footer {
            background-color: var(--primary-darker);
            color: white;
            padding: 2.5rem 1.5rem;
            font-size: 0.95rem;
            opacity: 0.95;
        }

        .footer-wrapper {
            max-width: 1200px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 1fr repeat(2, minmax(140px, 180px));
            gap: 2rem;
            align-items: start;
        }

        .footer-brand {
            display: flex;
            gap: 0.75rem;
            align-items: flex-start;
        }

        .footer-brand strong { display: block; font-size: 1rem; color: #fff; }

        .footer-col h5 {
            font-size: 0.8rem;
            text-transform: uppercase;
            color: rgba(255,255,255,0.85);
            margin-bottom: 0.75rem;
            letter-spacing: 0.08em;
            font-weight: 700;
        }

        .footer-col ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }

        .footer-col a { color: rgba(255,255,255,0.78); text-decoration: none; }
        .footer-col a:hover { color: var(--primary); }

        .footer-bottom { grid-column: 1 / -1; margin-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 1rem; text-align: left; color: rgba(255,255,255,0.65); font-size: 0.9rem; }

        /* Palette for in-page Company sections */
        #about .section-title,
        #careers .section-title,
        #contact .section-title {
            color: var(--primary-darker);
        }

        #about .section-header p,
        #careers .section-header p,
        #contact .section-header p {
            color: var(--text-muted);
        }

        #about a,
        #careers a,
        #contact a {
            color: var(--primary);
            text-decoration: none;
        }

        #about a:hover,
        #careers a:hover,
        #contact a:hover {
            color: var(--primary-dark);
            text-decoration: underline;
        }

        /* Card-like backgrounds for these company sections */
        #about, #careers, #contact {
            background: var(--card-bg);
            border-radius: 12px;
            border-left: 4px solid var(--primary);
            box-shadow: var(--shadow);
            margin: 1.5rem 2rem;
            padding: 2rem;
        }

        /* Keep inner wrapper alignment consistent */
        #about .section-wrapper, #careers .section-wrapper, #contact .section-wrapper { max-width: 1200px; margin: 0 auto; }

        /* Decorative background icons */
        .bg-decor { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        /* ensure content sits above the decorative layer */
        body > *:not(.bg-decor):not(header) { position: relative; z-index: 1; }


        .bg-icon { position: absolute; opacity: 0.12; transform-origin: center; transform: rotate(var(--rot)); }
        .bg-icon.icon-1 { left: -8%; top: 4%; width: 260px; height: 260px; --rot: -8deg; }
        .bg-icon.icon-2 { right: -6%; top: 14%; width: 180px; height: 180px; --rot: 10deg; }
        .bg-icon.icon-3 { left: 6%; bottom: -6%; width: 300px; height: 300px; --rot: 4deg; }
        .bg-icon.icon-4 { right: 6%; bottom: -10%; width: 160px; height: 160px; --rot: -18deg; }
        .bg-icon.icon-5 { left: 20%; top: 36%; width: 120px; height: 120px; --rot: 22deg; }
        .bg-icon.icon-6 { right: 24%; top: 8%; width: 140px; height: 140px; --rot: -30deg; }
        .bg-icon.icon-7 { left: 8%; bottom: 16%; width: 80px; height: 80px; --rot: 6deg; }
        .bg-icon.icon-8 { right: 10%; bottom: 20%; width: 64px; height: 64px; --rot: 12deg; }
        .bg-icon.icon-9 { left: 48%; top: 10%; width: 72px; height: 72px; --rot: -4deg; }
        .bg-icon.icon-10 { left: 60%; top: 6%; width: 28px; height: 28px; --rot: 28deg; }
        .bg-icon.icon-11 { left: 38%; bottom: 8%; width: 36px; height: 36px; --rot: -14deg; }
        .bg-icon.icon-12 { left: 10%; top: 48%; width: 40px; height: 40px; --rot: 2deg; }
        .bg-icon.icon-13 { right: 18%; top: 40%; width: 48px; height: 48px; --rot: -6deg; }
        .bg-icon.icon-14 { left: 30%; bottom: 6%; width: 34px; height: 34px; --rot: 12deg; }
        .bg-icon.icon-15 { right: 4%; top: 4%; width: 22px; height: 22px; --rot: -10deg; }
        .bg-icon.icon-16 { left: 72%; top: 28%; width: 30px; height: 30px; --rot: 8deg; }
        .bg-icon.icon-17 { left: 52%; bottom: 20%; width: 26px; height: 26px; --rot: -2deg; }
        .bg-icon.icon-18 { right: 44%; top: 14%; width: 20px; height: 20px; --rot: 6deg; }
        .bg-icon.icon-19 { left: 4%; top: 28%; width: 22px; height: 22px; --rot: -6deg; }
        .bg-icon.icon-20 { left: 18%; top: 8%; width: 18px; height: 18px; --rot: 14deg; }
        .bg-icon.icon-21 { right: 30%; top: 24%; width: 24px; height: 24px; --rot: -12deg; }
        .bg-icon.icon-22 { right: 8%; top: 32%; width: 20px; height: 20px; --rot: 4deg; }
        .bg-icon.icon-23 { left: 34%; top: 4%; width: 16px; height: 16px; --rot: 20deg; }
        .bg-icon.icon-24 { left: 44%; top: 36%; width: 14px; height: 14px; --rot: -8deg; }
        .bg-icon.icon-25 { right: 52%; bottom: 6%; width: 18px; height: 18px; --rot: 10deg; }
        .bg-icon.cross-icon { opacity: 0.16; }
        .bg-icon.icon-26 { left: 7%; top: 16%; width: 100px; height: 100px; --rot: 12deg; }
        .bg-icon.icon-27 { right: 13%; top: 22%; width: 64px; height: 64px; --rot: -18deg; }
        .bg-icon.icon-28 { left: 27%; top: 26%; width: 20px; height: 20px; --rot: 28deg; }
        .bg-icon.icon-29 { right: 28%; top: 40%; width: 92px; height: 92px; --rot: -8deg; }
        .bg-icon.icon-30 { left: 13%; bottom: 26%; width: 30px; height: 30px; --rot: 16deg; }
        .bg-icon.icon-31 { right: 17%; bottom: 22%; width: 120px; height: 120px; --rot: -24deg; }
        .bg-icon.icon-32 { left: 42%; top: 22%; width: 12px; height: 12px; --rot: 6deg; }
        .bg-icon.icon-33 { right: 7%; top: 50%; width: 24px; height: 24px; --rot: 18deg; }
        .bg-icon.icon-34 { left: 59%; bottom: 9%; width: 88px; height: 88px; --rot: -14deg; }
        .bg-icon.icon-35 { left: 21%; bottom: 41%; width: 16px; height: 16px; --rot: 32deg; }
        .bg-icon.icon-36 { right: 39%; bottom: 32%; width: 28px; height: 28px; --rot: -4deg; }
        .bg-icon.icon-37 { left: 77%; top: 17%; width: 10px; height: 10px; --rot: 22deg; }
        .bg-icon.icon-38 { left: 17%; top: 58%; width: 74px; height: 74px; --rot: -26deg; }
        .bg-icon.icon-39 { right: 26%; top: 12%; width: 44px; height: 44px; --rot: 34deg; }
        .bg-icon.icon-40 { left: 48%; bottom: 14%; width: 58px; height: 58px; --rot: -16deg; }
        .bg-icon.icon-41 { right: 4%; bottom: 38%; width: 30px; height: 30px; --rot: 24deg; }
        .bg-icon.icon-42 { left: 36%; top: 14%; width: 96px; height: 96px; --rot: 8deg; }
        .bg-icon.icon-43 { right: 45%; top: 32%; width: 22px; height: 22px; --rot: -30deg; }
        .bg-icon.icon-44 { left: 6%; top: 42%; width: 40px; height: 40px; --rot: 18deg; }
        .bg-icon.icon-45 { right: 18%; bottom: 8%; width: 18px; height: 18px; --rot: -22deg; }
        .bg-icon.icon-46 { left: 70%; top: 38%; width: 66px; height: 66px; --rot: 12deg; }
        .bg-icon.icon-47 { left: 30%; bottom: 10%; width: 26px; height: 26px; --rot: -12deg; }
        .bg-icon.icon-48 { right: 8%; top: 8%; width: 82px; height: 82px; --rot: 28deg; }
        .bg-icon.icon-49 { left: 52%; top: 52%; width: 36px; height: 36px; --rot: -34deg; }

        @media (max-width: 900px) {
            .bg-icon { opacity: 0.07; }
            .bg-icon.cross-icon { opacity: 0.1; }
            .bg-icon.icon-1,
            .bg-icon.icon-2,
            .bg-icon.icon-3,
            .bg-icon.icon-26,
            .bg-icon.icon-29,
            .bg-icon.icon-31,
            .bg-icon.icon-34 { transform: rotate(var(--rot)) scale(0.7); }
        }

        @media (max-width: 860px) {
            .footer-wrapper { grid-template-columns: 1fr 1fr; }
            .footer-bottom { text-align: center; }
        }

        @media (max-width: 480px) {
            .footer-wrapper { grid-template-columns: 1fr; gap: 1rem; }
            .footer-brand img { width: 40px; height: 40px; }
            .footer-bottom { text-align: center; }
        }

        @media (max-width: 768px) {
            .hero-wrapper {
                grid-template-columns: 1fr;
                gap: 2rem;
            }

            .hero-content h1 {
                font-size: 2rem;
            }

            .hero-stats {
                flex-wrap: wrap;
            }

            .checklist-grid {
                grid-template-columns: 1fr;
            }

            .section-title {
                font-size: 1.5rem;
            }

            section {
                padding: 3rem 1.5rem;
            }
        }

        @media (max-width: 480px) {
            .nav-menu {
                gap: 1rem;
                font-size: 0.9rem;
            }

            .hero {
                padding: calc(2rem + 74px) 1rem 2rem;
            }

            .hero-content h1 {
                font-size: 1.5rem;
            }

            .hero-visual {
                min-height: 250px;
            }
        }
    </style>
</head>
<body>
    <!-- Decorative background icons (subtle, non-interactive) -->
    <div class="bg-decor" aria-hidden="true">
        <svg class="bg-icon icon-1" viewBox="0 0 100 100" fill="currentColor" style="--rot:-8deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <rect x="12" y="12" width="76" height="76" rx="10" />
        </svg>
        <svg class="bg-icon icon-2" viewBox="0 0 100 100" fill="currentColor" style="--rot:10deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="36" r="18" />
        </svg>
        <svg class="bg-icon icon-3" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" style="--rot:4deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 20v60M20 50h60" stroke-linecap="round"/>
        </svg>
        <svg class="bg-icon icon-4" viewBox="0 0 100 100" fill="currentColor" style="--rot:-18deg; color:var(--primary-soft);" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 22h34l20 20v36H18z" />
        </svg>
        <svg class="bg-icon icon-5" viewBox="0 0 100 100" fill="currentColor" style="--rot:22deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <polygon points="50,12 72,70 28,70" />
        </svg>
        <svg class="bg-icon icon-6" viewBox="0 0 100 100" fill="currentColor" style="--rot:-30deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg">
            <rect x="30" y="30" width="40" height="40" rx="6" />
        </svg>
        <svg class="bg-icon icon-7" viewBox="0 0 100 100" fill="currentColor" style="--rot:6deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <circle cx="26" cy="74" r="10" />
        </svg>
        <svg class="bg-icon icon-8" viewBox="0 0 100 100" fill="currentColor" style="--rot:12deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <circle cx="76" cy="76" r="8" />
        </svg>
        <svg class="bg-icon icon-9" viewBox="0 0 100 100" fill="currentColor" style="--rot:-4deg; color:var(--primary-soft);" xmlns="http://www.w3.org/2000/svg">
            <path d="M44 22h12v12H44z" />
        </svg>
        <svg class="bg-icon icon-10" viewBox="0 0 100 100" fill="currentColor" style="--rot:28deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="6" />
        </svg>
        <svg class="bg-icon icon-11" viewBox="0 0 100 100" fill="currentColor" style="--rot:-14deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg">
            <rect x="42" y="42" width="16" height="16" rx="3" />
        </svg>
        <svg class="bg-icon icon-12" viewBox="0 0 100 100" fill="currentColor" style="--rot:2deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="30" r="6" />
        </svg>
        <svg class="bg-icon icon-13" viewBox="0 0 100 100" fill="currentColor" style="--rot:-6deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="10" width="12" height="12" rx="2" />
        </svg>
        <svg class="bg-icon icon-14" viewBox="0 0 100 100" fill="currentColor" style="--rot:12deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="82" r="6" />
        </svg>
        <svg class="bg-icon icon-15" viewBox="0 0 100 100" fill="currentColor" style="--rot:-10deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="6" height="6" rx="1" />
        </svg>
        <svg class="bg-icon icon-16" viewBox="0 0 100 100" fill="currentColor" style="--rot:8deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <circle cx="68" cy="38" r="5" />
        </svg>
        <svg class="bg-icon icon-17" viewBox="0 0 100 100" fill="currentColor" style="--rot:-2deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg">
            <rect x="44" y="60" width="8" height="8" rx="2" />
        </svg>
        <svg class="bg-icon icon-18" viewBox="0 0 100 100" fill="currentColor" style="--rot:6deg; color:var(--primary-soft);" xmlns="http://www.w3.org/2000/svg">
            <circle cx="82" cy="22" r="4" />
        </svg>
        <svg class="bg-icon icon-19" viewBox="0 0 100 100" fill="currentColor" style="--rot:-6deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="40" r="6" />
        </svg>
        <svg class="bg-icon icon-20" viewBox="0 0 100 100" fill="currentColor" style="--rot:14deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="8" width="12" height="12" rx="2" />
        </svg>
        <svg class="bg-icon icon-21" viewBox="0 0 100 100" fill="currentColor" style="--rot:-12deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <polygon points="50,20 60,60 40,60" />
        </svg>
        <svg class="bg-icon icon-22" viewBox="0 0 100 100" fill="currentColor" style="--rot:4deg; color:var(--primary-soft);" xmlns="http://www.w3.org/2000/svg">
            <circle cx="88" cy="40" r="5" />
        </svg>
        <svg class="bg-icon icon-23" viewBox="0 0 100 100" fill="currentColor" style="--rot:20deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <rect x="30" y="6" width="8" height="8" rx="2" />
        </svg>
        <svg class="bg-icon icon-24" viewBox="0 0 100 100" fill="currentColor" style="--rot:-8deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg">
            <circle cx="44" cy="38" r="4" />
        </svg>
        <svg class="bg-icon icon-25" viewBox="0 0 100 100" fill="currentColor" style="--rot:10deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg">
            <rect x="42" y="12" width="8" height="8" rx="2" />
        </svg>
        <svg class="bg-icon cross-icon icon-26" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" style="--rot:12deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg"><path d="M50 12v76M12 50h76" /></svg>
        <svg class="bg-icon cross-icon icon-27" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" style="--rot:-18deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg"><path d="M50 18v64M18 50h64" /></svg>
        <svg class="bg-icon cross-icon icon-28" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" style="--rot:28deg; color:var(--primary-soft);" xmlns="http://www.w3.org/2000/svg"><path d="M50 26v48M26 50h48" /></svg>
        <svg class="bg-icon cross-icon icon-29" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" style="--rot:-8deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg"><path d="M50 14v72M14 50h72" /></svg>
        <svg class="bg-icon cross-icon icon-30" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" style="--rot:16deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg"><path d="M50 20v60M20 50h60" /></svg>
        <svg class="bg-icon cross-icon icon-31" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" style="--rot:-24deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg"><path d="M50 10v80M10 50h80" /></svg>
        <svg class="bg-icon cross-icon icon-32" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" style="--rot:6deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg"><path d="M50 28v44M28 50h44" /></svg>
        <svg class="bg-icon cross-icon icon-33" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" style="--rot:18deg; color:var(--primary-soft);" xmlns="http://www.w3.org/2000/svg"><path d="M50 18v64M18 50h64" /></svg>
        <svg class="bg-icon cross-icon icon-34" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" style="--rot:-14deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg"><path d="M50 14v72M14 50h72" /></svg>
        <svg class="bg-icon cross-icon icon-35" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" style="--rot:32deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg"><path d="M50 24v52M24 50h52" /></svg>
        <svg class="bg-icon cross-icon icon-36" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" style="--rot:-4deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg"><path d="M50 16v68M16 50h68" /></svg>
        <svg class="bg-icon cross-icon icon-37" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" style="--rot:22deg; color:var(--primary-soft);" xmlns="http://www.w3.org/2000/svg"><path d="M50 30v40M30 50h40" /></svg>
        <svg class="bg-icon icon-38" viewBox="0 0 100 100" fill="currentColor" style="--rot:-26deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg"><polygon points="50,8 88,30 88,70 50,92 12,70 12,30" /></svg>
        <svg class="bg-icon icon-39" viewBox="0 0 100 100" fill="currentColor" style="--rot:34deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="18" width="64" height="64" rx="8" transform="rotate(45 50 50)" /></svg>
        <svg class="bg-icon icon-40" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="7" style="--rot:-16deg; color:var(--primary-soft);" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="32" /></svg>
        <svg class="bg-icon icon-41" viewBox="0 0 100 100" fill="currentColor" style="--rot:24deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg"><path d="M12 28h76v14H12zM12 58h52v14H12z" /></svg>
        <svg class="bg-icon icon-42" viewBox="0 0 100 100" fill="currentColor" style="--rot:8deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg"><polygon points="50,8 92,86 8,86" /></svg>
        <svg class="bg-icon icon-43" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" style="--rot:-30deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg"><path d="M12 62 32 38l18 24 18-24 20 24" /></svg>
        <svg class="bg-icon icon-44" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="8" style="--rot:18deg; color:var(--primary-soft);" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="18" width="64" height="64" rx="20" /></svg>
        <svg class="bg-icon icon-45" viewBox="0 0 100 100" fill="currentColor" style="--rot:-22deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg"><polygon points="50,12 88,50 50,88 12,50" /></svg>
        <svg class="bg-icon icon-46" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" style="--rot:12deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg"><path d="M18 72c0-30 18-48 48-48h16M82 24l-8 16" /></svg>
        <svg class="bg-icon icon-47" viewBox="0 0 100 100" fill="currentColor" style="--rot:-12deg; color:var(--primary-soft);" xmlns="http://www.w3.org/2000/svg"><path d="m50 8 9 29 30-2-24 18 9 29-24-18-24 18 9-29-24-18 30 2z" /></svg>
        <svg class="bg-icon icon-48" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="7" style="--rot:28deg; color:var(--primary-dark);" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="50" rx="38" ry="22" /></svg>
        <svg class="bg-icon icon-49" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" style="--rot:-34deg; color:var(--primary);" xmlns="http://www.w3.org/2000/svg"><path d="M20 30 50 50 20 70M50 30l30 20-30 20" /></svg>
    </div>
    <header>
        <div class="nav-wrapper">
            <div class="nav-brand reveal" data-delay="0">
                <img src="assets/css/Logo.png?v=2" alt="Barangay Health Center Logo">
                <span>Barangay Health Center</span>
            </div>
            <nav class="nav-menu">
                <li><a href="#benefits" class="reveal" data-delay="40">About</a></li>
                <li><a href="#features" class="reveal" data-delay="60">Features</a></li>
                <li><a href="login.php" class="btn-signin reveal" data-delay="80">Sign In</a></li>
            </nav>
        </div>
    </header>

    <section class="hero">
        <div class="hero-wrapper">
            <div class="hero-content reveal" data-delay="80">
                <h1>Your Health Records, Simplified</h1>
                <p>Access and update your personal and family health information securely. Manage documents, track surveys, and stay connected with your barangay health center—all from home.</p>
                <div class="hero-stats">
                    <div class="stat-item">
                        <span class="stat-number">24/7</span>
                        <span class="stat-label">Access Anytime</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">100%</span>
                        <span class="stat-label">Secure</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">0min</span>
                        <span class="stat-label">Wait Time</span>
                    </div>
                </div>
            </div>
            <div class="hero-visual reveal" data-delay="120">
                    <div class="hero-icon">
                    <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/></svg>
                </div>
                <h3>Smart Records Management</h3>
                <p>Digital health profiles for you and your family, verified by our health staff.</p>
            </div>
        </div>
    </section>

    <section id="benefits" class="checklist-section">
        <div class="section-wrapper">
            <div class="section-header">
                <div class="section-label">Why Choose This System</div>
                <h2 class="section-title">Built for Convenience & Security</h2>
            </div>
            <div class="checklist-grid">
                <div class="checklist-items">
                    <div class="checklist-item reveal" data-delay="160">
                        <div class="check-icon"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" style="color: var(--primary)"><path d="M20 6L9 17l-5-5"/></svg></div>
                        <div class="check-content">
                            <h4>Complete Family Profiles</h4>
                            <p>Manage health records for yourself, spouse, children, and extended family all in one place.</p>
                        </div>
                    </div>
                    <div class="checklist-item reveal" data-delay="200">
                        <div class="check-icon"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" style="color: var(--primary)"><path d="M20 6L9 17l-5-5"/></svg></div>
                        <div class="check-content">
                            <h4>Staff-Verified Updates</h4>
                            <p>Every change is reviewed and approved by certified health center staff before taking effect.</p>
                        </div>
                    </div>
                    <div class="checklist-item reveal" data-delay="240">
                        <div class="check-icon"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" style="color: var(--primary)"><path d="M20 6L9 17l-5-5"/></svg></div>
                        <div class="check-content">
                            <h4>Survey Participation</h4>
                            <p>Respond to health surveys at your convenience and view historical data instantly.</p>
                        </div>
                    </div>
                    <div class="checklist-item reveal" data-delay="280">
                        <div class="check-icon"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" style="color: var(--primary)"><path d="M20 6L9 17l-5-5"/></svg></div>
                        <div class="check-content">
                            <h4>Always Available</h4>
                            <p>Access your records 24/7 from any device. No more long waits at the health center.</p>
                        </div>
                    </div>
                </div>
                <div class="checklist-visual reveal" data-delay="320">
                    <div class="checklist-visual-icon"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="56" height="56"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                    <p><strong>Encrypted & Protected</strong></p>
                    <p style="margin-top: 0.5rem; font-size: 0.95rem; line-height: 1.6;">Your data is stored securely and complies with health regulations.</p>
                </div>
            </div>
        </div>
    </section>

    <section id="features" class="features-section">
        <div class="section-wrapper">
            <div class="section-header">
                <div class="section-label">Capabilities</div>
                <h2 class="section-title">Everything You Need</h2>
            </div>
            <div class="card-grid">
                <div class="card reveal" data-delay="360">
                    <div class="card-icon"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="38" height="38" style="color: var(--primary)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
                    <h3>Personal Information</h3>
                    <p>Update your address, contact details, employment status, and family composition anytime.</p>
                </div>
                <div class="card reveal" data-delay="400">
                    <div class="card-icon"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="38" height="38" style="color: var(--primary)"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
                    <h3>Health Records</h3>
                    <p>Upload and manage medical documents, vaccination records, and health history.</p>
                </div>
                <div class="card reveal" data-delay="440">
                    <div class="card-icon"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="38" height="38" style="color: var(--primary)"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v6H8V2"/></svg></div>
                    <h3>Survey Response</h3>
                    <p>Complete health surveys and view results in real-time from your dashboard.</p>
                </div>
                <div class="card reveal" data-delay="480">
                    <div class="card-icon"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="38" height="38" style="color: var(--primary)"><path d="M3 9.5L12 3l9 6.5"/><path d="M9 22V12h6v10"/></svg></div>
                    <h3>Household Management</h3>
                    <p>Add family members, manage household information, and keep records unified.</p>
                </div>
                <div class="card reveal" data-delay="520">
                    <div class="card-icon"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="38" height="38" style="color: var(--primary)"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></div>
                    <h3>Mobile Friendly</h3>
                    <p>Access your account seamlessly on your phone, tablet, or computer.</p>
                </div>
                <div class="card reveal" data-delay="560">
                    <div class="card-icon"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="38" height="38" style="color: var(--primary)"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
                    <h3>Instant Updates</h3>
                    <p>Changes are processed quickly with staff approval notifications sent to you.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Company sections (About / Careers / Contact) -->
    <section id="about" class="section">
        <div class="section-wrapper">
            <div class="section-header reveal" data-delay="620">
                <h2 class="section-title">About Us</h2>
                <p style="color:var(--text-muted);margin-top:0.75rem;max-width:720px;">We are a community-focused team building simple, secure tools for barangay health centers. Our system helps staff manage resident records, run surveys, and provide timely care. We partner with local health workers to keep data accurate and respect patient privacy.</p>
            </div>
        </div>
    </section>

    <section id="careers" class="section">
        <div class="section-wrapper">
            <div class="section-header reveal" data-delay="660">
                <h2 class="section-title">Careers</h2>
                <p style="color:var(--text-muted);margin-top:0.75rem;max-width:720px;">We're a small, growing team. Open roles: Frontend Developer, Community Coordinator, and Support Specialist. If you're passionate about public health tech, email us at <a href="mailto:jobs@barangayhealth.example" style="color:var(--primary)">jobs@barangayhealth.example</a> with your resume.</p>
            </div>
        </div>
    </section>

    <section id="contact" class="section">
        <div class="section-wrapper">
            <div class="section-header reveal" data-delay="700">
                <h2 class="section-title">Contact Us</h2>
                <p style="color:var(--text-muted);margin-top:0.75rem;max-width:720px;">For general inquiries, call <a href="tel:+63255550123" style="color:var(--primary)">+63 2 5555 0123</a> or email <a href="mailto:info@barangayhealth.example" style="color:var(--primary)">info@barangayhealth.example</a>. You can also visit your local barangay health center during working hours.</p>
            </div>
        </div>
    </section>

    <div class="cta-band reveal" data-delay="720">
        <h2>Ready to manage your health records?</h2>
        <p>Sign in to your account or create one today to get started.</p>
    </div>

    <footer>
        <div class="footer-wrapper">
            <div class="footer-brand">
                <img src="assets/css/Logo.png?v=2" alt="Barangay Health Center Logo" style="width:48px;height:48px;border-radius:6px;object-fit:cover;">
                <div>
                    <strong>Barangay Health Center</strong>
                    <div style="font-size:0.9rem;color:rgba(255,255,255,0.78);margin-top:6px;">Modern resident information management</div>
                </div>
            </div>

            <div class="footer-col">
                <h5>Company</h5>
                <ul>
                    <li><a href="#about">About Us</a></li>
                    <li><a href="#careers">Careers</a></li>
                    <li><a href="#contact">Contact Us</a></li>
                </ul>
            </div>

            <div class="footer-col">
                <h5>Product</h5>
                <ul>
                    <li><a href="#features">Features</a></li>
                    <li><a href="#benefits">How It Works</a></li>
                </ul>
            </div>

            <div class="footer-bottom">
                <p>&copy; 2026 Barangay Health Center Survey System. Serving your community with care.</p>
            </div>
        </div>
    </footer>
    <script>
    (function () {
        function setupReveal() {
            const reveals = Array.from(document.querySelectorAll('.reveal'));
            if (!reveals.length) return;
            const obs = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const el = entry.target;
                    const delay = parseInt(el.dataset.delay || '0', 10);
                    el.style.transitionDelay = (delay ? delay + 'ms' : '0ms');
                    el.classList.add('is-visible');
                    observer.unobserve(el);
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
            reveals.forEach((r) => obs.observe(r));
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupReveal); else setupReveal();
    })();
    </script>
</body>
</html>
