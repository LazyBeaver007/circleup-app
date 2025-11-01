// ---------------------------------------------------
// Firebase SDK Imports (MUST be at top level)
// ---------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore,
    setLogLevel,
    collection,
    doc,
    addDoc,
    onSnapshot,
    deleteDoc,
    updateDoc,
    serverTimestamp, // Use this for consistency
    Timestamp,      // Import Timestamp for date calcs
    query,
    getDoc,
    setDoc,
    arrayUnion,
    arrayRemove, 
    getDocs,
    where,
    orderBy,
    limit,
    runTransaction,
    writeBatch
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ---------------------------------------------------
// App & Firebase Configuration (Top Level)
// ---------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBdJFMKSKhJdw6PR8ADNNUr7_ErDGazXbI",
  authDomain: "circleup-2d6d8.firebaseapp.com",
  projectId: "circleup-2d6d8",
  storageBucket: "circleup-2d6d8.firebasestorage.app",
  messagingSenderId: "939590083553",
  appId: "1:939590083553:web:7800fa3224381634d928a0",
  measurementId: "G-RB97E70HZP"
};

// Cat Quotes
const catQuotes = [
    "Stay pawsitive!",
    "One paw at a time.",
    "You're purr-fectly capable!",
    "Don't fur-get to take a break!",
    "Believe in your-shelf, you've got this!",
    "Looking good, feline good!",
    "You've got to be kitten me, you're doing great!",
    "Don't procrastinate, procrastin-later.",
    "Seize the meow-ment!"
];

let app, auth, db, analytics;
let currentUserId = null;
let userEmail = null;
let userDisplayName = null;
let goalsUnsubscribe = null;
let feedUnsubscribe = null;
let userGoals = [];
let userCircles = []; 
let currentCircleId = null; 
let countdownInterval = null; // NEW: For the deadline timer

// Timer settings object with defaults
let timerSettings = {
    pomodoro: 1500, // 25 minutes
    short: 300,     // 5 minutes
    long: 900       // 15 minutes
};

// Initialize Firebase (Top Level)
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    analytics = getAnalytics(app);
    setLogLevel('debug'); 
    console.log("Firebase initialized successfully.");
} catch (error) {
    console.error("Error initializing Firebase:", error);
}

// ---------------------------------------------------
// Main App Logic (Wait for DOM to load)
// ---------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    
    // --- DOM Element References ---
    const loginView = document.getElementById("login-view");
    const dashboardView = document.getElementById("dashboard-view");
    const loginButton = document.getElementById("login-button");
    const logoutButton = document.getElementById("logout-button");
    const userDisplayNameElement = document.getElementById("user-display-name");
    const currentCircleIdDisplayElement = document.getElementById("current-circle-id-display");
    
    const catQuoteDisplay = document.getElementById("cat-quote-display");
    
    const modal = document.getElementById("modal");
    const modalContent = document.getElementById("modal-content");
    const addGoalButton = document.getElementById("add-goal-button");
    const goalsList = document.getElementById("goals-list");
    const checkInButton = document.getElementById("check-in-button");
    const feedList = document.getElementById("feed-list");
    const circlesList = document.getElementById("circles-list");
    const createCircleButton = document.getElementById("create-circle-button");
    const joinCircleButton = document.getElementById("join-circle-button");
    const editAliasButton = document.getElementById("edit-alias-button");
    const circleMembersList = document.getElementById("circle-members-list");
    const accountabilityStatusList = document.getElementById("accountability-status-list"); 
    
    // --- "The Locker" ---
    const viewArchiveButton = document.getElementById("view-archive-button");

    // --- "Carcosa" ---
    const focusModeButton = document.getElementById("focus-mode-button");

    // --- "The Thread" (Stats) ---
    const viewStatsButton = document.getElementById("view-stats-button");

    // --- NEW: Deadline Countdown DOM ---
    const editDeadlineButton = document.getElementById("edit-deadline-button");
    const countdownPlaceholder = document.getElementById("countdown-placeholder");
    const countdownTimerDiv = document.getElementById("countdown-timer");
    const countdownDays = document.getElementById("countdown-days");
    const countdownHours = document.getElementById("countdown-hours");
    const countdownMinutes = document.getElementById("countdown-minutes");
    const countdownSeconds = document.getElementById("countdown-seconds");

    // --- Pomodoro DOM References ---
    const timerDisplay = document.getElementById("timer-display");
    const pomodoroButton = document.getElementById("pomodoro-button");
    const shortBreakButton = document.getElementById("short-break-button");
    const longBreakButton = document.getElementById("long-break-button");
    const startTimerButton = document.getElementById("start-timer-button");
    const resetTimerButton = document.getElementById("reset-timer-button");
    const timerButtons = [pomodoroButton, shortBreakButton, longBreakButton];
    const timerSettingsButton = document.getElementById("timer-settings-button");

    // --- YouTube Player DOM References ---
    const ytPlayer = document.getElementById("yt-player");
    const ytLinkInput = document.getElementById("yt-link-input");
    const ytLoadButton = document.getElementById("yt-load-button");

    // --- Theme Selector ---
    const themeSelector = document.getElementById("theme-selector");


    // --- Pomodoro State ---
    let timerInterval = null;
    let timerMode = 'pomodoro';
    let timerSeconds = timerSettings.pomodoro; // Use default
    let isRunning = false;

    // --- Theme Functions ---
    const setTheme = (theme_class) => {
        // theme_class will be "theme-light", "theme-rose", etc.
        localStorage.setItem('theme', theme_class);
        document.documentElement.className = theme_class; // Set class on <html>
        themeSelector.value = theme_class; // Sync dropdown
    };

    // --- Pomodoro Functions ---
    function updateTimerDisplay() {
        const minutes = Math.floor(timerSeconds / 60);
        const seconds = timerSeconds % 60;
        timerDisplay.textContent = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    function setTimer(mode) {
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        isRunning = false;
        startTimerButton.textContent = "Start";
        timerMode = mode;

        // Update active button style
        timerButtons.forEach(btn => btn.classList.remove('timer-button-active'));
        if (mode === 'pomodoro') {
            timerSeconds = timerSettings.pomodoro;
            pomodoroButton.classList.add('timer-button-active');
        } else if (mode === 'short') {
            timerSeconds = timerSettings.short;
            shortBreakButton.classList.add('timer-button-active');
        } else if (mode === 'long') {
            timerSeconds = timerSettings.long;
            longBreakButton.classList.add('timer-button-active');
        }
        updateTimerDisplay();
    }

    function startStopTimer() {
        if (isRunning) {
            // Pause the timer
            clearInterval(timerInterval);
            timerInterval = null;
            isRunning = false;
            startTimerButton.textContent = "Start";
        } else {
            // Start the timer
            isRunning = true;
            startTimerButton.textContent = "Pause";
            timerInterval = setInterval(() => {
                timerSeconds--;
                updateTimerDisplay();

                if (timerSeconds < 0) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    isRunning = false;
                    showMessageModal("Time's up! Take your break.", "Pomodoro Finished");
                    setTimer(timerMode); // Reset to current mode
                }
            }, 1000);
        }
    }

    function resetTimer() {
        setTimer(timerMode); // Reset to the current active mode
    }
    
    function showTimerSettingsModal() {
        const modalHTML = `
            <form id="timer-settings-form">
                <h3 class="text-xl font-semibold mb-6 text-text-primary">Timer Settings</h3>
                <div class="mb-4">
                    <label for="pomo-mins" class="block text-sm font-medium text-text-secondary mb-2">Pomodoro (minutes)</label>
                    <input type="number" id="pomo-mins" name="pomodoro" class="modal-input" required min="1" value="${timerSettings.pomodoro / 60}">
                </div>
                <div class="mb-4">
                    <label for="short-mins" class="block text-sm font-medium text-text-secondary mb-2">Short Break (minutes)</label>
                    <input type="number" id="short-mins" name="short" class="modal-input" required min="1" value="${timerSettings.short / 60}">
                </div>
                <div class="mb-4">
                    <label for="long-mins" class="block text-sm font-medium text-text-secondary mb-2">Long Break (minutes)</label>
                    <input type="number" id="long-mins" name="long" class="modal-input" required min="1" value="${timerSettings.long / 60}">
                </div>
                <div class="flex gap-4">
                    <button type="button" id="modal-cancel-button" class="modal-button-secondary">
                        Cancel
                    </button>
                    <button type="submit" id="modal-submit-button" class="modal-button-primary">
                        Save
                    </button>
                </div>
            </form>
        `;
        showModal(modalHTML);
        document.getElementById("timer-settings-form").addEventListener("submit", handleTimerSettingsSubmit);
        document.getElementById("modal-cancel-button").addEventListener("click", closeModal);
    }
    
    function handleTimerSettingsSubmit(event) {
        event.preventDefault();
        const form = event.target;
        
        const newPomodoro = parseInt(form.pomodoro.value) * 60;
        const newShort = parseInt(form.short.value) * 60;
        const newLong = parseInt(form.long.value) * 60;

        if (newPomodoro < 60 || newShort < 60 || newLong < 60) {
            showMessageModal("All times must be at least 1 minute.", "Invalid Input");
            return;
        }

        timerSettings.pomodoro = newPomodoro;
        timerSettings.short = newShort;
        timerSettings.long = newLong;
        
        localStorage.setItem('timerSettings', JSON.stringify(timerSettings));
        
        setTimer(timerMode); 
        closeModal();
    }

    // --- YouTube Player Functions ---
    function parseYoutubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    async function handleLoadYoutubeVideo() {
        const url = ytLinkInput.value.trim();
        const videoId = parseYoutubeId(url);

        if (videoId) {
            ytPlayer.src = `https://www.youtube.com/embed/${videoId}`;
            ytLinkInput.value = ""; // Clear input
            
            if (currentUserId) {
                try {
                    const userRef = doc(db, `users/${currentUserId}`);
                    await updateDoc(userRef, { lastYtVideoId: videoId });
                    console.log("Saved new video ID to profile:", videoId);
                } catch (error) {
                    console.error("Error saving video ID:", error);
                }
            }
        } else {
            showMessageModal("Invalid YouTube URL. Please use a valid 'watch' or 'youtu.be' link.", "Error");
        }
    }
    
    // --- Modal & Utility Functions ---
    function showModal(contentHTML) {
        modalContent.innerHTML = contentHTML;
        modal.classList.remove("hidden");
        // Apply theme styles to dynamically created modal elements
        modalContent.querySelectorAll('.modal-input').forEach(el => {
            el.classList.add('w-full', 'bg-bg-card-secondary', 'border', 'border-border-color', 'text-text-primary', 'rounded-lg', 'px-3', 'py-2', 'focus:outline-none', 'focus:ring-2', 'focus:ring-accent-primary');
        });
        modalContent.querySelectorAll('.modal-button-primary').forEach(el => {
            el.classList.add('animated-button', 'w-1/2', 'bg-accent-primary', 'text-accent-primary-text', 'font-semibold', 'py-2', 'px-4', 'rounded-lg', 'hover:bg-accent-primary-hover', 'transition', 'duration-300');
        });
        modalContent.querySelectorAll('.modal-button-secondary').forEach(el => {
            el.classList.add('animated-button', 'w-1/2', 'bg-bg-card-secondary', 'text-text-secondary', 'font-semibold', 'py-2', 'px-4', 'rounded-lg', 'hover:bg-bg-hover', 'transition', 'duration-300');
        });
    }

    function closeModal() {
        modal.classList.add("hidden");
        modalContent.innerHTML = "";
    }

    function showMessageModal(message, title = "Notification") {
        const modalHTML = `
            <h3 class="text-xl font-semibold mb-4 text-text-primary">${title}</h3>
            <p class="text-text-secondary mb-6">${message}</p>
            <button id="modal-close-button" class="w-full bg-accent-primary text-accent-primary-text font-semibold py-2 px-4 rounded-lg hover:bg-accent-primary-hover transition duration-300">
                Close
            </button>
        `;
        showModal(modalHTML);
        document.getElementById("modal-close-button").addEventListener("click", closeModal);
    }

    function copyToClipboard(text) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";  
        textarea.style.opacity = 0;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand("copy");
            console.log("Copied to clipboard:", text);
            return true;
        } catch (err) {
            console.error("Failed to copy text:", err);
            return false;
        } finally {
            document.body.removeChild(textarea);
        }
    }

    // --- Authentication Logic ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("User is signed in:", user.uid);
            currentUserId = user.uid;
            userEmail = user.email || (user.isAnonymous ? "anonymous" : "user");
            
            loginView.classList.add("hidden");
            dashboardView.classList.remove("hidden");
            dashboardView.classList.add("flex");
            
            loadUserProfile(user); 
            loadUserGoals(currentUserId);

        } else {
            // User is signed out.
            console.log("User is signed out.");
            currentUserId = null;
            userEmail = null;
            userDisplayName = null;
            currentCircleId = null;
            userDisplayNameElement.textContent = "";
            currentCircleIdDisplayElement.textContent = "Not logged in"; 

            dashboardView.classList.add("hidden");
            dashboardView.classList.remove("flex");
            loginView.classList.remove("hidden");
            loginView.classList.add("flex");
            
            // Clean up listeners
            if (goalsUnsubscribe) goalsUnsubscribe();
            if (feedUnsubscribe) feedUnsubscribe();
            if (countdownInterval) clearInterval(countdownInterval); // Stop countdown on logout
            
            clearCountdown(); // NEW: Clear countdown display on logout

            goalsList.innerHTML = "";
            feedList.innerHTML = "";
            circlesList.innerHTML = "";
            circleMembersList.innerHTML = "";
            accountabilityStatusList.innerHTML = ""; 
            userGoals = [];
            userCircles = [];

            resetTimer();
            ytPlayer.src = "https://www.youtube.com/embed/jfKfPfyJRdk";
            
            // Show a new random cat quote on logout
            const quote = catQuotes[Math.floor(Math.random() * catQuotes.length)];
            catQuoteDisplay.textContent = `"${quote}"`;
        }
    });

    // --- NEW: Deadline Countdown Functions ---
    function startCountdown(deadlineDate) {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        countdownPlaceholder.classList.add("hidden");
        countdownTimerDiv.classList.remove("hidden");

        countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = deadlineDate.getTime() - now;

            if (distance < 0) {
                clearInterval(countdownInterval);
                countdownTimerDiv.innerHTML = `<div class="text-2xl font-bold text-status-missed-text">DEADLINE REACHED</div>`;
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            countdownDays.textContent = days < 10 ? '0' + days : days;
            countdownHours.textContent = hours < 10 ? '0' + hours : hours;
            countdownMinutes.textContent = minutes < 10 ? '0' + minutes : minutes;
            countdownSeconds.textContent = seconds < 10 ? '0' + seconds : seconds;

        }, 1000);
    }

    // ***** THIS IS THE FIX *****
    function clearCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        countdownPlaceholder.classList.remove("hidden");
        countdownTimerDiv.classList.add("hidden");
        
        // Reset text content OF EXISTING elements instead of destroying them
        countdownDays.textContent = "0";
        countdownHours.textContent = "0";
        countdownMinutes.textContent = "0";
        countdownSeconds.textContent = "0";
    }

    function showDeadlineModal(currentDeadline) {
        // Format the date for the input field
        const now = new Date();
        let yyyy = now.getFullYear();
        let mm = String(now.getMonth() + 1).padStart(2, '0');
        let dd = String(now.getDate()).padStart(2, '0');
        let hh = String(now.getHours()).padStart(2, '0');
        let ii = String(now.getMinutes()).padStart(2, '0');

        if (currentDeadline) {
            yyyy = currentDeadline.getFullYear();
            mm = String(currentDeadline.getMonth() + 1).padStart(2, '0');
            dd = String(currentDeadline.getDate()).padStart(2, '0');
            hh = String(currentDeadline.getHours()).padStart(2, '0');
            ii = String(currentDeadline.getMinutes()).padStart(2, '0');
        }
        
        const modalHTML = `
            <form id="deadline-form">
                <h3 class="text-xl font-semibold mb-6 text-text-primary">Set Your Deadline</h3>
                <div class="mb-4">
                    <label for="deadline-date" class="block text-sm font-medium text-text-secondary mb-2">Date</label>
                    <input type="date" id="deadline-date" name="date" class="modal-input" required value="${yyyy}-${mm}-${dd}">
                </div>
                <div class="mb-4">
                    <label for="deadline-time" class="block text-sm font-medium text-text-secondary mb-2">Time</label>
                    <input type="time" id="deadline-time" name="time" class="modal-input" required value="${hh}:${ii}">
                </div>
                <div class="flex gap-4">
                    <button type="button" id="modal-clear-button" class="animated-button w-1/3 bg-status-missed-bg text-status-missed-text font-semibold py-2 px-4 rounded-lg hover:bg-bg-hover transition duration-300">
                        Clear
                    </button>
                    <button type="button" id="modal-cancel-button" class="modal-button-secondary">
                        Cancel
                    </button>
                    <button type="submit" id="modal-submit-button" class="modal-button-primary">
                        Save
                    </button>
                </div>
            </form>
        `;
        showModal(modalHTML);
        document.getElementById("deadline-form").addEventListener("submit", handleDeadlineSubmit);
        document.getElementById("modal-cancel-button").addEventListener("click", closeModal);
        document.getElementById("modal-clear-button").addEventListener("click", handleClearDeadline);
    }
    
    async function handleDeadlineSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const dateStr = form.date.value;
        const timeStr = form.time.value;

        if (!dateStr || !timeStr || !currentUserId) return;

        const newDeadline = new Date(`${dateStr}T${timeStr}`);
        
        if (newDeadline < new Date()) {
            showMessageModal("Deadline must be in the future.", "Invalid Date");
            return;
        }

        const submitButton = document.getElementById("modal-submit-button");
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";

        try {
            const userRef = doc(db, `users/${currentUserId}`);
            const deadlineTimestamp = Timestamp.fromDate(newDeadline);
            await updateDoc(userRef, {
                deadline: deadlineTimestamp
            });
            
            startCountdown(newDeadline);
            closeModal();
        } catch (error) {
            console.error("Error saving deadline:", error);
            showMessageModal("Could not save deadline.", "Error");
            submitButton.disabled = false;
            submitButton.textContent = "Save";
        }
    }
    
    async function handleClearDeadline() {
        if (!currentUserId) return;
        
        try {
            const userRef = doc(db, `users/${currentUserId}`);
            await updateDoc(userRef, {
                deadline: null
            });
            clearCountdown();
            closeModal();
        } catch (error) {
            console.error("Error clearing deadline:", error);
            showMessageModal("Could not clear deadline.", "Error");
        }
    }

    // --- User Profile & Circle Management ---
    async function loadUserProfile(user) {
        const userRef = doc(db, `users/${user.uid}`);
        const userSnap = await getDoc(userRef);
        let lastVideoId = 'jfKfPfyJRdk'; // Default lofi video
        let deadline = null; // NEW

        if (!userSnap.exists()) {
            // First time login
            console.log("First time login, creating profile...");
            userDisplayName = user.email.split('@')[0]; // Default alias
            try {
                // 1. Create a "Personal" circle
                const circleRef = await addDoc(collection(db, "circles"), {
                    name: "Personal",
                    owner: user.uid,
                    members: [user.uid]
                });

                // 2. Create the user's profile doc
                const personalCircleData = { id: circleRef.id, name: "Personal" };
                await setDoc(userRef, {
                    email: user.email,
                    displayName: userDisplayName,
                    createdAt: serverTimestamp(),
                    circles: [personalCircleData],
                    lastYtVideoId: lastVideoId,
                    deadline: null // NEW
                });
                
                userCircles = [personalCircleData];
                currentCircleId = circleRef.id;

            } catch (error) {
                console.error("Error creating initial profile:", error);
                showMessageModal("Could not create your user profile.", "Error");
            }
        } else {
            // Existing user
            const userData = userSnap.data();
            userCircles = userData.circles || [];
            userDisplayName = userData.displayName || user.email.split('@')[0];
            lastVideoId = userData.lastYtVideoId || lastVideoId; 
            deadline = userData.deadline || null; // NEW
            
            if (userCircles.length > 0) {
                currentCircleId = userCircles[0].id; 
            } else {
                currentCircleId = null; 
            }
        }
        
        ytPlayer.src = `https://www.youtube.com/embed/${lastVideoId}`;
        userDisplayNameElement.textContent = userDisplayName;
        currentCircleIdDisplayElement.textContent = currentCircleId || "No circle selected";
        renderCircleList();

        // NEW: Start deadline countdown if it exists
        if (deadline) {
            startCountdown(deadline.toDate());
        } else {
            clearCountdown();
        }
        
        if (currentCircleId) {
            loadCircleFeed();
            loadCircleMembers(); 
        } else {
            feedList.innerHTML = `<p class="text-sm text-text-muted">Join or create a circle to see a feed.</p>`;
            circleMembersList.innerHTML = `<p class="text-sm text-text-muted">No circle selected.</p>`;
            accountabilityStatusList.innerHTML = `<p class="text-sm text-text-muted">Select a circle.</p>`;
        }
    }

    function showAliasModal() {
        const modalHTML = `
            <form id="alias-form">
                <h3 class="text-xl font-semibold mb-6 text-text-primary">Set Your Alias</h3>
                <div class="mb-4">
                    <label for="display-name" class="block text-sm font-medium text-text-secondary mb-2">Display Name</label>
                    <input type="text" id="display-name" name="name" class="modal-input" required value="${userDisplayName || ''}">
                </div>
                <div class="flex gap-4">
                    <button type="button" id="modal-cancel-button" class="modal-button-secondary">
                        Cancel
                    </button>
                    <button type="submit" id="modal-submit-button" class="modal-button-primary">
                        Save
                    </button>
                </div>
            </form>
        `;
        showModal(modalHTML);
        document.getElementById("alias-form").addEventListener("submit", handleAliasSubmit);
        document.getElementById("modal-cancel-button").addEventListener("click", closeModal);
    }
    
    async function handleAliasSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const newName = form.name.value.trim();
        if (!newName || !currentUserId) return;

        const submitButton = document.getElementById("modal-submit-button");
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";

        try {
            const userRef = doc(db, `users/${currentUserId}`);
            await updateDoc(userRef, {
                displayName: newName
            });
            userDisplayName = newName;
            userDisplayNameElement.textContent = userDisplayName;
            closeModal();
        } catch (error) {
            console.error("Error updating alias:", error);
            showMessageModal("Could not save alias.", "Error");
            submitButton.disabled = false;
            submitButton.textContent = "Save";
        }
    }
    
    function renderCircleList() {
        circlesList.innerHTML = "";
        if (userCircles.length === 0) {
            circlesList.innerHTML = `<p class="text-sm text-text-muted">You are not in any circles.</p>`;
            return;
        }

        userCircles.forEach(circle => {
            const isActive = circle.id === currentCircleId;
            const buttonClass = isActive
                ? "bg-accent-primary text-accent-primary-text shadow-md"
                : "bg-bg-card-secondary text-text-secondary hover:bg-bg-hover";
            
            const circleElement = document.createElement("div");
            circleElement.className = "flex items-center gap-2";

            const circleButton = document.createElement("button");
            circleButton.className = `animated-button flex-1 text-left font-semibold py-2 px-4 rounded-lg transition duration-300 ${buttonClass}`;
            circleButton.textContent = circle.name;
            circleButton.dataset.circleId = circle.id;
            circleButton.addEventListener("click", () => handleSwitchCircle(circle.id));
            
            const infoButton = document.createElement("button");
            infoButton.className = "show-circle-id-button"; // Class from style.css
            infoButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
            `;
            infoButton.dataset.circleId = circle.id;
            infoButton.dataset.circleName = circle.name;

            circleElement.appendChild(circleButton);
            circleElement.appendChild(infoButton);
            circlesList.appendChild(circleElement);
        });

        document.querySelectorAll('.show-circle-id-button').forEach(button => {
            button.addEventListener('click', () => {
                const id = button.dataset.circleId;
                const name = button.dataset.circleName;
                showCircleInfoModal(id, name);
            });
        });
    }

    function handleSwitchCircle(circleId) {
        currentCircleId = circleId;
        console.log("Switched to circle:", currentCircleId);
        currentCircleIdDisplayElement.textContent = currentCircleId; 
        renderCircleList(); 
        loadCircleFeed(); 
        loadCircleMembers();
    }

    function showCircleInfoModal(id, name) {
        const modalHTML = `
            <h3 class="text-xl font-semibold mb-4 text-text-primary">Circle Info: ${name}</h3>
            <p class="text-sm text-text-secondary mb-2">Share this ID with friends so they can join this circle:</p>
            <input type="text" readonly id="circle-id-share" value="${id}" class="modal-input w-full bg-bg-base text-accent-primary font-medium rounded-lg px-3 py-2 select-all mb-4">
            <div class="flex gap-4">
                <button type="button" id="modal-cancel-button" class="modal-button-secondary">
                    Close
                </button>
                <button type="button" id="copy-circle-id-button" class="modal-button-primary">
                    Copy ID
                </button>
            </div>
        `;
        showModal(modalHTML);
        
        const copyButton = document.getElementById("copy-circle-id-button");
        copyButton.addEventListener("click", () => {
            if (copyToClipboard(id)) {
                copyButton.textContent = "Copied!";
                setTimeout(() => { copyButton.textContent = "Copy ID"; }, 2000);
            } else {
                copyButton.textContent = "Failed!";
            }
        });
        document.getElementById("modal-cancel-button").addEventListener("click", closeModal);
    }

    function showCreateCircleModal() {
        const modalHTML = `
            <form id="create-circle-form">
                <h3 class="text-xl font-semibold mb-6 text-text-primary">Create New Circle</h3>
                <div class="mb-4">
                    <label for="circle-name" class="block text-sm font-medium text-text-secondary mb-2">Circle Name</label>
                    <input type="text" id="circle-name" name="name" class="modal-input" required placeholder="e.g., DSA Grinders">
                </div>
                <div class="flex gap-4">
                    <button type="button" id="modal-cancel-button" class="modal-button-secondary">
                        Cancel
                    </button>
                    <button type="submit" id="modal-submit-button" class="modal-button-primary">
                        Create
                    </button>
                </div>
            </form>
        `;
        showModal(modalHTML);
        document.getElementById("create-circle-form").addEventListener("submit", handleCreateCircleSubmit);
        document.getElementById("modal-cancel-button").addEventListener("click", closeModal);
    }

    async function handleCreateCircleSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const circleName = form.name.value.trim();
        if (!circleName || !currentUserId) return;

        const submitButton = document.getElementById("modal-submit-button");
        submitButton.disabled = true;
        submitButton.textContent = "Creating...";

        try {
            // 1. Create the circle doc
            const circleRef = await addDoc(collection(db, "circles"), {
                name: circleName,
                owner: currentUserId,
                members: [currentUserId]
            });

            // 2. Add circle to user's profile
            const newCircleData = { id: circleRef.id, name: circleName };
            const userRef = doc(db, `users/${currentUserId}`);
            await updateDoc(userRef, {
                circles: arrayUnion(newCircleData)
            });

            // 3. Update local state and UI
            userCircles.push(newCircleData);
            handleSwitchCircle(circleRef.id);
            closeModal();
            
        } catch (error) {
            console.error("Error creating circle:", error);
            showMessageModal("Could not create circle.", "Error");
            submitButton.disabled = false;
            submitButton.textContent = "Create";
        }
    }

    function showJoinCircleModal() {
        const modalHTML = `
            <form id="join-circle-form">
                <h3 class="text-xl font-semibold mb-6 text-text-primary">Join a Circle</h3>
                <div class="mb-4">
                    <label for="circle-id" class="block text-sm font-medium text-text-secondary mb-2">Circle ID</label>
                    <input type="text" id="circle-id" name="id" class="modal-input" required placeholder="Paste Circle ID here">
                </div>
                <div class="flex gap-4">
                    <button type="button" id="modal-cancel-button" class="modal-button-secondary">
                        Cancel
                    </button>
                    <button type="submit" id="modal-submit-button" class="modal-button-primary">
                        Join
                    </button>
                </div>
            </form>
        `;
        showModal(modalHTML);
        document.getElementById("join-circle-form").addEventListener("submit", handleJoinCircleSubmit);
        document.getElementById("modal-cancel-button").addEventListener("click", closeModal);
    }
    
    async function handleJoinCircleSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const circleId = form.id.value.trim();
        if (!circleId || !currentUserId) return;

        if (userCircles.find(c => c.id === circleId)) {
            showMessageModal("You are already a member of this circle.", "Notice");
            return;
        }

        const submitButton = document.getElementById("modal-submit-button");
        submitButton.disabled = true;
        submitButton.textContent = "Joining...";

        try {
            const circleRef = doc(db, `circles/${circleId}`);
            const circleSnap = await getDoc(circleRef);

            if (!circleSnap.exists()) {
                throw new Error("Circle not found.");
            }

            const circleData = circleSnap.data();

            // 1. Add user to circle's member list
            await updateDoc(circleRef, {
                members: arrayUnion(currentUserId)
            });

            // 2. Add circle to user's profile
            const newCircleData = { id: circleId, name: circleData.name };
            const userRef = doc(db, `users/${currentUserId}`);
            await updateDoc(userRef, {
                circles: arrayUnion(newCircleData)
            });

            // 3. Update local state and UI
            userCircles.push(newCircleData);
            handleSwitchCircle(circleId);
            closeModal();

        } catch (error) {
            console.error("Error joining circle:", error);
            showMessageModal(`Could not join circle: ${error.message}`, "Error");
            submitButton.disabled = false;
            submitButton.textContent = "Join";
        }
    }

    // --- Member List & Accountability Functions ---
    async function loadCircleMembers() {
        if (!currentCircleId) return;
        
        circleMembersList.innerHTML = `<p class="text-sm text-text-muted">Loading members...</p>`;
        accountabilityStatusList.innerHTML = `<p class="text-sm text-text-muted">Loading status...</p>`; 

        try {
            const circleRef = doc(db, `circles/${currentCircleId}`);
            const circleSnap = await getDoc(circleRef);

            if (!circleSnap.exists()) {
                throw new Error("Circle data not found.");
            }
            
            const memberIds = circleSnap.data().members || [];
            if (memberIds.length === 0) {
                 circleMembersList.innerHTML = `<p class="text-sm text-text-muted">No members found.</p>`;
                 accountabilityStatusList.innerHTML = `<p class="text-sm text-text-muted">No members.</p>`; 
                 return;
            }

            // Fetch profile for each member
            const userQuery = query(collection(db, "users"), where("__name__", "in", memberIds));
            const userSnapshots = await getDocs(userQuery);
            
            const members = [];
            userSnapshots.forEach(doc => {
                const data = doc.data();
                members.push({
                    id: doc.id,
                    name: data.displayName || data.email.split('@')[0]
                });
            });

            renderCircleMembers(members);
            loadAccountabilityStatus(members); 

        } catch (error) {
            console.error("Error loading circle members:", error);
            circleMembersList.innerHTML = `<p class="text-red-500 text-sm">Error loading members.</p>`;
            accountabilityStatusList.innerHTML = `<p class="text-red-500 text-sm">Error loading status.</p>`; 
        }
    }

    function renderCircleMembers(members) {
        circleMembersList.innerHTML = "";
        members.forEach(member => {
            const isMe = member.id === currentUserId;
            const memberElement = document.createElement("button");
            memberElement.className = "animated-button w-full text-left bg-bg-card-secondary text-text-secondary font-medium py-2 px-3 rounded-lg hover:bg-bg-hover transition duration-300";
            memberElement.textContent = `${member.name} ${isMe ? "(You)" : ""}`;
            memberElement.dataset.memberId = member.id;
            memberElement.dataset.memberName = member.name;

            memberElement.addEventListener("click", () => {
                showMemberGoalsModal(member.id, member.name);
            });
            circleMembersList.appendChild(memberElement);
        });
    }

    async function loadAccountabilityStatus(members) {
        accountabilityStatusList.innerHTML = "";
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        let membersSafe = [];
        let membersMissed = [];

        try {
            const statusPromises = members.map(async (member) => {
                const feedRef = collection(db, `circles/${currentCircleId}/feed`);
                
                const q = query(
                    feedRef, 
                    where("userId", "==", member.id)
                );
                
                const postSnap = await getDocs(q);
                
                if (postSnap.empty) {
                    return { ...member, status: "missed" }; // Never posted
                } else {
                    let posts = [];
                    postSnap.forEach(doc => {
                        posts.push(doc.data());
                    });

                    posts.sort((a, b) => {
                        const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
                        const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
                        return timeB - timeA; // Newest first
                    });
                    
                    const lastPost = posts[0]; 
                    if (!lastPost.timestamp) {
                        return { ...member, status: "missed" };
                    }

                    const postTime = lastPost.timestamp.toDate();
                    if (postTime < oneDayAgo) {
                        return { ...member, status: "missed" }; // Posted, but not in last 24h
                    } else {
                        return { ...member, status: "safe" }; // Posted recently
                    }
                }
            });

            const memberStatuses = await Promise.all(statusPromises);

            memberStatuses.forEach(member => {
                if (member.status === 'safe') {
                    membersSafe.push(member);
                } else {
                    membersMissed.push(member);
                }
            });
            
            accountabilityStatusList.innerHTML = ""; // Clear "Loading..."

            // Render the lists
            if (membersSafe.length > 0) {
                const safeHeader = document.createElement('h4');
                safeHeader.className = "text-sm font-semibold text-status-safe-text mb-2";
                safeHeader.textContent = "Up-to-Date";
                accountabilityStatusList.appendChild(safeHeader);
                
                membersSafe.forEach(member => {
                    const el = document.createElement('div');
                    el.className = "status-item status-safe";
                    el.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                        </svg>
                        ${member.name}`;
                    accountabilityStatusList.appendChild(el);
                });
            }

            if (membersMissed.length > 0) {
                const missedHeader = document.createElement('h4');
                missedHeader.className = `text-sm font-semibold text-status-missed-text mb-2 ${membersSafe.length > 0 ? 'mt-4' : ''}`;
                missedHeader.textContent = "Missed Update";
                accountabilityStatusList.appendChild(missedHeader);

                membersMissed.forEach(member => {
                    const el = document.createElement('div');
                    el.className = "status-item status-missed";
                    el.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                        </svg>
                        ${member.name}`;
                    accountabilityStatusList.appendChild(el);
                });
            }
            
            if (membersSafe.length === 0 && membersMissed.length === 0) {
                 accountabilityStatusList.innerHTML = `<p class="text-sm text-text-muted">No members in this circle.</p>`;
            }

        } catch (error) {
            console.error("Error loading accountability status:", error);
            accountabilityStatusList.innerHTML = `<p class="text-red-500 text-sm">Error loading status.</p>`;
        }
    }

    async function showMemberGoalsModal(memberId, memberName) {
        const modalHTML = `
            <h3 class="text-xl font-semibold mb-4 text-text-primary">Goals for ${memberName}</h3>
            <div id="member-goals-list" class="space-y-3 max-h-60 overflow-y-auto pr-2">
                <p class="text-text-muted">Loading goals...</p>
            </div>
            <button id="modal-close-button" class="animated-button mt-6 w-full bg-accent-primary text-accent-primary-text font-semibold py-2 px-4 rounded-lg hover:bg-accent-primary-hover transition duration-300">
                Close
            </button>
        `;
        showModal(modalHTML);
        document.getElementById("modal-close-button").addEventListener("click", closeModal);

        const memberGoalsList = document.getElementById("member-goals-list");
        try {
            const goalsRef = collection(db, `users/${memberId}/goals`);
            const goalsSnap = await getDocs(goalsRef);

            if (goalsSnap.empty) {
                memberGoalsList.innerHTML = `<p class="text-text-muted">${memberName} hasn't added any goals yet.</p>`;
                return;
            }
            
            memberGoalsList.innerHTML = ""; // Clear loading
            goalsSnap.forEach(doc => {
                const goal = doc.data();
                const current = Number(goal.current);
                const total = Number(goal.total);
                const percentage = total > 0 ? (current / total) * 100 : 0;
                
                let progressBarColor = "progress-bar-cyan";
                if (percentage >= 100) progressBarColor = "progress-bar-green";
                else if (percentage >= 50) progressBarColor = "progress-bar-yellow";

                const goalElement = document.createElement("div");
                goalElement.className = "bg-bg-card-secondary p-3 rounded-lg";
                goalElement.innerHTML = `
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-text-secondary">${goal.title}</span>
                        <span class="text-text-muted">${current} / ${total}</span>
                    </div>
                    <div class="progress-bar-bg mt-2">
                        <div class="progress-bar-fill ${progressBarColor}" style="width: ${percentage}%"></div>
                    </div>
                `;
                memberGoalsList.appendChild(goalElement);
            });

        } catch (error) {
            console.error("Error fetching member goals:", error);
            memberGoalsList.innerHTML = `<p class="text-red-500">Could not load goals.</p>`;
        }
    }

    // --- Goal CRUD Functions ---
    function loadUserGoals(userId) {
        if (goalsUnsubscribe) {
            goalsUnsubscribe();
        }
        
        const goalsRef = collection(db, `users/${userId}/goals`);
        
        goalsUnsubscribe = onSnapshot(goalsRef, (snapshot) => {
            userGoals = [];
            snapshot.forEach((doc) => {
                userGoals.push({ id: doc.id, ...doc.data() });
            });
            renderGoals(userGoals);
        }, (error) => {
            console.error("Error loading goals:", error);
            showMessageModal("Could not load your goals. Please try again.", "Error");
        });
    }

    function renderGoals(goals) {
        goalsList.innerHTML = "";
        
        if (goals.length === 0) {
            goalsList.innerHTML = `<p class="text-sm text-text-muted">You haven't added any goals yet. Click the "+" button to get started.</p>`;
            return;
        }
        
        goals.forEach(goal => {
            const current = Number(goal.current);
            const total = Number(goal.total);
            const percentage = total > 0 ? (current / total) * 100 : 0;
            const isComplete = current >= total;
            
            let progressBarColor = "progress-bar-cyan";
            if (percentage >= 100) progressBarColor = "progress-bar-green";
            else if (percentage >= 75) progressBarColor = "progress-bar-cyan";
            else if (percentage >= 50) progressBarColor = "progress-bar-yellow";
            else if (percentage >= 25) progressBarColor = "progress-bar-orange";

            const goalElement = document.createElement("div");
            goalElement.className = "bg-bg-card-secondary p-4 rounded-xl border border-border-color";
            
            // "The Locker": Show "Archive" or "Delete" button
            const actionButtonHTML = isComplete
                ? `<button data-id="${goal.id}" class="archive-goal-button text-xs text-green-600 hover:text-green-700 font-medium mt-2">Archive</button>`
                : `<button data-id="${goal.id}" class="delete-goal-button text-xs text-red-500 hover:text-red-700 font-medium mt-2">Delete</button>`;

            goalElement.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-semibold text-text-primary">${goal.title}</span>
                    <span class="text-sm font-medium text-text-muted">${current} / ${total}</span>
                </div>
                <div class="progress-bar-bg mt-2">
                    <div class="progress-bar-fill ${progressBarColor}" style="width: ${percentage}%"></div>
                </div>
                ${actionButtonHTML}
            `;
            goalsList.appendChild(goalElement);
        });
        
        document.querySelectorAll('.delete-goal-button').forEach(button => {
            button.addEventListener('click', () => handleDeleteGoal(button.dataset.id));
        });
        // "The Locker": Add listener for archive buttons
        document.querySelectorAll('.archive-goal-button').forEach(button => {
            button.addEventListener('click', () => handleArchiveGoal(button.dataset.id));
        });
    }

    async function handleDeleteGoal(goalId) {
        if (!currentUserId || !goalId) return;
        
        try {
            const goalRef = doc(db, `users/${currentUserId}/goals`, goalId);
            await deleteDoc(goalRef);
        } catch (error) {
            console.error("Error deleting goal:", error);
            showMessageModal(`Could not delete goal: ${error.message}`, "Error");
        }
    }

    // "The Locker" - Archive Goal Function
    async function handleArchiveGoal(goalId) {
        if (!currentUserId || !goalId) return;

        const goalRef = doc(db, `users/${currentUserId}/goals`, goalId);
        const archiveRef = doc(db, `users/${currentUserId}/archived_goals`, goalId);
        
        try {
            // Use a transaction to safely move the doc
            await runTransaction(db, async (transaction) => {
                const goalSnap = await transaction.get(goalRef);
                if (!goalSnap.exists()) {
                    throw "Goal does not exist!";
                }
                const goalData = goalSnap.data();
                
                // 1. Create the new archived doc
                transaction.set(archiveRef, { ...goalData, archivedAt: serverTimestamp() });
                // 2. Delete the old active doc
                transaction.delete(goalRef);
            });
            showMessageModal("Goal archived! View it in 'The Locker'.", "Success");
        } catch (error) {
            console.error("Error archiving goal:", error);
            showMessageModal(`Could not archive goal: ${error.message}`, "Error");
        }
    }

    // "The Locker" - Show Archive Modal Function
    async function showArchivedGoalsModal() {
        const modalHTML = `
            <h3 class="text-xl font-semibold mb-4 text-text-primary">Archived Goals (The Locker)</h3>
            <div id="archived-goals-list" class="space-y-3 max-h-60 overflow-y-auto pr-2">
                <p class="text-text-muted">Loading archived goals...</p>
            </div>
            <button id="modal-close-button" class="animated-button mt-6 w-full bg-accent-primary text-accent-primary-text font-semibold py-2 px-4 rounded-lg hover:bg-accent-primary-hover transition duration-300">
                Close
            </button>
        `;
        showModal(modalHTML);
        document.getElementById("modal-close-button").addEventListener("click", closeModal);

        const archivedList = document.getElementById("archived-goals-list");
        try {
            const goalsRef = collection(db, `users/${currentUserId}/archived_goals`);
            const goalsSnap = await getDocs(query(goalsRef, orderBy("archivedAt", "desc")));

            if (goalsSnap.empty) {
                archivedList.innerHTML = `<p class="text-text-muted">You have no archived goals.</p>`;
                return;
            }
            
            archivedList.innerHTML = ""; // Clear loading
            goalsSnap.forEach(doc => {
                const goal = doc.data();
                const goalElement = document.createElement("div");
                goalElement.className = "bg-bg-card-secondary p-3 rounded-lg";
                goalElement.innerHTML = `
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-text-secondary">${goal.title}</span>
                        <span class="text-sm text-text-muted">${goal.current} / ${goal.total}</span>
                    </div>
                `;
                archivedList.appendChild(goalElement);
            });

        } catch (error) {
            console.error("Error fetching archived goals:", error);
            archivedList.innerHTML = `<p class="text-red-500">Could not load archived goals.</p>`;
        }
    }


    function showAddGoalModal() {
        const modalHTML = `
            <form id="add-goal-form">
                <h3 class="text-xl font-semibold mb-6 text-text-primary">Add New Goal</h3>
                <div class="mb-4">
                    <label for="goal-title" class="block text-sm font-medium text-text-secondary mb-2">Goal Title</label>
                    <input type="text" id="goal-title" name="title" class="modal-input" required placeholder="e.g., Leetcode Questions">
                </div>
                <div class="flex gap-4 mb-6">
                    <div class="w-1/2">
                        <label for="goal-current" class="block text-sm font-medium text-text-secondary mb-2">Current</label>
                        <input type="number" id="goal-current" name="current" class="modal-input" required value="0" min="0">
                    </div>
                    <div class="w-1/2">
                        <label for="goal-total" class="block text-sm font-medium text-text-secondary mb-2">Total</LAbel>
                        <input type="number" id="goal-total" name="total" class="modal-input" required placeholder="e.g., 150" min="1">
                    </div>
                </div>
                <div class="flex gap-4">
                    <button type="button" id="modal-cancel-button" class="modal-button-secondary">
                        Cancel
                    </button>
                    <button type="submit" id="modal-submit-button" class="modal-button-primary">
                        Add Goal
                    </button>
                </div>
            </form>
        `;
        showModal(modalHTML);
        document.getElementById("add-goal-form").addEventListener("submit", handleAddGoalSubmit);
        document.getElementById("modal-cancel-button").addEventListener("click", closeModal);
    }

    async function handleAddGoalSubmit(event) {
        event.preventDefault();
        if (!currentUserId) return;

        const form = event.target;
        const title = form.title.value.trim();
        const current = Number(form.current.value);
        const total = Number(form.total.value);
        
        if (!title || total <= 0 || current < 0 || current > total) {
            showMessageModal("Please fill in all fields with valid values. 'Current' cannot be greater than 'Total'.", "Invalid Input");
            return;
        }
        
        const submitButton = document.getElementById("modal-submit-button");
        submitButton.disabled = true;
        submitButton.textContent = "Adding...";
        
        try {
            const goalsRef = collection(db, `users/${currentUserId}/goals`);
            await addDoc(goalsRef, {
                title: title,
                current: current,
                total: total,
                createdAt: serverTimestamp() // Use serverTimestamp
            });
            closeModal();
        } catch (error) {
            console.error("Error adding goal:", error);
            showMessageModal(`Could not add goal: ${error.message}`, "Error");
        }
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            if (file.size > 1_000_000) {
                reject(new Error("File is too large. Max 1MB."));
                return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    function handleImagePreview(event) {
        const file = event.target.files[0];
        const preview = document.getElementById("image-preview");
        const previewContainer = document.getElementById("image-preview-container");

        if (file) {
            if (file.size > 1_000_000) {
                showMessageModal("File is too large. Max 1MB.", "Image Error");
                event.target.value = null; 
                previewContainer.classList.add("hidden");
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                preview.src = e.target.result;
                previewContainer.classList.remove("hidden");
            }
            reader.readAsDataURL(file);
        } else {
            preview.src = "#";
            previewContainer.classList.add("hidden");
        }
    }

    // --- "The Thread" (Stats) Functions ---
    // Helper to get YYYY-MM-DD format
    function getDateString(date) {
        return date.toISOString().split('T')[0];
    }
    
    async function showStatsModal() {
        const modalHTML = `
            <h3 class="text-xl font-semibold mb-4 text-text-primary">Contribution Heatmap</h3>
            <p class="text-sm text-text-secondary mb-4">Your check-ins from the past year. (This will fill up as you post)</p>
            <div id="heatmap-loading" class="text-text-muted">Loading heatmap...</div>
            <div id="heatmap-container" class="heatmap-container hidden">
                <div id="heatmap-grid" class="heatmap-grid"></div>
                <div class="heatmap-legend">
                    <span class="mr-2">Less</span>
                    <div class="heatmap-legend-box" style="background-color: var(--heatmap-level-0)"></div>
                    <div class="heatmap-legend-box" style="background-color: var(--heatmap-level-1)"></div>
                    <div class="heatmap-legend-box" style="background-color: var(--heatmap-level-2)"></div>
                    <div class="heatmap-legend-box" style="background-color: var(--heatmap-level-3)"></div>
                    <div class="heatmap-legend-box" style="background-color: var(--heatmap-level-4)"></div>
                    <span class="ml-2">More</span>
                </div>
            </div>
            <button id="modal-close-button" class="animated-button mt-6 w-full bg-accent-primary text-accent-primary-text font-semibold py-2 px-4 rounded-lg hover:bg-accent-primary-hover transition duration-300">
                Close
            </button>
        `;
        showModal(modalHTML);
        document.getElementById("modal-close-button").addEventListener("click", closeModal);

        try {
            // 1. Fetch all check-in receipts
            const checkInsRef = collection(db, `users/${currentUserId}/check_ins`);
            const checkInsSnap = await getDocs(checkInsRef);
            
            const checkInData = new Map();
            checkInsSnap.forEach(doc => {
                // doc.id is the dateString "YYYY-MM-DD"
                checkInData.set(doc.id, doc.data().count);
            });
            
            // 2. Render the heatmap
            renderHeatmap(checkInData);
            document.getElementById("heatmap-loading").classList.add("hidden");
            document.getElementById("heatmap-container").classList.remove("hidden");

        } catch (error) {
            console.error("Error loading heatmap data:", error);
            document.getElementById("heatmap-loading").textContent = "Error loading heatmap.";
        }
    }

    function renderHeatmap(checkInData) {
        const grid = document.getElementById("heatmap-grid");
        grid.innerHTML = ""; // Clear
        
        const today = new Date();
        const daysToShow = 371; // 53 weeks * 7 days
        let date = new Date();
        date.setDate(today.getDate() - (daysToShow - 1));

        // Add blank days at the start to align the first day
        const startDayOfWeek = date.getDay(); // 0 (Sun) - 6 (Sat)
        for (let i = 0; i < startDayOfWeek; i++) {
            const blankDay = document.createElement("div");
            blankDay.className = "heatmap-day";
            blankDay.style.opacity = 0; // Make it invisible
            grid.appendChild(blankDay);
        }
        
        // Loop through and render each day
        for (let i = 0; i < daysToShow; i++) {
            const dateString = getDateString(date);
            const count = checkInData.get(dateString) || 0;
            
            let level = 0;
            if (count > 0) level = 1;
            if (count > 2) level = 2;
            if (count > 4) level = 3;
            if (count > 6) level = 4;
            
            const dayElement = document.createElement("div");
            dayElement.className = `heatmap-day ${count > 0 ? `level-${level}` : ''}`;
            dayElement.title = `${count} check-in${count === 1 ? '' : 's'} on ${dateString}`;
            
            grid.appendChild(dayElement);
            date.setDate(date.getDate() + 1);
        }
    }


    // --- Check-In Functions ---
    function showCheckInModal() {
        if (!currentCircleId) { 
            showMessageModal("You must create or join a circle before you can check-in.", "No Circle Found");
            return;
        }
        if (userGoals.length === 0) {
            showMessageModal("You must add a goal before you can check-in.", "No Goals Found");
            return;
        }
        
        const goalOptions = userGoals.map(goal => {
            return `<option value="${goal.id}">${goal.title} (${goal.current}/${goal.total})</option>`;
        }).join('');

        const modalHTML = `
            <form id="check-in-form">
                <h3 class="text-xl font-semibold mb-6 text-text-primary">Submit Daily Update</h3>
                
                <div class="mb-4">
                    <label for="checkin-goal-select" class="block text-sm font-medium text-text-secondary mb-2">Which goal did you work on?</label>
                    <select id="checkin-goal-select" name="goalId" class="modal-input" required>
                        ${goalOptions}
                    </select>
                </div>
                
                <div class="mb-4">
                    <label for="checkin-new-value" class="block text-sm font-medium text-text-secondary mb-2">What is your new 'current' value?</label>
                    <input type="number" id="checkin-new-value" name="newValue" class="modal-input" required min="0">
                </div>

                <div class="mb-6">
                    <label for="checkin-notes" class="block text-sm font-medium text-text-secondary mb-2">What did you do?</label>
                    <textarea id="checkin-notes" name="notes" class="modal-input" rows="3" placeholder="e.g., 'Finished 2 DSA problems and reviewed graph concepts...'" required></textarea>
                </div>

                <div class="mb-4">
                    <label for="checkin-image" class="block text-sm font-medium text-text-secondary mb-2">Add a Screenshot (Max 1MB)</label>
                    <input type="file" id="checkin-image" name="image" class="w-full text-sm text-text-muted" accept="image/*">
                    <div id="image-preview-container" class="mt-2 hidden">
                        <img id="image-preview" src="#" alt="Image preview" class="max-h-32 rounded-lg border-2 border-border-color">
                    </div>
                </div>
                
                <p class="text-xs text-text-muted mb-4">Audio recording feature skipped.</p>

                <div class="flex gap-4">
                    <button type="button" id="modal-cancel-button" class="modal-button-secondary">
                        Cancel
                    </button>
                    <button type="submit" id="modal-submit-button" class="modal-button-primary">
                        Submit Update
                    </button>
                </div>
            </form>
        `;
        showModal(modalHTML);

        document.getElementById("checkin-image").addEventListener("change", handleImagePreview);
        document.getElementById("check-in-form").addEventListener("submit", handleCheckInSubmit);
        document.getElementById("modal-cancel-button").addEventListener("click", closeModal);
    }

    async function handleCheckInSubmit(event) {
        event.preventDefault();
        if (!currentUserId || !currentCircleId) return; 

        const form = event.target;
        const goalId = form.goalId.value;
        const newValue = Number(form.newValue.value);
        const notes = form.notes.value.trim();
        const imageFile = form.image.files[0];
        
        const selectedGoal = userGoals.find(g => g.id === goalId);
        if (!selectedGoal) {
            showMessageModal("Invalid goal selected.", "Error");
            return;
        }
        
        if (notes.length === 0) {
            showMessageModal("Please add some notes for your update.", "Invalid Input");
            return;
        }
        
        if (newValue < selectedGoal.current || newValue > selectedGoal.total) {
            showMessageModal(`New value must be between ${selectedGoal.current} and ${selectedGoal.total}.`, "Invalid Input");
            return;
        }
        
        const submitButton = document.getElementById("modal-submit-button");
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";

        let imageURL = null;

        try {
            if (imageFile) {
                submitButton.textContent = "Processing image...";
                try {
                    imageURL = await fileToBase64(imageFile);
                } catch (error) {
                    showMessageModal(error.message, "Image Error");
                    submitButton.disabled = false;
                    submitButton.textContent = "Submit Update";
                    return;
                }
            }
            
            submitButton.textContent = "Saving update...";

            // Use a batch write to update goal and add feed post
            const batch = writeBatch(db);

            const goalRef = doc(db, `users/${currentUserId}/goals`, goalId);
            batch.update(goalRef, {
                current: newValue
            });
            
            const feedRef = doc(collection(db, `circles/${currentCircleId}/feed`));
            batch.set(feedRef, {
                userId: currentUserId,
                userName: userDisplayName, 
                userEmail: userEmail,
                goalTitle: selectedGoal.title,
                updateText: `updated ${selectedGoal.title} to ${newValue}/${selectedGoal.total}`,
                notes: notes,
                timestamp: serverTimestamp(), 
                audioURL: null,
                imageURL: imageURL,
                reactions: {} 
            });

            await batch.commit();

            // NEW: "The Thread" - Write a private receipt for the heatmap
            const dateString = getDateString(new Date());
            const checkInRef = doc(db, `users/${currentUserId}/check_ins`, dateString);
            
            try {
                await runTransaction(db, async (transaction) => {
                    const checkInSnap = await transaction.get(checkInRef);
                    let newCount = 1;
                    if (checkInSnap.exists()) {
                        newCount = checkInSnap.data().count + 1;
                    }
                    // Use set with merge to create or update
                    transaction.set(checkInRef, { 
                        count: newCount, 
                        lastCheckIn: serverTimestamp() 
                    }, { merge: true });
                });
            } catch (receiptError) {
                console.error("Error writing check-in receipt:", receiptError);
                // Don't fail the whole operation, just log it.
            }
            
            closeModal();
            showMessageModal("Your update has been posted to the circle feed!", "Success");
            
            // Re-load accountability status after posting
            loadCircleMembers(); 

        } catch (error) {
            console.error("Error submitting check-in:", error);
            showMessageModal(`Could not submit update: ${error.message}`, "Error");
        }
    }

    // --- Feed Functions ---
    function loadCircleFeed() {
        if (feedUnsubscribe) {
            feedUnsubscribe();
        }
        
        if (!currentCircleId) {
            feedList.innerHTML = `<p class="text-sm text-text-muted">Select a circle to see the feed.</p>`;
            return;
        }

        console.log("Loading feed for circle:", currentCircleId);
        const feedRef = collection(db, `circles/${currentCircleId}/feed`);
        
        feedUnsubscribe = onSnapshot(feedRef, (snapshot) => {
            let feedItems = [];
            snapshot.forEach((doc) => {
                feedItems.push({ id: doc.id, ...doc.data() });
            });
            
            // Sort in JS to avoid composite indexes
            feedItems.sort((a, b) => {
                const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
                const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
                return timeB - timeA; // Newest first
            });

            renderFeed(feedItems);
        }, (error) => {
            console.error("Error loading circle feed:", error);
            showMessageModal("Could not load the circle feed.", "Error");
        });
    }

    function renderFeed(feedItems) {
        feedList.innerHTML = "";
        
        if (feedItems.length === 0) {
            feedList.innerHTML = `<p class="text-sm text-text-muted">The feed is empty. Be the first to post an update!</p>`;
            return;
        }
        
        const availableReactions = ['👍', '🔥', '🎉'];

        feedItems.forEach(item => {
            const postElement = document.createElement("div");
            postElement.className = "bg-bg-card-secondary p-4 rounded-xl border border-border-color";
            
            const time = item.timestamp ? new Date(item.timestamp.toMillis()).toLocaleString() : "just now";
            const name = item.userName || item.userEmail.split('@')[0];
            
            let mediaHTML = '';
            if (item.imageURL) {
                mediaHTML = `
                    <div class="mt-3">
                        <img src="${item.imageURL}" alt="User screenshot" class="max-h-60 w-auto rounded-lg border-2 border-border-color cursor-pointer transition duration-300 hover:shadow-md" data-img-src="${item.imageURL}">
                    </div>
                `;
            }

            // Build reactions HTML
            let reactionsHTML = '<div class="flex gap-2 mt-4">';
            const reactions = item.reactions || {};
            
            availableReactions.forEach(emoji => {
                const reactionData = reactions[emoji] || { count: 0, reactors: [] };
                const count = reactionData.count;
                const userHasReacted = reactionData.reactors.includes(currentUserId);
                
                reactionsHTML += `
                    <button class="reaction-button ${userHasReacted ? 'reaction-button-active' : ''}" data-post-id="${item.id}" data-emoji="${emoji}">
                        ${emoji} <span class="ml-1 text-xs">${count}</span>
                    </button>
                `;
            });
            reactionsHTML += '</div>';

            postElement.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm font-semibold text-text-primary">${name}</span>
                    <span class="text-xs text-text-muted">${time}</span>
                </div>
                <p class="text-text-secondary mb-2"><strong class="font-medium text-accent-primary">${item.updateText}</strong></sP>
                <p class="text-text-secondary text-sm bg-bg-base p-3 rounded-md">${item.notes}</p>
                ${mediaHTML}
                ${reactionsHTML} <!-- Add reactions bar -->
            `;
            feedList.appendChild(postElement);
        });

        // Add click listener for image zoom
        feedList.querySelectorAll('img[data-img-src]').forEach(img => {
            img.addEventListener('click', () => {
                showModal(`
                    <img src="${img.dataset.imgSrc}" alt="Enlarged screenshot" class="max-w-full max-h-[80vh] w-auto h-auto rounded-lg mx-auto">
                `);
            });
        });

        // Add click listeners for reaction buttons
        feedList.querySelectorAll('.reaction-button').forEach(button => {
            button.addEventListener('click', () => {
                const postId = button.dataset.postId;
                const emoji = button.dataset.emoji;
                handleReactionClick(postId, emoji);
            });
        });
    }

    async function handleReactionClick(postId, emoji) {
        if (!currentUserId || !currentCircleId) return;

        const postRef = doc(db, `circles/${currentCircleId}/feed`, postId);

        try {
            await runTransaction(db, async (transaction) => {
                const postSnap = await transaction.get(postRef);
                if (!postSnap.exists()) {
                    throw "Post does not exist!";
                }

                const postData = postSnap.data();
                const reactions = postData.reactions || {};
                
                if (!reactions[emoji]) {
                    reactions[emoji] = { count: 0, reactors: [] };
                }
                
                const reactionData = reactions[emoji];
                const userHasReacted = reactionData.reactors.includes(currentUserId);

                if (userHasReacted) {
                    // User is removing their reaction
                    reactionData.count = Math.max(0, reactionData.count - 1);
                    transaction.update(postRef, {
                        [`reactions.${emoji}.count`]: reactionData.count,
                        [`reactions.${emoji}.reactors`]: arrayRemove(currentUserId)
                    });
                } else {
                    // User is adding their reaction
                    reactionData.count += 1;
                    transaction.update(postRef, {
                        [`reactions.${emoji}.count`]: reactionData.count,
                        [`reactions.${emoji}.reactors`]: arrayUnion(currentUserId)
                    });
                }
            });
            console.log("Reaction updated successfully!");
        } catch (error) {
            console.error("Error updating reaction: ", error);
            showMessageModal("Could not add reaction. Please try again.", "Error");
        }
    }


    // --- Global Event Listeners ---
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    loginButton.addEventListener("click", async () => {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            console.log("Sign-in successful:", result.user.uid);
        } catch (error) {
            console.error("Error during sign-in:", error.code, error.message);
            
            if (error.code === 'auth/unauthorized-domain') {
                const currentDomain = location.hostname;
                showMessageModal(
                    `Firebase is blocking this app's domain. You must add this domain to your Firebase project's "Authorized domains" list.<br><br><strong class="text-text-primary">Domain to add:</strong><br><code class="bg-bg-card-secondary text-accent-primary px-2 py-1 rounded-md block mt-2">${currentDomain}</code><br><pre>How to fix:\n1. Go to your Firebase Console\n2. Go to Authentication > Settings\n3. Click 'Authorized domains'\n4. Click 'Add domain' and paste the code above.</pre>`, 
                    "Sign-In Failed (Action Required)"
                );
            } else {
                showMessageModal(`Error signing in: ${error.message}`, "Sign-In Failed");
            }
        }
    });

    logoutButton.addEventListener("click", async () => {
        try {
            await signOut(auth);
            console.log("Sign-out successful.");
        } catch (error) {
            console.error("Error during sign-out:", error);
            showMessageModal(`Error signing out: ${error.message}`, "Sign-Out Failed");
        }
    });

    // Attach all top-level button listeners
    addGoalButton.addEventListener("click", showAddGoalModal);
    checkInButton.addEventListener("click", showCheckInModal);
    createCircleButton.addEventListener("click", showCreateCircleModal);
    joinCircleButton.addEventListener("click", showJoinCircleModal);
    editAliasButton.addEventListener("click", showAliasModal);
    
    // NEW: Deadline Countdown Listener
    editDeadlineButton.addEventListener("click", async () => {
        if (!currentUserId) return; // Add guard clause
        const userRef = doc(db, `users/${currentUserId}`);
        const userSnap = await getDoc(userRef);
        const deadline = userSnap.data()?.deadline ? userSnap.data().deadline.toDate() : null;
        showDeadlineModal(deadline);
    });

    // "The Locker" Listener
    viewArchiveButton.addEventListener("click", showArchivedGoalsModal);
    
    // "Carcosa" Focus Mode Listener
    focusModeButton.addEventListener("click", () => {
        document.body.classList.toggle('focus-mode-active');
    });

    // "The Thread" (Stats) Listener
    viewStatsButton.addEventListener("click", showStatsModal);

    // Attach Pomodoro Listeners
    pomodoroButton.addEventListener("click", () => setTimer('pomodoro'));
    shortBreakButton.addEventListener("click", () => setTimer('short'));
    longBreakButton.addEventListener("click", () => setTimer('long'));
    startTimerButton.addEventListener("click", startStopTimer);
    resetTimerButton.addEventListener("click", resetTimer);
    timerSettingsButton.addEventListener("click", showTimerSettingsModal);

    // Attach YouTube Player Listener
    ytLoadButton.addEventListener("click", handleLoadYoutubeVideo);

    // Attach Theme Selector Listener
    themeSelector.addEventListener('change', (e) => {
        setTheme(e.target.value);
    });

    // --- INIT ---
    // Set initial theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'theme-light';
    setTheme(savedTheme);
    
    // Load saved timer settings from localStorage
    const savedTimerSettings = localStorage.getItem('timerSettings');
    if (savedTimerSettings) {
        timerSettings = JSON.parse(savedTimerSettings);
    }
    // Set initial timer state
    setTimer('pomodoro');
    
    // Set initial cat quote
    if (catQuoteDisplay) {
        const quote = catQuotes[Math.floor(Math.random() * catQuotes.length)];
        catQuoteDisplay.textContent = `"${quote}"`;
    }

    // Final check
    if (!auth) {
        showMessageModal("Firebase is not initialized. The app cannot start.", "Fatal Error");
    }

});

