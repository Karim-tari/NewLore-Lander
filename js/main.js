/**
 * main.js — Page interactions & scroll animations
 *
 * Depends on LocomotiveScroll being loaded first via CDN <script> in index.html.
 * Covers:
 *   • Locomotive Scroll (Lenis) smooth scroll setup
 *   • IntersectionObserver scroll-reveal (data-r attributes)
 *   • Hero h1 character-by-character entrance animation
 *   • Section headline word-split reveal animation
 *   • Nav CTA visibility toggle
 *   • Hero background blur/fade on scroll (Lenis-synced)
 *   • Hero text parallax drift on scroll
 *   • Slide panel (Book a Demo modal) open/close
 *   • Compare panel streaming animation
 */

document.addEventListener('DOMContentLoaded', () => {

    // ── Locomotive Scroll (smooth scroll) ─────────────────────────────────────
    const locoScroll = new LocomotiveScroll({
        lenisOptions: {
            lerp: 0.08,
            duration: 1.4,
            easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
        }
    });

    // ── Scroll-reveal via IntersectionObserver ────────────────────────────────
    // Elements with [data-r] start hidden (opacity:0, translateY) and gain
    // the .in-view class when they enter the viewport, triggering CSS transitions.
    const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('in-view');
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    // ── Hero h1 character-by-character animation ──────────────────────────────
    // Words are wrapped in .hero-word (white-space:nowrap) so the browser can
    // only line-break between words, never mid-word between individual char spans.
    // Random per-character jitter makes the timing feel organic, not robotic.
    const h1El = document.querySelector('.hero h1');
    if (h1El) {
        const words = h1El.textContent.trim().split(' ');
        let ci = 0;
        h1El.innerHTML = words.map((word, wi) => {
            const charSpans = word.split('').map(ch => {
                const jitter = Math.random() * 0.018;
                const delay  = (0.1 + ci++ * 0.016 + jitter).toFixed(3);
                return `<span class="hero-char" style="animation-delay:${delay}s">${ch}</span>`;
            }).join('');
            const space = wi < words.length - 1 ? ' ' : '';
            return `<span class="hero-word">${charSpans}</span>${space}`;
        }).join('');
        h1El.classList.add('is-char-split');
    }

    // ── Section headline word-split reveal ────────────────────────────────────
    // Each word is wrapped in .word-clip > .word-inner so the slide-up is masked,
    // producing a clean "rising text" entrance per word with staggered delay.
    document.querySelectorAll('.section-headline').forEach(el => {
        const words = el.innerText.trim().split(/\s+/);
        el.innerHTML = words.map((word, i) =>
            `<span class="word-clip"><span class="word-inner" style="transition-delay:${0.08 + i * 0.075}s">${word}</span></span>`
        ).join(' ');
    });

    document.querySelectorAll('[data-r]').forEach(el => io.observe(el));

    // ── Nav CTA visibility — hide when hero is visible ────────────────────────
    const navCta = document.getElementById('nav-cta');
    const heroSection = document.querySelector('.hero');
    if (navCta && heroSection) {
        const heroObserver = new IntersectionObserver(([entry]) => {
            navCta.classList.toggle('visible', !entry.isIntersecting);
        }, { threshold: 0 });
        heroObserver.observe(heroSection);
    }

    // ── Hero bg blur/fade + nav state — Lenis-synced ──────────────────────────
    const nav          = document.querySelector('.nav');
    const heroBg       = document.querySelector('.hero-bg');
    const shiftSection = document.getElementById('problem');

    function onScroll(scrollY) {
        if (heroBg && shiftSection) {
            const target      = shiftSection.offsetTop;
            const start       = target * 0.45;
            const range       = target - start;
            const rawProgress = Math.min(Math.max((scrollY - start) / range, 0), 1);
            const progress    = rawProgress * 0.55;
            heroBg.style.filter  = `blur(${progress * 20}px)`;
            heroBg.style.opacity = 1 - progress;
        }
        if (nav) nav.classList.toggle('scrolled', scrollY > 160);
    }

    // ── Hero text parallax — driven by Lenis for frame-perfect sync ───────────
    const heroH1    = document.querySelector('.hero-content h1');
    const heroSub   = document.querySelector('.hero-sub');
    const heroCtaEl = document.querySelector('.hero-content .btn-primary');

    if (locoScroll.lenisInstance) {
        locoScroll.lenisInstance.on('scroll', ({ scroll }) => {
            onScroll(scroll);

            const vp  = window.innerHeight;
            const pct = Math.min(scroll / (vp * 0.6), 1); // 0→1 over first 60vh

            if (heroH1) {
                heroH1.style.transform = `translateY(${pct * -40}px)`;
                heroH1.style.opacity   = 1 - pct * 1.4;
            }
            if (heroSub) {
                heroSub.style.transform = `translateY(${pct * -24}px)`;
                heroSub.style.opacity   = 1 - pct * 1.6;
            }
            if (heroCtaEl) {
                heroCtaEl.style.transform = `translateY(${pct * -16}px)`;
                heroCtaEl.style.opacity   = 1 - pct * 1.8;
            }
        });
    } else {
        // Fallback for environments where Lenis isn't available
        window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
    }

    // ── Slide panel (Book a Demo) ─────────────────────────────────────────────
    const panelOverlay = document.getElementById('panel-overlay');
    const slidePanel   = document.getElementById('slide-panel');
    const panelClose   = document.getElementById('panel-close');

    function openPanel()  { panelOverlay.classList.add('open');    slidePanel.classList.add('open'); }
    function closePanel() { panelOverlay.classList.remove('open'); slidePanel.classList.remove('open'); }

    document.querySelectorAll('.btn-open-modal').forEach(btn => {
        btn.addEventListener('click', e => { e.preventDefault(); openPanel(); });
    });
    panelClose.addEventListener('click', closePanel);
    panelOverlay.addEventListener('click', closePanel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

    // ── Compare panel animation end cleanup ───────────────────────────────────
    document.querySelectorAll('.compare-panel').forEach(panel => {
        panel.addEventListener('animationend', () => {
            panel.style.animation = 'none';
            panel.style.opacity   = '1';
        });
    });

    // ── Compare panel streaming animation ─────────────────────────────────────
    // Simulates AI-generated text streaming into the compare panels.
    const heroCompare = document.querySelector('.hero-compare');
    if (heroCompare) {
        const promptEl   = document.getElementById('compare-prompt');
        const promptText = 'How long do I have to file a claim after a car accident in Louisiana?';
        const withoutBody = document.getElementById('stream-without');
        const withBody    = document.getElementById('stream-with');

        const allStreamParas  = heroCompare.querySelectorAll('[data-stream]');
        const allStreamBlocks = heroCompare.querySelectorAll('[data-stream-block]');
        const allStreamRows   = heroCompare.querySelectorAll('[data-stream-row]');

        allStreamParas.forEach(p  => { p._originalHTML = p.innerHTML; p.textContent = ''; });
        allStreamBlocks.forEach(b => b.classList.add('stream-hidden'));
        allStreamRows.forEach(r   => r.classList.add('stream-hidden'));

        function streamText(el, text, speed) {
            return new Promise(resolve => {
                const words = text.split(/(\s+)/);
                let i = 0;
                el.textContent = '';
                el.classList.add('stream-cursor');
                const tick = () => {
                    if (i < words.length) {
                        el.textContent += words[i++];
                        setTimeout(tick, speed + Math.random() * speed * 0.6);
                    } else {
                        el.classList.remove('stream-cursor');
                        resolve();
                    }
                };
                tick();
            });
        }

        function revealElement(el, delay) {
            return new Promise(resolve => {
                setTimeout(() => {
                    el.classList.remove('stream-hidden');
                    el.style.cssText += 'opacity:0;transform:translateY(6px);transition:opacity .3s ease,transform .3s ease';
                    requestAnimationFrame(() => {
                        el.style.opacity   = '1';
                        el.style.transform = 'translateY(0)';
                    });
                    resolve();
                }, delay);
            });
        }

        async function typePrompt() {
            promptEl.textContent = '';
            promptEl.classList.add('typing');
            for (let i = 0; i < promptText.length; i++) {
                promptEl.textContent += promptText[i];
                await new Promise(r => setTimeout(r, 30 + Math.random() * 20));
            }
            await new Promise(r => setTimeout(r, 300));
        }

        async function streamWithout() {
            const wParas = withoutBody.querySelectorAll('[data-stream="w"]');
            for (const p of wParas) {
                await streamText(p, p._originalHTML.replace(/<[^>]*>/g, ''), 22);
                await new Promise(r => setTimeout(r, 150));
            }
        }

        async function streamWith() {
            const nlParas = withBody.querySelectorAll('[data-stream="nl"]');
            for (const p of nlParas) {
                await streamText(p, p._originalHTML.replace(/<[^>]*>/g, ''), 20);
            }
            await new Promise(r => setTimeout(r, 200));

            const nlBlocks = withBody.querySelectorAll('[data-stream-block="nl"]');
            for (const block of nlBlocks) {
                await revealElement(block, 150);
                const rows = block.querySelectorAll('[data-stream-row="nl"]');
                for (const row of rows) await revealElement(row, 80);
                await new Promise(r => setTimeout(r, 100));
            }
        }

        setTimeout(async () => {
            await typePrompt();
            streamWithout();
            streamWith();
        }, 1000);
    }

});
