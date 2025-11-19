// Types and Interfaces
interface BlinkConfig {
    color1: string;
    color2: string;
    pattern: string;
    timeOffset: number;
}

interface ColorPair {
    color1: string;
    color2: string;
}

// Enums
enum State {
    WELCOME = 'welcome',
    COUNTDOWN = 'countdown',
    RUNNING = 'running',
}

enum Role {
    INITIATOR = 'initiator',
    RECEIVER = 'receiver',
}

enum Duration {
    BETWEEN = 100,
    DOT = 250,
    DASH = 750,
    SPACE = 1000,
}

// Constants
const PATTERNS: readonly string[] = [
    "..-..-.-..",
    ".-..-..-..",
    "...-..-.-.",
    ".-...-.-..",
    "-.-.-.-.",
    ".-.-.-.-",
    "-..-.-.-",
    "..-.-.--",
    "-----.",
    "----.-",
] as const;

const COLORS: readonly string[] = [
    "--color-secondary",
    "--color-accent",
    "--color-info",
    "--color-success",
    "--color-warning",
    "--color-error",
] as const;

let currentState: State = State.WELCOME;
let currentRole: Role = Role.INITIATOR;
let blinkConfig: BlinkConfig | null = null;
let isBackgroundFlashing: boolean = false;
let phoneColorTimeoutId: number | null = null;
let shouldPauseBackground: boolean = true; // Paused by default (WELCOME state)
let countdownIntervalId: number | null = null;
let currentAnimationId: number = 0; // Track the current animation to cancel old ones
let startTime: number;

const playButton = document.getElementById('playButton')!;
const cancelButton = document.getElementById('cancelButton')!;
const countdownText = document.getElementById('countdownText')!;
const instructions = document.getElementById('instructions')!;

// Constants for instruction text
const INSTRUCTIONS = {
    INITIATOR: `
        <h2 class="text-xl font-bold">How to use</h2>
        <div class="text-sm">
            <p class="mt-2">Click the play button above. This will generate a unique Find My Blink (pattern and
                colors) that can be sent to one (or more) people.</p>

            <p class="mt-2">Share the Find My Blink and their phone will synchronize with your flashing. Hold up
                you phone screen to help them find you.</p>

            <p class="mt-2">No account is needed, no information is stored.</p>
        </div>
    `,
    RECEIVER: `
        <h2 class="text-xl font-bold">How to use</h2>
        <div class="text-sm">
            <p class="mt-2">Click the play button above. This will start a synchronized Find My Blink (pattern and colors).</p>
        </div>
    `
};

function updateUI(): void {
    const body = document.body;
    const defaultColor = getComputedStyle(document.documentElement).getPropertyValue('--color-base-200');

    // Clear countdown if exists
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }

    switch (currentState) {
        case State.WELCOME:
            playButton.classList.remove('hidden');
            cancelButton.classList.add('hidden');
            countdownText.innerHTML = "&nbsp;"
            countdownText.classList.remove('hidden');
            instructions.classList.remove('hidden');
            shouldPauseBackground = true;
            isBackgroundFlashing = false;
            body.style.backgroundColor = defaultColor;
            break;

        case State.COUNTDOWN:
            playButton.classList.add('hidden');
            cancelButton.classList.remove('hidden');
            countdownText.classList.remove('hidden');
            countdownText.textContent = 'Starting in 3';
            instructions.classList.add('hidden');
            shouldPauseBackground = false;
            break;

        case State.RUNNING:
            playButton.classList.add('hidden');
            cancelButton.classList.remove('hidden');
            instructions.classList.add('hidden');
            countdownText.classList.add('hidden');
            shouldPauseBackground = false;
            break;
    }
}

// Function to transition to a new state
function setState(newState: State): void {
    const oldState = currentState;
    // console.log(`State change: ${oldState} -> ${newState}`);
    currentState = newState;
    updateUI();
}

// Event handlers
async function handlePlayClick() {
    // Initialize blinkConfig on first play if it's not set (for INITIATOR role)
    if (blinkConfig === null && currentRole === Role.INITIATOR) {
        blinkConfig = {
            color1: getRandomColors().color1,
            color2: getRandomColors().color2,
            pattern: getRandomPattern(),
            timeOffset: Math.floor(Math.random() * 5)
        };

        // console.log('Initialized blinkConfig on first play:', blinkConfig);

        const shareUrl = generateShareUrl();
        // console.log(`Encoded url:${shareUrl}`)

        // Try to share, show fallback if it fails
        if (!await tryShare(shareUrl)) {
            showShareFallback(shareUrl);
            return; // Don't proceed with countdown
        }
    }

    // Start countdown/blinking
    setState(State.COUNTDOWN);
    currentAnimationId++;

    if (blinkConfig) {
        startTime = getNextStartTime(blinkConfig.timeOffset);
        // console.log(`Starttime: ${new Date(startTime).toLocaleTimeString()}`);
        startCountdown(startTime);
        animateBackgroundColor(blinkConfig, startTime, currentAnimationId);
    }
}

async function tryShare(url: string | undefined): Promise<boolean> {
    try {
        if (navigator.share && url) {
            await navigator.share({
                title: 'Find My B.link',
                text: 'Use this link to sync your screen flashing with mine!',
                url: url
            });
            // console.log('Shared successfully');
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

function showShareFallback(urlToCopy: string | undefined): void {
    const hasClipboard = !!navigator.clipboard;
    // console.log('Clipboard API available:', hasClipboard);

    const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>`;

    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`;

    instructions.innerHTML = `
        <p class="mb-2">Unable to share the Find My Blink link. <br/><br/> ${hasClipboard ? 'Copy' : 'Please copy'} the link below and send it to the person you are trying to locate.<br /> <br />Once shared, click the play button.</p>
        <div class="flex items-center gap-1 mt-2">
            <a href="#" id="shareUrlLink" class="flex-1 underline text-info break-all text-xs">${urlToCopy}</a>
            ${hasClipboard ? `<button id="copyButton" class="btn btn-sm btn-square" style="background-color: white; color: black;" title="Copy">${copyIcon}</button>` : ''}
        </div>
    `;

    if (!hasClipboard) return;

    const copyToClipboard = async () => {
        // console.log('Copy button clicked, attempting to copy:', urlToCopy);
        try {
            if (!navigator.clipboard) {
                alert('Clipboard not available. Please copy manually: ' + urlToCopy);
                return;
            }
            await navigator.clipboard.writeText(urlToCopy || '');
            // console.log('Successfully copied to clipboard:', urlToCopy);

            const copyButton = document.getElementById('copyButton');
            if (copyButton) {
                copyButton.innerHTML = checkIcon;
                setTimeout(() => { copyButton.innerHTML = copyIcon; }, 2000);
            }
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            alert('Failed to copy. Please copy manually: ' + urlToCopy);
        }
    };

    const shareUrlLink = document.getElementById('shareUrlLink');
    const copyButton = document.getElementById('copyButton');

    shareUrlLink?.addEventListener('click', async (e) => {
        e.preventDefault();
        await copyToClipboard();
    });

    copyButton?.addEventListener('click', async (e) => {
        e.preventDefault();
        await copyToClipboard();
    });
}

function handleCancelClick() {
    blinkConfig = null;
    instructions.innerHTML = currentRole === Role.RECEIVER ? INSTRUCTIONS.RECEIVER : INSTRUCTIONS.INITIATOR;
    setState(State.WELCOME);
}

function getRandomColors(): ColorPair {
    const color1 = COLORS[Math.floor(Math.random() * COLORS.length)];
    const remaining = COLORS.filter(c => c !== color1);
    const color2 = remaining[Math.floor(Math.random() * remaining.length)];
    return { color1, color2 };
}

function getNextStartTime(digit: number): number {
    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);
    const digit1 = digit % 10;
    const digit2 = (digit + 5) % 10;

    // Start checking from the next full second
    let candidateSecond = currentSecond + 1;

    // Find the next second that ends in digit1 or digit2
    while (true) {
        const lastDigit = candidateSecond % 10;
        if (lastDigit === digit1 || lastDigit === digit2) {
            return candidateSecond * 1000;
        }
        candidateSecond++;
    }
}

function getRandomPattern() {
    return PATTERNS[Math.floor(Math.random() * PATTERNS.length)]
}

// Animate phoneHolder color changes
function animatePhoneColor(): void {
    const phoneHolder = document.getElementById('phoneHolder');

    function changeColor() {
        if (!phoneHolder) return;

        // If state is RUNNING, set phone to white and stop color animation
        if (currentState === State.RUNNING) {
            phoneHolder.style.color = 'white';
            // Check again later to resume when state changes
            phoneColorTimeoutId = setTimeout(changeColor, 100);
            return;
        }

        // Pick a random color from the COLORS array
        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        const colorValue = getComputedStyle(document.documentElement).getPropertyValue(randomColor);

        // Update the color
        phoneHolder.style.color = colorValue;

        // Wait either 250ms or 750ms before changing again
        const waitTime = Math.random() < 0.5 ? 250 : 750;
        phoneColorTimeoutId = setTimeout(changeColor, waitTime);
    }

    // Start the animation
    changeColor();
}

function startCountdown(startTime: number): void {
    // Clear any existing countdown
    if (countdownIntervalId !== null) {
        clearInterval(countdownIntervalId);
    }

    function updateCountdown() {
        const now = Date.now();
        const timeLeft = startTime - now;

        if (timeLeft <= 0) {
            if (countdownIntervalId !== null) {
                clearInterval(countdownIntervalId);
            }
            countdownIntervalId = null;
            return;
        }

        const secondsLeft = Math.ceil(timeLeft / 1000);
        if (countdownText) {
            countdownText.textContent = `Starting in ${secondsLeft}`;
        }
    }

    // Update immediately
    updateCountdown();

    // Then update every 100ms for smooth countdown
    countdownIntervalId = setInterval(updateCountdown, 100);
}

function animateBackgroundColor(config: BlinkConfig, startTime: number, animationId: number): void {
    const body = document.body;
    const phoneHolder = document.getElementById('phoneHolder');
    const color1Value = getComputedStyle(document.documentElement).getPropertyValue(config.color1);
    const color2Value = getComputedStyle(document.documentElement).getPropertyValue(config.color2);
    const defaultColor = getComputedStyle(document.documentElement).getPropertyValue('--color-base-200');

    async function runPattern(): Promise<void> {
        // Check if this animation has been cancelled or should pause
        if (animationId !== currentAnimationId) return;

        if (shouldPauseBackground) {
            await new Promise(resolve => setTimeout(resolve, 100));
            runPattern();
            return;
        }

        // Wait until start time
        const now = Date.now();
        const waitTime = startTime - now;
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Check again after waiting
        if (animationId !== currentAnimationId || shouldPauseBackground) {
            if (shouldPauseBackground) {
                await new Promise(resolve => setTimeout(resolve, 100));
                runPattern();
            }
            return;
        }

        // Start flashing
        isBackgroundFlashing = true;
        if (phoneHolder) phoneHolder.style.color = 'white';
        setState(State.RUNNING);

        // Run the pattern
        let currentColor = color1Value;
        for (let i = 0; i < config.pattern.length; i++) {
            if (animationId !== currentAnimationId) {
                body.style.backgroundColor = defaultColor;
                isBackgroundFlashing = false;
                return;
            }

            if (shouldPauseBackground) {
                body.style.backgroundColor = defaultColor;
                isBackgroundFlashing = false;
                await new Promise(resolve => setTimeout(resolve, 100));
                runPattern();
                return;
            }

            const char = config.pattern[i];
            body.style.backgroundColor = currentColor;

            const duration = char === '.' ? Duration.DOT : char === '-' ? Duration.DASH : 0;
            await new Promise(resolve => setTimeout(resolve, duration));

            currentColor = currentColor === color1Value ? color2Value : color1Value;
        }

        // Pattern complete
        body.style.backgroundColor = defaultColor;
        isBackgroundFlashing = false;

        // Wait for next cycle
        const nextStartTime = getNextStartTime(config.timeOffset);
        const delayUntilNext = nextStartTime - Date.now();
        if (delayUntilNext > 0) {
            await new Promise(resolve => setTimeout(resolve, delayUntilNext));
        }

        runPattern();
    }

    runPattern();
}

function generateShareUrl(): string | undefined {
    if (!blinkConfig) return;

    const params = new URLSearchParams({
        c1: COLORS.indexOf(blinkConfig.color1).toString(),
        c2: COLORS.indexOf(blinkConfig.color2).toString(),
        p: PATTERNS.indexOf(blinkConfig.pattern).toString(),
        t: blinkConfig.timeOffset.toString()
    });

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function encodeUrl(): string | undefined {
    const url = generateShareUrl();
    if (url && currentRole === Role.RECEIVER) {
        window.history.replaceState({}, '', url);
    }
    return url;
}

function decodeUrl(): BlinkConfig | null {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('c1') || !params.has('c2') || !params.has('p') || !params.has('t')) {
        return null;
    }

    const color1Index = parseInt(params.get('c1')!);
    const color2Index = parseInt(params.get('c2')!);
    const patternIndex = parseInt(params.get('p')!);
    const timeOffset = parseInt(params.get('t')!);

    // Validate indices
    if (color1Index < 0 || color1Index >= COLORS.length ||
        color2Index < 0 || color2Index >= COLORS.length ||
        patternIndex < 0 || patternIndex >= PATTERNS.length ||
        timeOffset < 0 || timeOffset > 9) {
        return null;
    }

    return {
        color1: COLORS[color1Index],
        color2: COLORS[color2Index],
        pattern: PATTERNS[patternIndex],
        timeOffset: timeOffset
    };
}

window.addEventListener('DOMContentLoaded', () => {
    playButton.addEventListener('click', handlePlayClick);
    cancelButton.addEventListener('click', handleCancelClick);

    updateUI();
    animatePhoneColor();

    const decodedConfig = decodeUrl();
    if (decodedConfig) {
        blinkConfig = decodedConfig;
        currentRole = Role.RECEIVER;
        // console.log('Receiver mode: blinkConfig loaded from URL', blinkConfig);
        instructions.innerHTML = INSTRUCTIONS.RECEIVER;
    }

    const words = ['friend', 'bestie', 'soulmate', 'bae', 'partner'];
    let currentIndex = 0;
    const wordElement = document.getElementById('wordSwap');

    if (wordElement) {
        setInterval(() => {
            currentIndex = (currentIndex + 1) % words.length;
            wordElement.classList.remove('word-fade');
            void wordElement.offsetWidth;
            wordElement.textContent = words[currentIndex];
            wordElement.classList.add('word-fade');
        }, 2000);
    }
});
