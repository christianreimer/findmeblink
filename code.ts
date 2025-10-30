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

function updateUI(): void {
    const body = document.body;
    const defaultColor = getComputedStyle(document.documentElement).getPropertyValue('--color-base-200');

    switch (currentState) {
        case State.WELCOME:
            // playButton visible, cancelButton hidden, countdownText empty
            playButton.classList.remove('hidden');
            cancelButton.classList.add('hidden');
            countdownText.innerHTML = "&nbsp;"
            countdownText.classList.remove('hidden');
            instructions.classList.remove('hidden');
            // Clear countdown if running
            if (countdownIntervalId) {
                clearInterval(countdownIntervalId);
                countdownIntervalId = null;
            }
            // Pause background flashing and reset to default color
            shouldPauseBackground = true;
            isBackgroundFlashing = false;
            body.style.backgroundColor = defaultColor;
            break;

        case State.COUNTDOWN:
            // playButton hidden, cancelButton visible, countdownText shows countdown
            playButton.classList.add('hidden');
            cancelButton.classList.remove('hidden');
            countdownText.classList.remove('hidden');
            countdownText.textContent = 'Starting in 3';
            instructions.classList.add('hidden');
            // Allow background flashing to start
            shouldPauseBackground = false;
            break;

        case State.RUNNING:
            // cancelButton visible, playButton hidden
            playButton.classList.add('hidden');
            cancelButton.classList.remove('hidden');
            instructions.classList.add('hidden');
            countdownText.classList.add('hidden');
            // Allow background flashing to continue
            shouldPauseBackground = false;
            break;
    }
}

// Function to transition to a new state
function setState(newState: State): void {
    const oldState = currentState;
    console.log(`State change: ${oldState} -> ${newState}`);
    currentState = newState;
    updateUI();
}

// Event handlers
async function handlePlayClick() {
    // Initialize blinkConfig on first play if it's not set (for INITIATOR role)
    if (blinkConfig === null && currentRole === Role.INITIATOR) {
        const colors = getRandomColors();
        const pattern = getRandomPattern();

        // Random number between 0 and 4
        const timeOffset = Math.floor(Math.random() * 5);

        blinkConfig = {
            color1: colors.color1,
            color2: colors.color2,
            pattern: pattern,
            timeOffset: timeOffset
        };

        console.log('Initialized blinkConfig on first play:', blinkConfig);

        // Generate share URL (but don't update browser URL for INITIATOR)
        const shareUrl = generateShareUrl();

        console.log(`Encoded url:${shareUrl}`)

        // Use Web Share API if available
        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'Find My B.link',
                    text: 'Use this link to sync your screen flashing with mine!',
                    url: shareUrl
                });
                console.log('Shared successfully');
            } else {
                throw new Error('Share not available');
            }
        } catch (error) {
            // Share failed or not available - show fallback message
            const urlToCopy = shareUrl; // Capture in closure

            // Check if clipboard API is available
            const hasClipboard = !!navigator.clipboard;
            console.log('Clipboard API available:', hasClipboard);

            const copyToClipboard = async () => {
                console.log('Copy button clicked, attempting to copy:', urlToCopy);
                try {
                    if (!navigator.clipboard) {
                        console.error('Clipboard API not available');
                        alert('Clipboard not available. Please copy manually: ' + urlToCopy);
                        return;
                    }
                    await navigator.clipboard.writeText(urlToCopy || '');
                    console.log('Successfully copied to clipboard:', urlToCopy);
                    // Show feedback that it was copied
                    const copyButton = document.getElementById('copyButton');
                    if (copyButton) {
                        copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>`;
                        setTimeout(() => {
                            copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>`;
                        }, 2000);
                    }
                } catch (err) {
                    console.error('Failed to copy to clipboard:', err);
                    alert('Failed to copy. Please copy manually: ' + urlToCopy);
                }
            };

            instructions.innerHTML = `
                <p class="mb-2">Unable to share the Find My Blink link. <br/><br/> ${hasClipboard ? 'Copy' : 'Please copy'} the link below and send it to the person you are trying to locate.<br /> <br />Once shared, click the play button.</p>
                <div class="flex items-center gap-1 mt-2">
                    <a href="#" id="shareUrlLink" class="flex-1 underline text-info break-all text-xs">${urlToCopy}</a>
                    ${hasClipboard ? `<button id="copyButton" class="btn btn-sm btn-square" style="background-color: white; color: black;" title="Copy">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>` : ''}
                </div>
            `;

            // Add click handlers directly without setTimeout
            const shareUrlLink = document.getElementById('shareUrlLink');
            const copyButton = document.getElementById('copyButton');

            if (shareUrlLink && hasClipboard) {
                shareUrlLink.addEventListener('click', async (e) => {
                    e.preventDefault();
                    console.log('Share URL link clicked');
                    await copyToClipboard();
                });
            }

            if (copyButton && hasClipboard) {
                copyButton.addEventListener('click', async (e) => {
                    e.preventDefault();
                    console.log('Copy button clicked');
                    await copyToClipboard();
                });
            }

            return; // Don't proceed with countdown
        }
    }

    // Start countdown/blinking
    setState(State.COUNTDOWN);

    currentAnimationId++;
    const animationId = currentAnimationId;

    if (blinkConfig) {
        startTime = getNextStartTime(blinkConfig.timeOffset);
        console.log(`Starttime: ${new Date(startTime).toLocaleTimeString()}`);
        startCountdown(startTime);
        animateBackgroundColor(blinkConfig, startTime, animationId);
    }
}

function handleCancelClick() {
    blinkConfig = null;

    // Reset instructions to original content based on role
    if (currentRole === Role.RECEIVER) {
        instructions.innerHTML = `
            <h2 class="text-xl font-bold">How to use</h2>
            <div class="text-sm">
                <p class="mt-2">Click the play button above. This will start a synchronized Find My Blink (pattern and colors).</p>
            </div>
        `;
    } else {
        instructions.innerHTML = `
            <h2 class="text-xl font-bold">How to use</h2>
            <div class="text-sm">
                <p class="mt-2">Click the play button above. This will generate a unique Find My Blink (pattern and
                    colors) that can be sent to one (or more) people.</p>

                <p class="mt-2">Share the Find My Blink and their phone will synchronize with your flashing. Hold up
                    you phone screen to help them find you.</p>

                <p class="mt-2">No account is needed, no information is stored.</p>
            </div>
        `;
    }

    setState(State.WELCOME);
}

function getRandomColors() {
    const color1 = COLORS[Math.floor(Math.random() * COLORS.length)]
    const remaining = COLORS.filter(c => c !== color1)
    const color2 = remaining[Math.floor(Math.random() * remaining.length)]
    return {
        color1: color1,
        color2: color2,
    }
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

    // Get the actual color values from CSS variables
    const color1Value = getComputedStyle(document.documentElement).getPropertyValue(config.color1);
    const color2Value = getComputedStyle(document.documentElement).getPropertyValue(config.color2);
    const defaultColor = getComputedStyle(document.documentElement).getPropertyValue('--color-base-200');

    async function runPattern(): Promise<void> {
        // Check if this animation has been cancelled
        if (animationId !== currentAnimationId) {
            return;
        }

        // Check if we should pause - if so, wait and check again
        if (shouldPauseBackground) {
            await new Promise(resolve => setTimeout(resolve, 100));
            runPattern();
            return;
        }

        const now = Date.now();
        const waitTime = startTime - now;
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Check again if this animation has been cancelled after waiting
        if (animationId !== currentAnimationId) {
            return;
        }

        // Check again if we should pause before starting the pattern
        if (shouldPauseBackground) {
            await new Promise(resolve => setTimeout(resolve, 100));
            runPattern();
            return;
        }

        // Set flag to indicate background is flashing
        isBackgroundFlashing = true;
        if (phoneHolder) {
            phoneHolder.style.color = 'white';
        }

        // Change state to RUNNING when flashing starts
        setState(State.RUNNING);

        let currentColor = color1Value;
        for (let i = 0; i < config.pattern.length; i++) {
            // Check if this animation has been cancelled
            if (animationId !== currentAnimationId) {
                isBackgroundFlashing = false;
                body.style.backgroundColor = defaultColor;
                return;
            }

            if (shouldPauseBackground) {
                isBackgroundFlashing = false;
                body.style.backgroundColor = defaultColor;
                await new Promise(resolve => setTimeout(resolve, 100));
                runPattern();
                return;
            }

            const char = config.pattern[i];

            // Toggle the background color
            body.style.backgroundColor = currentColor;

            // Determine wait time based on character
            let duration: number;
            if (char === '.') {
                duration = Duration.DOT;
            } else if (char === '-') {
                duration = Duration.DASH;
            } else {
                duration = 0;
            }

            await new Promise(resolve => setTimeout(resolve, duration));

            currentColor = currentColor === color1Value ? color2Value : color1Value;
        }

        // When the pattern ends, make the background color the default color
        body.style.backgroundColor = defaultColor;

        // Clear flag to allow phone color animation to resume
        isBackgroundFlashing = false;

        // Calculate the next start time and wait for it
        const nextStartTime = getNextStartTime(config.timeOffset);
        const currentTime = Date.now();
        const delayUntilNext = nextStartTime - currentTime;

        if (delayUntilNext > 0) {
            await new Promise(resolve => setTimeout(resolve, delayUntilNext));
        }

        // Restart the loop
        runPattern();
    }

    // Start the animation
    runPattern();
};

function generateShareUrl(): string | undefined {
    if (!blinkConfig) return;

    // Find indices of colors and pattern
    const color1Index = COLORS.indexOf(blinkConfig.color1);
    const color2Index = COLORS.indexOf(blinkConfig.color2);
    const patternIndex = PATTERNS.indexOf(blinkConfig.pattern);

    // Create URL with query parameters
    const params = new URLSearchParams();
    params.set('c1', color1Index.toString());
    params.set('c2', color2Index.toString());
    params.set('p', patternIndex.toString());
    params.set('t', blinkConfig.timeOffset.toString());

    const newUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

    return newUrl;
}

function encodeUrl(): string | undefined {
    const url = generateShareUrl();

    // Only update browser URL for RECEIVER role
    if (url && currentRole === Role.RECEIVER) {
        window.history.replaceState({}, '', url);
    }

    return url;
}

function decodeUrl(): BlinkConfig | null {
    const params = new URLSearchParams(window.location.search);

    // Check if all required parameters exist
    if (!params.has('c1') || !params.has('c2') || !params.has('p') || !params.has('t')) {
        return null;
    }

    // Parse indices
    const color1Index = parseInt(params.get('c1')!);
    const color2Index = parseInt(params.get('c2')!);
    const patternIndex = parseInt(params.get('p')!);
    const timeOffset = parseInt(params.get('t')!);

    // Validate indices are within bounds
    if (color1Index < 0 || color1Index >= COLORS.length ||
        color2Index < 0 || color2Index >= COLORS.length ||
        patternIndex < 0 || patternIndex >= PATTERNS.length ||
        timeOffset < 0 || timeOffset > 9) {
        return null;
    }

    // Return decoded blinkConfig
    return {
        color1: COLORS[color1Index],
        color2: COLORS[color2Index],
        pattern: PATTERNS[patternIndex],
        timeOffset: timeOffset
    };
}

window.addEventListener('DOMContentLoaded', () => {
    // Check if URL contains encoded blinkConfig
    playButton.addEventListener('click', handlePlayClick);
    cancelButton.addEventListener('click', handleCancelClick);

    updateUI();
    animatePhoneColor();

    const decodedConfig = decodeUrl();
    if (decodedConfig) {
        // Set as receiver and use the decoded config
        blinkConfig = decodedConfig;
        currentRole = Role.RECEIVER;
        console.log('Receiver mode: blinkConfig loaded from URL', blinkConfig);

        // Update instructions for receiver
        instructions.innerHTML = `
            <h2 class="text-xl font-bold">How to use</h2>
            <div class="text-sm">
                <p class="mt-2">Click the play button above. This will start a synchronized Find My Blink (pattern and colors).</p>
            </div>
        `;
    }
});
