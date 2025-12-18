// Parallax Frontend Application

// Dynamic API URL Detection
// Priority: 1) URL param ?api=, 2) localStorage, 3) auto-detect
function getApiBase() {
    // Check URL params first (for sharing ngrok links)
    const urlParams = new URLSearchParams(window.location.search);
    const apiParam = urlParams.get('api');
    if (apiParam) {
        localStorage.setItem('paraos_api', apiParam);
        return apiParam;
    }

    // Check localStorage for saved ngrok URL
    const savedApi = localStorage.getItem('paraos_api');
    if (savedApi) return savedApi;

    // Default: localhost for development
    return 'http://localhost:8000';
}

// Configuration
const CONFIG = {
    particleCount: 1500,
    orbSize: 2,
    colors: {
        primary: 0x4361ee,
        secondary: 0x7c3aed,
        bg: 0x050511
    },
    apiBase: getApiBase()
};

// State
let state = {
    isRecording: false,
    isTranslating: false,
    activeEventSource: null,  // Track active streaming connection for cleanup
    settings: {
        dnd: false,
        tts: false,
        perf: true
    }
};

// Mobile detection helper
const isMobile = () => window.innerWidth <= 768;

// DOM Elements
const els = {
    input: document.getElementById('command-input'),
    runBtn: document.getElementById('run-btn'),
    micBtn: document.getElementById('mic-btn'),
    commandBox: document.getElementById('command-box'),
    // Unified Pill result elements
    pillInputHeader: document.getElementById('pill-input-header'),
    pillResultContent: document.getElementById('pill-result-content'),
    pillTimeBadge: document.getElementById('pill-time-badge'),
    pillCopyBtn: document.getElementById('pill-copy-btn'),
    pillSpeakBtn: document.getElementById('pill-speak-btn'),
    pillDismissOverlay: document.getElementById('pill-dismiss-overlay'),
    // Legacy (for fallback)
    resultPanel: document.getElementById('result-panel'),
    resultText: document.getElementById('result-text'),
    resultTime: document.getElementById('result-time'),
    langSelect: document.getElementById('lang-select'),
    toggles: document.querySelectorAll('.toggle'),
    pills: document.querySelectorAll('.suggestion-pill')
};

// --- THREE.JS BACKGROUND ---
function initThreeJS() {
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.001);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ═══════════════════════════════════════════════════════════════════════════
    // GEODESIC WIREFRAME ORB - Low-poly with mouse-reactive HSL colors
    // ═══════════════════════════════════════════════════════════════════════════

    // Mouse state with velocity tracking
    const mouseState = {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        velocityX: 0,
        velocityY: 0,
        prevX: 0,
        prevY: 0,
        speed: 0,
        proximity: 0
    };

    // Shared uniforms for all shaders
    const uniforms = {
        time: { value: 0 },
        mousePos: { value: new THREE.Vector2(0, 0) },
        mouseSpeed: { value: 0 },
        mouseProximity: { value: 0 },
        hue: { value: 0.5 },
        saturation: { value: 0.7 },
        lightness: { value: 0.5 }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // GEODESIC GEOMETRY - Low poly icosahedron (detail level 1 = ~80 triangles)
    // ─────────────────────────────────────────────────────────────────────────
    const geodesicGeometry = new THREE.IcosahedronGeometry(CONFIG.orbSize, 1);

    // Create wireframe from geodesic
    const wireframeGeometry = new THREE.WireframeGeometry(geodesicGeometry);

    // ─────────────────────────────────────────────────────────────────────────
    // GLOWING EDGES - Wireframe lines with HSL reactive shader
    // ─────────────────────────────────────────────────────────────────────────
    const edgeMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: `
            varying vec3 vPosition;
            void main() {
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float hue;
            uniform float saturation;
            uniform float lightness;
            uniform float mouseProximity;
            
            vec3 hsl2rgb(float h, float s, float l) {
                vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
                return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
            }
            
            void main() {
                // Fixed, sharp technical colors
                vec3 color = hsl2rgb(hue, saturation, lightness);
                
                // Pure color lines with slight proximity boost
                float alpha = 0.5 + mouseProximity * 0.4;
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const wireframeMesh = new THREE.LineSegments(wireframeGeometry, edgeMaterial);
    scene.add(wireframeMesh);

    // ─────────────────────────────────────────────────────────────────────────
    // GLOWING VERTICES - Fine Nodes
    // ─────────────────────────────────────────────────────────────────────────
    const vertexMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: `
            uniform float mouseSpeed;
            uniform float mouseProximity;
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                
                // Very small points (1-3 pixels)
                gl_PointSize = 2.5 + mouseProximity * 2.0 + mouseSpeed * 3.0;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float hue;
            uniform float saturation;
            uniform float lightness;
            
            vec3 hsl2rgb(float h, float s, float l) {
                vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
                return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
            }
            
            void main() {
                // Simple sharp circle
                vec2 coord = gl_PointCoord - vec2(0.5);
                if (length(coord) > 0.5) discard;
                
                vec3 color = hsl2rgb(hue, saturation, lightness + 0.2);
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const vertexPoints = new THREE.Points(geodesicGeometry, vertexMaterial);
    scene.add(vertexPoints);

    // ─────────────────────────────────────────────────────────────────────────
    // BACKGROUND STARS
    // ─────────────────────────────────────────────────────────────────────────
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 600;
    const posArray = new Float32Array(starsCount * 3);
    const sizes = new Float32Array(starsCount);

    for (let i = 0; i < starsCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 60;
        posArray[i + 1] = (Math.random() - 0.5) * 60;
        posArray[i + 2] = (Math.random() - 0.5) * 30;
        sizes[i / 3] = Math.random() < 0.05 ? 1.8 : 1.0;
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const starsMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: uniforms.time
        },
        vertexShader: `
            attribute float size;
            uniform float time;
            varying float vAlpha;
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                float twinkle = sin(time * 1.5 + position.x * 5.0 + position.y * 3.0) * 0.3 + 0.7;
                vAlpha = twinkle;
                gl_PointSize = size * twinkle * (20.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying float vAlpha;
            void main() {
                vec2 coord = gl_PointCoord - vec2(0.5);
                float dist = length(coord);
                if (dist > 0.5) discard;
                float alpha = (1.0 - smoothstep(0.1, 0.5, dist)) * vAlpha * 0.6;
                gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending
    });

    const starsMesh = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starsMesh);

    // ═══════════════════════════════════════════════════════════════════════════
    // MOUSE INTERACTION - Position, Proximity, and Velocity tracking
    // ═══════════════════════════════════════════════════════════════════════════

    document.addEventListener('mousemove', (event) => {
        // Skip mouse tracking on mobile to prevent orb movement on scroll/touch
        if (isMobile()) return;

        mouseState.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
        mouseState.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
        document.documentElement.style.setProperty('--mouse-x', `${event.clientX}px`);
        document.documentElement.style.setProperty('--mouse-y', `${event.clientY}px`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // ANIMATION LOOP
    // ═══════════════════════════════════════════════════════════════════════════
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();

        // ─── MOUSE SMOOTHING & VELOCITY ───
        mouseState.prevX = mouseState.x;
        mouseState.prevY = mouseState.y;
        mouseState.x += (mouseState.targetX - mouseState.x) * 0.08;
        mouseState.y += (mouseState.targetY - mouseState.y) * 0.08;

        mouseState.velocityX = mouseState.x - mouseState.prevX;
        mouseState.velocityY = mouseState.y - mouseState.prevY;
        const rawSpeed = Math.sqrt(mouseState.velocityX ** 2 + mouseState.velocityY ** 2);
        mouseState.speed = mouseState.speed * 0.92 + rawSpeed * 15;
        mouseState.speed = Math.min(mouseState.speed, 1.5);

        const distFromCenter = Math.sqrt(mouseState.x ** 2 + mouseState.y ** 2);
        mouseState.proximity = Math.max(0, 1 - distFromCenter * 0.7);

        // ─── HSL COLOR CALCULATION ───
        const targetHue = (mouseState.x + 1) * 0.5;
        uniforms.hue.value += (targetHue - uniforms.hue.value) * 0.05;
        const targetSat = 0.7 + mouseState.speed * 0.3;
        uniforms.saturation.value += (targetSat - uniforms.saturation.value) * 0.1;
        const targetLight = 0.4 + (1 - (mouseState.y + 1) * 0.5) * 0.25;
        uniforms.lightness.value += (targetLight - uniforms.lightness.value) * 0.05;

        // ─── UPDATE UNIFORMS ───
        uniforms.time.value = elapsedTime;
        uniforms.mousePos.value.set(mouseState.x, mouseState.y);
        uniforms.mouseSpeed.value = mouseState.speed;
        uniforms.mouseProximity.value = mouseState.proximity;

        // ─── ROTATION & TILT ───
        const baseRotation = elapsedTime * 0.15;
        wireframeMesh.rotation.y = baseRotation;
        wireframeMesh.rotation.x = Math.sin(elapsedTime * 0.1) * 0.1;

        const tiltStrength = 0.3;
        wireframeMesh.rotation.x += mouseState.y * tiltStrength;
        wireframeMesh.rotation.y += mouseState.x * tiltStrength * 0.5;

        vertexPoints.rotation.copy(wireframeMesh.rotation);

        // Subtle star drift
        starsMesh.rotation.y = elapsedTime * 0.01;

        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// --- GSAP ANIMATIONS ---
function initAnimations() {
    const tl = gsap.timeline();

    // Initial Load Sequence
    tl.to('header', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
        .to('.hero-badge', { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
        .to('.hero-title', { opacity: 1, y: 0, duration: 0.8, ease: 'power4.out' }, '-=0.4')
        .to('.hero-subtitle', { opacity: 1, y: 0, duration: 0.8 }, '-=0.6')
        .to('.command-container', { opacity: 1, y: 0, duration: 0.8, ease: 'back.out(1.7)' }, '-=0.6')
        .to('.dashboard-section', { opacity: 1, y: 0, duration: 0.8 }, '-=0.4');

    // Hover Animations for Cards (Tilt)
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -5; // Max 5deg rotation
            const rotateY = ((x - centerX) / centerX) * 5;

            gsap.to(card, {
                transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
                duration: 0.4,
                ease: 'power2.out'
            });
        });

        card.addEventListener('mouseleave', () => {
            gsap.to(card, {
                transform: 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)',
                duration: 0.5,
                ease: 'elastic.out(1, 0.5)'
            });
        });
    });
}

// --- APP LOGIC ---
function initLogic() {
    // Toggles
    els.toggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            const id = toggle.id.replace('toggle-', '');
            state.settings[id] = !state.settings[id];

            // Haptic feedback visual
            gsap.fromTo(toggle, { scale: 0.95 }, { scale: 1, duration: 0.2 });
        });
    });

    // Suggestion Pills
    els.pills.forEach(pill => {
        pill.addEventListener('click', () => {
            els.input.value = pill.dataset.cmd;
            els.input.focus();
            // User requested to just appear in text box, not auto-run
        });
    });

    // Language picker state

    const langBtn = document.getElementById('lang-btn');
    const langPickerArea = document.getElementById('lang-picker-area');
    const langPickerItems = document.querySelectorAll('.lang-picker-item');
    const currentLangFlag = document.getElementById('current-lang-flag');
    const currentLangCode = document.getElementById('current-lang-code');

    // Language data
    const langData = {
        es: { flag: '🇪🇸', code: 'ES' },
        fr: { flag: '🇫🇷', code: 'FR' },
        de: { flag: '🇩🇪', code: 'DE' },
        zh: { flag: '🇨🇳', code: 'ZH' },
        ko: { flag: '🇰🇷', code: 'KO' },
        ar: { flag: '🇸🇦', code: 'AR' },
        hi: { flag: '🇮🇳', code: 'HI' },
        pt: { flag: '🇧🇷', code: 'PT' },
        yo: { flag: '🇳🇬', code: 'YO' },
        ig: { flag: '🇳🇬', code: 'IG' },
        ja: { flag: '🇯🇵', code: 'JA' },
        ru: { flag: '🇷🇺', code: 'RU' },
        it: { flag: '🇮🇹', code: 'IT' }
    };

    // Open language picker state
    if (langBtn) {
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setIslandState('language');
        });
    }

    // Select language from picker
    langPickerItems.forEach(item => {
        item.addEventListener('click', () => {
            const lang = item.dataset.lang;
            const flag = item.dataset.flag;

            // Update hidden select
            if (els.langSelect) {
                els.langSelect.value = lang;
            }

            // Update button display
            if (currentLangFlag) currentLangFlag.textContent = flag;
            if (currentLangCode) currentLangCode.textContent = lang.toUpperCase();

            // Update active states
            langPickerItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Spring animation on selected item
            gsap.fromTo(item,
                { scale: 0.95 },
                { scale: 1, duration: 0.3, ease: 'elastic.out(1, 0.5)' }
            );

            // Collapse back to default after selection
            setTimeout(() => {
                setIslandState('default');
            }, 150);
        });
    });

    // Run Button
    els.runBtn.addEventListener('click', translateText);
    els.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') translateText();
    });

    // Input expansion animation

    const springExpand = { duration: 0.4, ease: "elastic.out(1, 0.35)" };
    const springCollapse = { duration: 0.3, ease: "power3.out" };

    // Expand as text is typed
    els.input.addEventListener('input', () => {
        const text = els.input.value;
        const shouldExpand = text.length > 12;
        const isExpanded = els.commandBox?.classList.contains('expanded');

        if (shouldExpand && !isExpanded) {
            els.commandBox?.classList.add('expanded');
            gsap.to(els.commandBox, {
                ...springExpand,
                onStart: () => {
                    if (els.commandBox) els.commandBox.style.willChange = 'transform, width';
                },
                onComplete: () => {
                    if (els.commandBox) els.commandBox.style.willChange = 'auto';
                }
            });
        } else if (!shouldExpand && isExpanded) {
            els.commandBox?.classList.remove('expanded');
            gsap.to(els.commandBox, {
                ...springCollapse,
                onStart: () => {
                    if (els.commandBox) els.commandBox.style.willChange = 'transform, width';
                },
                onComplete: () => {
                    if (els.commandBox) els.commandBox.style.willChange = 'auto';
                }
            });
        }

        // Collapse pill when typing new input
        if (pillState === 'result') {
            collapsePill();
        }
    });

    // Focus - subtle glow with spring + mobile expanding mode
    els.input.addEventListener('focus', () => {
        if (pillState !== 'result') {
            els.commandBox?.classList.add('focused');

            // Mobile: Add expanding typing mode with spring animation
            if (isMobile()) {
                els.commandBox?.classList.add('mobile-typing');
                gsap.to(els.commandBox, {
                    duration: 0.35,
                    ease: 'elastic.out(1, 0.45)',
                    onStart: () => {
                        if (els.commandBox) els.commandBox.style.willChange = 'transform, height';
                    },
                    onComplete: () => {
                        if (els.commandBox) els.commandBox.style.willChange = 'auto';
                    }
                });
            }

            gsap.to(els.commandBox, {
                borderColor: 'rgba(139, 92, 246, 0.3)',
                boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(139, 92, 246, 0.15)',
                duration: 0.25,
                ease: 'power2.out'
            });
        }
    });

    // Blur - remove glow smoothly + collapse mobile typing mode
    els.input.addEventListener('blur', () => {
        els.commandBox?.classList.remove('focused');
        if (!els.input.value) {
            els.commandBox?.classList.remove('expanded');
        }

        // Mobile: Remove expanding typing mode with smooth collapse
        if (isMobile()) {
            els.commandBox?.classList.remove('mobile-typing');
            gsap.to(els.commandBox, {
                duration: 0.3,
                ease: 'elastic.out(1, 0.6)',
                onStart: () => {
                    if (els.commandBox) els.commandBox.style.willChange = 'transform, height';
                },
                onComplete: () => {
                    if (els.commandBox) els.commandBox.style.willChange = 'auto';
                }
            });
        }

        gsap.to(els.commandBox, {
            borderColor: 'rgba(255, 255, 255, 0.08)',
            boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.5), 0 0 0 0 rgba(139, 92, 246, 0)',
            duration: 0.25,
            ease: 'power2.out'
        });
    });

    // Copy Button Handler with Animation (Unified Pill)
    if (els.pillCopyBtn) {
        els.pillCopyBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent dismiss overlay from capturing
            e.preventDefault();

            const text = els.pillResultContent?.textContent || '';
            if (!text) return;

            navigator.clipboard.writeText(text).then(() => {
                els.pillCopyBtn.classList.add('copied');
                els.pillCopyBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Copied!
                `;

                // Reset after 2s
                setTimeout(() => {
                    els.pillCopyBtn.classList.remove('copied');
                    els.pillCopyBtn.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                    `;
                }, 2000);
            });
        });
    }

    // Click-to-Copy on Result Text (Direct tap on translation)
    if (els.pillResultContent) {
        els.pillResultContent.style.cursor = 'pointer';
        els.pillResultContent.addEventListener('click', () => {
            const text = els.pillResultContent?.textContent || '';
            if (!text) return;

            navigator.clipboard.writeText(text).then(() => {
                showToast('✓ Copied to clipboard');

                // Visual feedback - subtle pulse
                gsap.fromTo(els.pillResultContent,
                    { scale: 1 },
                    { scale: 1.02, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out' }
                );
            });
        });
    }

    // Speak Button Handler (Unified Pill)
    if (els.pillSpeakBtn) {
        els.pillSpeakBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent dismiss overlay from capturing
            e.preventDefault();

            const text = els.pillResultContent?.textContent || '';
            if (!text) return;

            const lang = els.langSelect?.value || 'en';
            speakText(text, lang);
        });
    }

    // Mic Button: Toggle Voice Input
    els.micBtn.addEventListener('click', () => {
        if (!('webkitSpeechRecognition' in window)) {
            showToast('Warning: Voice input not supported in this browser. Try Chrome/Safari.');
            return;
        }

        state.isRecording = !state.isRecording;
        els.micBtn.classList.toggle('active');

        if (state.isRecording) {
            try {
                startSpeechRecognition();
            } catch (e) {
                console.error("Speech Rec Error:", e);
                state.isRecording = false;
                els.micBtn.classList.remove('active');
                showToast('Error: Mic error: ' + e.message);
            }
        } else {
            stopSpeechRecognition();
        }
    });


    // Language Mapping for TTS (Expanded for global support)
    const langMap = {
        'en': 'en-US',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'zh': 'zh-CN',
        'hi': 'hi-IN',   // Hindi
        'ar': 'ar-SA',   // Arabic
        'ja': 'ja-JP',   // Japanese
        'ko': 'ko-KR',   // Korean
        'ru': 'ru-RU',   // Russian
        'pt': 'pt-BR',   // Portuguese (Brazil)
        'it': 'it-IT',   // Italian
        'yo': 'yo-NG',   // Yoruba (may have limited support)
        'ig': 'ig-NG'    // Igbo (may have limited support)
    };

    function speakText(text, langCode) {
        if (!text) return;

        // Stop any current speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Smart Voice Selection
        const targetLang = langMap[langCode] || 'en-US';
        utterance.lang = targetLang;

        // Try to find a matching voice
        const voices = speechSynthesis.getVoices();
        const matchingVoice = voices.find(v => v.lang.includes(targetLang));
        if (matchingVoice) {
            utterance.voice = matchingVoice;
        }

        // Trigger Dynamic Island TTS animation
        if (typeof dynamicIsland !== 'undefined' && dynamicIsland) {
            dynamicIsland.startSpeaking();
        }

        // Stop animation when speech ends
        utterance.onend = () => {
            if (typeof dynamicIsland !== 'undefined' && dynamicIsland) {
                dynamicIsland.stop();
            }
        };

        utterance.onerror = () => {
            if (typeof dynamicIsland !== 'undefined' && dynamicIsland) {
                dynamicIsland.stop();
            }
        };

        speechSynthesis.speak(utterance);
    }

    // Auto-Read Trigger
    function checkAutoRead(text, langCode) {
        const autoRead = document.getElementById('auto-read-toggle')?.checked;
        if (autoRead) {
            speakText(text, langCode);
        }
    }

    // Conversation Mode Logic
    let conversationMode = false;
    const convBtn = document.getElementById('conversation-mode-btn');
    const convIndicator = document.getElementById('conv-indicator');

    convBtn.addEventListener('click', () => {
        conversationMode = !conversationMode;

        if (conversationMode) {
            convBtn.style.background = 'rgba(16, 185, 129, 0.2)';
            convBtn.style.borderColor = '#10b981';
            convIndicator.style.display = 'block';
            showToast('Conversation Mode ON 🟢');
            startSpeechRecognition(); // Start listening immediately
        } else {
            convBtn.style.background = 'rgba(255,255,255,0.1)';
            convBtn.style.borderColor = 'rgba(255,255,255,0.2)';
            convIndicator.style.display = 'none';
            showToast('Conversation Mode OFF 🔴');
            stopSpeechRecognition();
        }
    });

    // Update translateText to trigger Auto-Read and Conversation Loop
    // (This logic needs to be integrated into the existing translateText function)

    // Copy & Speak
    document.getElementById('copy-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(els.resultText.textContent);
        showToast('Copied to clipboard');
    });

    document.getElementById('speak-btn').addEventListener('click', () => {
        const text = els.resultText.textContent;
        const targetLang = document.getElementById('lang-select').value;
        speakText(text, targetLang);
    });

    document.getElementById('export-json-btn').addEventListener('click', () => {
        const text = els.resultText.textContent;
        if (!text || text === 'Translation will appear here...') return;

        const data = {
            translation: text,
            timestamp: new Date().toISOString(),
            target_lang: document.getElementById('lang-select').value,
            model: "Qwen2.5-7B"
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `translation-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Exported JSON');
    });

    document.getElementById('export-txt-btn').addEventListener('click', () => {
        const text = els.resultText.textContent;
        if (!text || text === 'Translation will appear here...') return;

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `translation-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Exported TXT');
    });

    initFileUpload();
}

// File Upload Logic
function initFileUpload() {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const docModeToggle = document.getElementById('doc-mode-toggle');
    const progressBar = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');

    // Toggle upload zone visibility
    docModeToggle.addEventListener('change', () => {
        uploadZone.classList.toggle('visible', docModeToggle.checked);
    });

    // Click to browse
    uploadZone.addEventListener('click', () => fileInput.click());

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    });

    // File input change
    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) {
            handleFileUpload(fileInput.files[0]);
        }
    });

    async function handleFileUpload(file) {
        // Validate file type
        if (!file.name.match(/\.(pdf|txt)$/i)) {
            showToast('Please upload a PDF or TXT file');
            return;
        }

        // Show progress
        progressBar.classList.add('visible');
        progressFill.style.width = '30%';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('target_lang', document.getElementById('lang-select').value);

        try {
            progressFill.style.width = '60%';

            const response = await fetch(`${CONFIG.apiBase}/api/translate-file`, {
                method: 'POST',
                body: formData
            });

            progressFill.style.width = '90%';

            const data = await response.json();

            if (data.success) {
                // Show result
                document.getElementById('result-text').textContent = data.translated_text;
                document.getElementById('result-time').textContent = `${data.inference_time_ms}ms`;
                document.getElementById('result-panel').classList.add('visible');

                progressFill.style.width = '100%';
                showToast(`Translated ${data.chars_processed} characters!`);

            } else {
                showToast(data.detail || 'Translation failed');
            }
        } catch (err) {
            showToast('Error uploading file');
            console.error(err);
        } finally {
            setTimeout(() => {
                progressBar.classList.remove('visible');
                progressFill.style.width = '0%';
            }, 1000);
        }
    }
}

// Dynamic Island visualizer class

class DynamicIslandVisualizer {
    constructor() {
        this.commandBox = document.querySelector('.command-box');
        this.waveformContainer = document.getElementById('island-waveform');
        this.canvas = document.getElementById('waveform-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.animationId = null;
        this.isActive = false;
        this.mode = null; // 'listening' or 'speaking'

        // Animation configuration - spring physics (matches reference: stiffness 110, damping 12)
        this.springConfig = {
            expand: {
                duration: 0.35,
                ease: "elastic.out(1, 0.45)"  // Smooth spring expand
            },
            collapse: {
                duration: 0.3,
                ease: "elastic.out(1, 0.6)"   // Quick spring collapse
            }
        };

        this.setupCanvas();
    }

    setupCanvas() {
        if (!this.canvas) return;

        // Handle high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        if (this.ctx) {
            this.ctx.scale(dpr, dpr);
        }
    }

    async startListening(stream) {
        if (!this.commandBox) return;

        this.mode = 'listening';
        this.isActive = true;

        // Initialize Web Audio API
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.85;
            source.connect(this.analyser);

            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
        } catch (err) {
            console.error('Audio setup failed:', err);
        }

        // spring animation to voice mode
        this.commandBox.classList.add('voice-active');

        gsap.to(this.commandBox, {
            duration: this.springConfig.expand.duration,
            ease: this.springConfig.expand.ease,
            onStart: () => {
                // Force GPU acceleration during animation
                this.commandBox.style.willChange = 'transform, width, height';
            },
            onComplete: () => {
                this.commandBox.style.willChange = 'auto';
                this.setupCanvas(); // Re-setup after size change
                this.startWaveformAnimation();
            }
        });
    }

    startSpeaking() {
        if (!this.commandBox) return;

        this.mode = 'speaking';
        this.isActive = true;

        // Switch to blue TTS mode
        this.commandBox.classList.remove('voice-active');
        this.commandBox.classList.add('tts-active');

        // Create simulated audio data for TTS visualization
        if (!this.dataArray) {
            this.dataArray = new Uint8Array(128);
        }

        // Spring animation if not already in voice mode
        gsap.to(this.commandBox, {
            duration: this.springConfig.expand.duration,
            ease: this.springConfig.expand.ease,
            onStart: () => {
                this.commandBox.style.willChange = 'transform, width, height';
            },
            onComplete: () => {
                this.commandBox.style.willChange = 'auto';
                this.setupCanvas();
                this.startSimulatedWaveform();
            }
        });
    }

    startWaveformAnimation() {
        if (!this.ctx || !this.analyser) return;

        const draw = () => {
            if (!this.isActive) return;

            this.analyser.getByteTimeDomainData(this.dataArray);
            this.drawWaveform('#ef4444'); // Red for listening
            this.animationId = requestAnimationFrame(draw);
        };

        draw();
    }

    startSimulatedWaveform() {
        const draw = () => {
            if (!this.isActive) return;

            // Simulate organic waveform for TTS
            const time = Date.now() / 60;
            for (let i = 0; i < this.dataArray.length; i++) {
                const wave1 = Math.sin(time + i * 0.2) * 30;
                const wave2 = Math.sin(time * 1.5 + i * 0.15) * 20;
                const noise = (Math.random() - 0.5) * 15;
                this.dataArray[i] = 128 + wave1 + wave2 + noise;
            }

            this.drawWaveform('#3b82f6'); // Blue for speaking
            this.animationId = requestAnimationFrame(draw);
        };

        draw();
    }

    drawWaveform(color) {
        if (!this.ctx || !this.canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;
        const centerX = width / 2;
        const centerY = height / 2;
        const time = Date.now() / 1000;

        // Clear canvas completely for clean animation
        this.ctx.clearRect(0, 0, width, height);

        // Calculate audio level (0-1) from data
        let audioLevel = 0;
        if (this.dataArray && this.dataArray.length > 0) {
            let sum = 0;
            for (let i = 0; i < this.dataArray.length; i++) {
                const v = (this.dataArray[i] - 128) / 128;
                sum += Math.abs(v);
            }
            audioLevel = Math.min(sum / this.dataArray.length * 4, 1);
        } else {
            // Gentle idle breathing when no audio data
            audioLevel = 0.3 + Math.sin(time * 2) * 0.15;
        }

        // Smooth the audio level for fluid animation
        if (!this.smoothAudioLevel) this.smoothAudioLevel = 0;
        this.smoothAudioLevel += (audioLevel - this.smoothAudioLevel) * 0.15;
        const smoothLevel = this.smoothAudioLevel;

        // Base blob dimensions - pill shaped
        const baseWidth = width * 0.7;
        const baseHeight = height * 0.4;

        // Morph factors based on audio
        const widthMorph = 1 + smoothLevel * 0.3;
        const heightMorph = 1 + smoothLevel * 0.5;

        // Draw the fluid blob
        const blobWidth = baseWidth * widthMorph;
        const blobHeight = baseHeight * heightMorph;
        const blobRadius = blobHeight / 2;

        // Create smooth gradient fill
        const gradient = this.ctx.createLinearGradient(
            centerX - blobWidth / 2, centerY,
            centerX + blobWidth / 2, centerY
        );

        if (color === '#ef4444') {
            // Red for listening
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
            gradient.addColorStop(0.2, 'rgba(239, 68, 68, 0.9)');
            gradient.addColorStop(0.5, 'rgba(252, 165, 165, 1)');
            gradient.addColorStop(0.8, 'rgba(239, 68, 68, 0.9)');
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
        } else {
            // Blue for speaking
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
            gradient.addColorStop(0.2, 'rgba(59, 130, 246, 0.9)');
            gradient.addColorStop(0.5, 'rgba(147, 197, 253, 1)');
            gradient.addColorStop(0.8, 'rgba(59, 130, 246, 0.9)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
        }

        // Draw morphing blob with organic edge distortions
        this.ctx.beginPath();

        const numPoints = 32;
        const points = [];

        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;

            // Base ellipse position
            let x = Math.cos(angle) * (blobWidth / 2);
            let y = Math.sin(angle) * (blobHeight / 2);

            // Add organic distortion using multiple sine waves
            const distortionFreq1 = Math.sin(angle * 3 + time * 3) * smoothLevel * 4;
            const distortionFreq2 = Math.sin(angle * 5 + time * 2.5) * smoothLevel * 2;
            const distortionFreq3 = Math.sin(angle * 2 + time * 4) * smoothLevel * 3;

            // Apply distortion perpendicular to the surface
            const normalX = Math.cos(angle);
            const normalY = Math.sin(angle);
            const distortion = distortionFreq1 + distortionFreq2 + distortionFreq3;

            x += normalX * distortion;
            y += normalY * distortion;

            points.push({ x: centerX + x, y: centerY + y });
        }

        // Draw smooth curve through points
        if (points.length > 0) {
            this.ctx.moveTo(points[0].x, points[0].y);

            for (let i = 0; i < points.length - 1; i++) {
                const curr = points[i];
                const next = points[i + 1];
                const midX = (curr.x + next.x) / 2;
                const midY = (curr.y + next.y) / 2;
                this.ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
            }

            // Close the path smoothly
            this.ctx.quadraticCurveTo(
                points[points.length - 1].x, points[points.length - 1].y,
                points[0].x, points[0].y
            );
        }

        this.ctx.closePath();
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Add subtle inner glow/highlight
        const glowGradient = this.ctx.createRadialGradient(
            centerX, centerY - blobHeight * 0.2, 0,
            centerX, centerY, blobWidth / 2
        );
        glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        glowGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
        glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        this.ctx.fillStyle = glowGradient;
        this.ctx.fill();

        // Add outer glow shadow
        this.ctx.shadowColor = color === '#ef4444' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.5)';
        this.ctx.shadowBlur = 20 + smoothLevel * 15;
        this.ctx.fillStyle = 'transparent';
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }

    stop() {
        this.isActive = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.audioContext) {
            this.audioContext.close().catch(() => { });
            this.audioContext = null;
        }

        // collapse animation - quick snap back
        if (this.commandBox) {
            gsap.to(this.commandBox, {
                duration: this.springConfig.collapse.duration,
                ease: this.springConfig.collapse.ease,
                onStart: () => {
                    this.commandBox.style.willChange = 'transform, width, height';
                },
                onComplete: () => {
                    this.commandBox.classList.remove('voice-active', 'tts-active');
                    this.commandBox.style.willChange = 'auto';
                }
            });
        }

        // Clear canvas
        if (this.ctx && this.canvas) {
            const dpr = window.devicePixelRatio || 1;
            const width = this.canvas.width / dpr;
            const height = this.canvas.height / dpr;
            this.ctx.clearRect(0, 0, width, height);
        }

        this.mode = null;
    }
}

// Global instance
let dynamicIsland = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    dynamicIsland = new DynamicIslandVisualizer();
});

// Speech Recognition with Dynamic Island
let recognition;

function startSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        // Get microphone stream for visualization
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                if (dynamicIsland) {
                    dynamicIsland.startListening(stream);
                }

                recognition.onresult = (event) => {
                    els.input.value = event.results[0][0].transcript;
                    state.isRecording = false;
                    els.micBtn.classList.remove('active');

                    // Stop visualization and stream
                    stream.getTracks().forEach(track => track.stop());
                    if (dynamicIsland) dynamicIsland.stop();

                    translateText();
                };

                recognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                    state.isRecording = false;
                    els.micBtn.classList.remove('active');
                    stream.getTracks().forEach(track => track.stop());
                    if (dynamicIsland) dynamicIsland.stop();
                };

                recognition.onend = () => {
                    if (state.isRecording) {
                        // If still recording but recognition ended, stop the island
                        stream.getTracks().forEach(track => track.stop());
                        if (dynamicIsland) dynamicIsland.stop();
                    }
                };

                recognition.start();
            })
            .catch(err => {
                console.error('Microphone access denied:', err);
                alert('Please allow microphone access to use voice input.');
            });
    } else {
        alert('Speech recognition not supported in this browser');
    }
}

function stopSpeechRecognition() {
    if (recognition) {
        recognition.stop();
    }
    state.isRecording = false;
    els.micBtn.classList.remove('active');
    if (dynamicIsland) dynamicIsland.stop();
}

// Pill state management

// Current pill state: 'default' | 'result' | 'voice' | 'language'
let pillState = 'default';

/**
 * Set Dynamic Island state with spring animation
 * @param {string} newState - Target state: 'default' | 'result' | 'voice' | 'language'
 */
function setIslandState(newState) {
    const box = els.commandBox;
    if (!box) return;

    const previousState = pillState;
    pillState = newState;

    // For non-default states, remove classes immediately
    // For default state, we delay class removal until after the shrink animation
    if (newState !== 'default') {
        box.classList.remove('result-expanded', 'voice-active', 'tts-active', 'language-expanded', 'expanded', 'focused');
    }

    // Hide dismiss overlay for non-expanded states
    if (els.pillDismissOverlay && newState === 'default') {
        els.pillDismissOverlay.classList.remove('active');
    }

    const shadows = {
        default: '0 10px 40px -10px rgba(0, 0, 0, 0.5), 0 0 0 0 rgba(139, 92, 246, 0)',
        floating: '0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 80px -20px rgba(139, 92, 246, 0.15)',
        pressed: '0 5px 20px -5px rgba(0, 0, 0, 0.4), 0 0 0 0 rgba(139, 92, 246, 0)',
        voiceGlow: '0 0 60px -10px rgba(239, 68, 68, 0.4), 0 25px 50px -15px rgba(0, 0, 0, 0.5)',
        resultGlow: '0 0 80px -15px rgba(139, 92, 246, 0.2), 0 30px 60px -15px rgba(0, 0, 0, 0.5)'
    };

    switch (newState) {
        case 'result':
            // Result expansion: 3-phase with anticipation
            // Phase 1: Anticipation - subtle press down
            gsap.timeline()
                .to(box, {
                    scale: 0.97,
                    y: 2,
                    boxShadow: shadows.pressed,
                    duration: 0.1,
                    ease: 'power2.in'
                })
                // Phase 2: Expand with class change
                .call(() => {
                    box.classList.add('result-expanded');
                    if (els.pillDismissOverlay) els.pillDismissOverlay.classList.add('active');
                })
                // Phase 3: Spring up and float
                .to(box, {
                    scale: 1,
                    y: -4,  // Float up slightly
                    boxShadow: shadows.resultGlow,
                    duration: 0.35,
                    ease: 'elastic.out(1, 0.45)'
                })
                // Phase 4: Settle to rest
                .to(box, {
                    y: 0,
                    boxShadow: shadows.floating,
                    duration: 0.25,
                    ease: 'power2.out'
                });
            break;

        case 'voice':
            // Voice mode: Quick pulse then glow
            gsap.timeline()
                .to(box, {
                    scale: 1.05,
                    boxShadow: shadows.pressed,
                    duration: 0.08,
                    ease: 'power2.in'
                })
                .call(() => {
                    box.classList.add('voice-active');
                    if (els.pillDismissOverlay) els.pillDismissOverlay.classList.add('active');
                })
                .to(box, {
                    scale: 1,
                    y: -3,
                    boxShadow: shadows.voiceGlow,
                    duration: 0.35,
                    ease: 'elastic.out(1, 0.45)'
                })
                .to(box, {
                    y: 0,
                    duration: 0.2,
                    ease: 'power2.out'
                });
            break;

        case 'language':
            // Language picker: Elegant unfold
            gsap.timeline()
                .to(box, {
                    scale: 0.96,
                    opacity: 0.9,
                    y: 2,
                    boxShadow: shadows.pressed,
                    duration: 0.12,
                    ease: 'power2.in'
                })
                .call(() => {
                    box.classList.add('language-expanded');
                    if (els.pillDismissOverlay) els.pillDismissOverlay.classList.add('active');
                })
                .to(box, {
                    scale: 1,
                    opacity: 1,
                    y: -5,
                    boxShadow: shadows.floating,
                    duration: 0.35,
                    ease: 'elastic.out(1, 0.45)'
                })
                .to(box, {
                    y: 0,
                    duration: 0.25,
                    ease: 'power2.out'
                });
            break;

        default: // 'default' state
            // FIX: If streaming is active, abort it and reset button
            if (state.isTranslating && state.activeEventSource) {
                state.activeEventSource.close();
                state.activeEventSource = null;
                state.isTranslating = false;
                els.runBtn.disabled = false;
                els.runBtn.innerHTML = 'Run <span>→</span>';
            }

            // SMOOTH COLLAPSE: 3-phase with depth
            gsap.timeline()
                // Phase 1: Press in and fade slightly
                .to(box, {
                    scale: 0.94,
                    opacity: 0.85,
                    y: 3,
                    boxShadow: shadows.pressed,
                    duration: 0.15,
                    ease: 'power2.in'
                })
                // Phase 2: Remove classes and clear content
                .call(() => {
                    box.classList.remove('result-expanded', 'voice-active', 'tts-active', 'language-expanded', 'expanded', 'focused');

                    if (previousState === 'result') {
                        if (els.pillResultContent) {
                            els.pillResultContent.textContent = '';
                            els.pillResultContent.classList.remove('typing');
                        }
                        if (els.pillInputHeader) {
                            els.pillInputHeader.textContent = '';
                        }
                    }
                })
                // Phase 3: Spring back with overshoot
                .to(box, {
                    scale: 1.02,
                    opacity: 1,
                    y: -2,
                    boxShadow: shadows.default,
                    duration: 0.3,
                    ease: 'elastic.out(1, 0.6)'
                })
                // Phase 4: Settle to rest
                .to(box, {
                    scale: 1,
                    y: 0,
                    duration: 0.15,
                    ease: 'power2.out'
                });
            break;
    }
}

/**
 * Expand the pill to show translation result
 * @param {string} inputText - Original user input
 * @param {string} translation - Translated text (optional, can stream later)
 */
function expandPillWithResult(inputText, translation = '') {
    if (!els.commandBox) return;

    const box = els.commandBox;
    pillState = 'result';


    const shadows = {
        pressed: '0 5px 20px -5px rgba(0, 0, 0, 0.4), 0 0 0 0 rgba(139, 92, 246, 0)',
        floating: '0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 80px -20px rgba(139, 92, 246, 0.15)',
        resultGlow: '0 0 80px -15px rgba(139, 92, 246, 0.2), 0 30px 60px -15px rgba(0, 0, 0, 0.5)'
    };

    // 4-phase animation
    gsap.timeline()
        // Phase 1: Anticipation - subtle press down
        .to(box, {
            scale: 0.96,
            y: 3,
            boxShadow: shadows.pressed,
            duration: 0.1,
            ease: 'power2.in'
        })
        // Phase 2: Apply classes and set content
        .call(() => {
            // Set the input header
            if (els.pillInputHeader) {
                els.pillInputHeader.textContent = inputText;
            }
            // Set initial translation content
            if (els.pillResultContent) {
                els.pillResultContent.textContent = translation;
                els.pillResultContent.classList.add('typing');
            }
            // Show dismiss overlay
            if (els.pillDismissOverlay) {
                els.pillDismissOverlay.classList.add('active');
            }
            // Add expanded class
            box.classList.add('result-expanded');
            box.classList.remove('expanded', 'focused');
        })
        // Phase 3: Spring up with float effect
        .to(box, {
            scale: 1,
            y: -5,  // Float up
            boxShadow: shadows.resultGlow,
            duration: 0.35,
            ease: 'elastic.out(1, 0.45)'
        })
        // Phase 4: Settle down to rest position
        .to(box, {
            y: 0,
            boxShadow: shadows.floating,
            duration: 0.25,
            ease: 'power2.out'
        });
}

/**
 * Collapse the pill back to idle state
 */
function collapsePill() {
    if (!els.commandBox) return;

    pillState = 'idle';

    // Hide dismiss overlay
    if (els.pillDismissOverlay) {
        els.pillDismissOverlay.classList.remove('active');
    }

    // Animate collapse
    gsap.to(els.commandBox, {
        scale: 0.98,
        duration: 0.15,
        ease: 'power2.in',
        onComplete: () => {
            els.commandBox.classList.remove('result-expanded');

            // Clear content
            if (els.pillResultContent) {
                els.pillResultContent.textContent = '';
                els.pillResultContent.classList.remove('typing');
            }
            if (els.pillInputHeader) {
                els.pillInputHeader.textContent = '';
            }

            // Spring back to normal
            gsap.to(els.commandBox, {
                scale: 1,
                duration: 0.3,
                ease: 'elastic.out(1, 0.6)'
            });
        }
    });
}

/**
 * Update the result content during streaming
 */
function updatePillContent(text) {
    if (els.pillResultContent) {
        els.pillResultContent.textContent = text;
    }
}

/**
 * Update the time badge
 */
function updatePillTime(timeMs) {
    if (els.pillTimeBadge) {
        els.pillTimeBadge.textContent = `${timeMs}ms`;
    }
}

/**
 * Mark translation complete
 */
function markPillComplete() {
    if (els.pillResultContent) {
        els.pillResultContent.classList.remove('typing');
    }

    // Subtle completion pulse
    gsap.fromTo(els.commandBox,
        { scale: 1 },
        { scale: 1.01, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }
    );

    // LIVE UPDATE: Refresh stats immediately after each translation
    updateLiveStats();
}

// Document upload handler

/**
 * Global handler for document upload
 * Called by file input onchange="handleDocumentUpload(this.files[0])"
 */
async function handleDocumentUpload(file) {
    if (!file) {
        return;
    }

    // Validate file type
    const validTypes = ['.txt', '.md', '.srt', '.pdf'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(fileExt)) {
        expandPillWithResult('Warning: Invalid file', `Supported: ${validTypes.join(', ')}`);
        markPillComplete();
        return;
    }

    // Get target language
    const targetLang = document.getElementById('lang-select')?.value || 'es';

    // 1. Immediately expand Dynamic Island with filename
    expandPillWithResult(`${file.name}`, 'Uploading...');

    // 2. Start live elapsed time timer
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        updatePillTime(elapsed);
    }, 100);

    // 3. Prepare form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('target_lang', targetLang);

    try {
        // Update status
        updatePillContent('Translating...');

        // 4. Call backend API
        const response = await fetch(`${CONFIG.apiBase}/api/translate-file`, {
            method: 'POST',
            body: formData
        });

        // Stop timer
        clearInterval(timerInterval);
        const totalTime = Date.now() - startTime;
        updatePillTime(totalTime);

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.success || data.translated_content || data.translated_text) {
            // Success! Show the translation
            const translation = data.translated_content || data.translated_text || data.translation;
            updatePillContent(translation);
            markPillComplete();

            // Update stats
            updateLiveStats();

            // Show toast with details
            const chars = data.chars_processed || file.size;
            showToast(`✓ Translated ${chars} characters`);
        } else {
            // API returned error
            updatePillContent(`Error: ${data.detail || data.error || 'Translation failed'}`);
            markPillComplete();
        }
    } catch (error) {
        // Network or other error
        clearInterval(timerInterval);
        console.error('Document upload error:', error);
        updatePillContent(`Error: ${error.message || 'Failed to upload'}`);
        markPillComplete();
    }

    // Reset file input so same file can be selected again
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';
}

/**
 * Live update stats with visual pulse animation
 */
async function updateLiveStats() {
    try {
        const speedCard = document.getElementById('speed-card');
        const countCard = document.getElementById('count-card');
        const avgSpeedEl = document.getElementById('avg-speed');
        const totalCountEl = document.getElementById('total-count');

        // Fetch latest stats
        const res = await fetch(`${CONFIG.apiBase}/api/stats`);
        const data = await res.json();

        if (avgSpeedEl && data.average_time_ms) {
            // Add updating class for pulse animation
            if (speedCard) speedCard.classList.add('updating');

            // Animate the value change
            gsap.to({ val: parseFloat(avgSpeedEl.textContent) || 0 }, {
                val: data.average_time_ms,
                duration: 0.8,
                ease: 'power2.out',
                onUpdate: function () {
                    avgSpeedEl.textContent = Math.round(this.targets()[0].val) + 'ms';
                },
                onComplete: () => {
                    if (speedCard) speedCard.classList.remove('updating');
                }
            });
        }

        if (totalCountEl && data.total_translations !== undefined) {
            // Add updating class for pulse animation
            if (countCard) countCard.classList.add('updating');

            gsap.to({ val: parseFloat(totalCountEl.textContent) || 0 }, {
                val: data.total_translations,
                duration: 0.8,
                ease: 'power2.out',
                onUpdate: function () {
                    totalCountEl.textContent = Math.round(this.targets()[0].val);
                },
                onComplete: () => {
                    if (countCard) countCard.classList.remove('updating');
                }
            });
        }
    } catch (e) {
        console.error('Live stats update failed:', e);
    }
}

// Click-outside detection for dismiss
document.addEventListener('DOMContentLoaded', () => {
    // Document-level click handler for dismiss
    document.addEventListener('click', (e) => {
        // Only act when pill is in an expanded state
        if (pillState === 'default') return;

        // Check if click is outside the command-box
        const commandBox = els.commandBox;
        if (!commandBox) return;

        // If click is inside the command-box, don't dismiss
        if (commandBox.contains(e.target)) return;

        // Click is outside - collapse to default state
        setIslandState('default');
    }, { passive: true });

    // Also keep the overlay for visual feedback (optional)
    if (els.pillDismissOverlay) {
        els.pillDismissOverlay.addEventListener('click', () => {
            if (pillState !== 'default') {
                setIslandState('default');
            }
        }, { passive: true });
    }
});

async function translateText() {
    const text = els.input.value.trim();
    if (!text) return;

    // Prevent multiple simultaneous translations
    if (state.isTranslating) return;

    state.isTranslating = true;
    els.runBtn.disabled = true;
    els.runBtn.innerHTML = 'Streaming...';

    // Expand pill with input header, ready for streaming
    expandPillWithResult(text, '');

    // Helper to reset button state - called from ALL exit paths
    function resetButtonState() {
        state.isTranslating = false;
        state.activeEventSource = null;  // Clear reference
        els.runBtn.disabled = false;
        els.runBtn.innerHTML = 'Run <span>→</span>';
    }

    // Timeout failsafe - auto-reset after 30 seconds
    const failsafeTimeout = setTimeout(() => {
        console.warn('Translation timeout - resetting button state');
        if (state.isTranslating) {
            updatePillContent('Translation timed out. Please try again.');
            if (els.pillResultContent) els.pillResultContent.classList.remove('typing');
            resetButtonState();
        }
    }, 30000);

    let eventSource = null;

    try {
        // Use EventSource for Server-Sent Events
        const encodedText = encodeURIComponent(text);
        const encodedLang = encodeURIComponent(els.langSelect.value);
        const streamUrl = `${CONFIG.apiBase}/api/translate-stream?text=${encodedText}&source_lang=auto&target_lang=${encodedLang}`;

        eventSource = new EventSource(streamUrl);
        state.activeEventSource = eventSource;  // Track for cleanup when dismissing
        let fullTranslation = '';
        let startTime = Date.now();
        let displayedText = '';
        let pendingWords = [];
        let typingInterval = null;

        // Word-by-word typing effect
        function startTypingEffect() {
            if (typingInterval) return;
            typingInterval = setInterval(() => {
                if (pendingWords.length > 0) {
                    const nextWord = pendingWords.shift();
                    displayedText += (displayedText ? ' ' : '') + nextWord;
                    updatePillContent(displayedText);
                } else if (!state.isTranslating) {
                    // Stop when done
                    clearInterval(typingInterval);
                    typingInterval = null;
                }
            }, 50); // 50ms per word for smooth feel
        }

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.error) {
                    updatePillContent(`Error: ${data.error}`);
                    if (els.pillResultContent) els.pillResultContent.classList.remove('typing');
                    eventSource.close();
                    clearTimeout(failsafeTimeout);
                    if (typingInterval) clearInterval(typingInterval);
                    resetButtonState();
                    return;
                }

                if (data.done) {
                    // Final chunk - complete!
                    eventSource.close();
                    clearTimeout(failsafeTimeout);

                    // Set final translation (bypass typing for final)
                    fullTranslation = data.full_text || fullTranslation;

                    // Stop typing effect and show full text
                    if (typingInterval) clearInterval(typingInterval);
                    updatePillContent(fullTranslation);
                    updatePillTime(data.inference_time_ms);
                    markPillComplete();


                    // Auto-TTS if enabled
                    if (state.settings.tts && fullTranslation) {
                        const utterance = new SpeechSynthesisUtterance(fullTranslation);
                        speechSynthesis.speak(utterance);
                    }

                    // Hybrid TTS: Auto-Read
                    const targetLang = document.getElementById('lang-select').value;
                    checkAutoRead(fullTranslation, targetLang);

                    // Hybrid STT: Conversation Loop
                    if (conversationMode) {
                        const estimatedSpeechTime = fullTranslation.length * 80;
                        setTimeout(() => {
                            if (conversationMode) {
                                startSpeechRecognition();
                            }
                        }, estimatedSpeechTime + 1000);
                    }

                    // Reset button
                    resetButtonState();
                } else {
                    // Streaming token - process word-by-word
                    const token = data.token;
                    fullTranslation += token;

                    // Add tokens to pending words queue for typing effect
                    const words = token.split(/\s+/).filter(w => w.length > 0);
                    pendingWords.push(...words);
                    startTypingEffect();

                    // Update time dynamically
                    const elapsed = Date.now() - startTime;
                    updatePillTime(`${elapsed}ms`);
                }
            } catch (parseError) {
                console.error('Parse error:', parseError);
            }
        };

        eventSource.onerror = (error) => {
            console.error('EventSource error:', error);
            if (eventSource) eventSource.close();
            clearTimeout(failsafeTimeout);
            if (typingInterval) clearInterval(typingInterval);

            if (!fullTranslation) {
                updatePillContent("Connection error. Please try again.");
            }
            if (els.pillResultContent) els.pillResultContent.classList.remove('typing');

            resetButtonState();
        };

    } catch (error) {
        console.error(error);
        if (eventSource) eventSource.close();
        clearTimeout(failsafeTimeout);
        updatePillContent("Error: Could not connect to Parallax backend.");
        if (els.pillResultContent) els.pillResultContent.classList.remove('typing');

        resetButtonState();
    }
}


async function checkOfflineStatus() {
    try {
        const res = await fetch(`${CONFIG.apiBase}/api/status/offline`);
        const data = await res.json();
        const badge = document.getElementById('offline-badge');
        if (badge && data.offline_ready) {
            badge.classList.add('active');
        }
    } catch (e) {
        console.warn('Offline check failed:', e);
    }
}
// Check on load
checkOfflineStatus();


function exportHistory(format) {
    window.location.href = `${CONFIG.apiBase}/api/history/export/${format}`;
    showToast(`Downloading history as ${format.toUpperCase()}...`);
}


function showToast(msg) {
    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(16, 185, 129, 0.9);
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 12px;
        font-size: 0.9rem;
        z-index: 1000;
        animation: fadeInUp 0.3s ease;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Result Panel Logic
const resultText = document.getElementById('result-text');
const resultActions = document.querySelector('.result-actions');

// Observer to show actions when text appears
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.target.textContent.trim().length > 0 &&
            !mutation.target.textContent.includes('Translation will appear here')) {
            resultActions.style.opacity = '1';
            resultActions.style.pointerEvents = 'all';
        } else {
            resultActions.style.opacity = '0';
            resultActions.style.pointerEvents = 'none';
        }
    });
});

if (resultText) {
    observer.observe(resultText, { childList: true, characterData: true, subtree: true });
}
// Initialize app
window.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    initAnimations();
    initLogic();
});
