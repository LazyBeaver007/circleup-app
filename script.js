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
    serverTimestamp,
    query,
    getDoc,
    setDoc,
    arrayUnion,
    getDocs,
    where,
    orderBy,
    limit
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

let app, auth, db, analytics;
let currentUserId = null;
let userEmail = null;
let userDisplayName = null;
let goalsUnsubscribe = null;
let feedUnsubscribe = null;
let userGoals = [];
let userCircles = []; 
let currentCircleId = null; 

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
    const myUserIdElement = document.getElementById("my-user-id");
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
    const accountabilityStatusList = document.getElementById("accountability-status-list"); // NEW

    // --- Modal & Utility Functions ---
    function showModal(contentHTML) {
        modalContent.innerHTML = contentHTML;
        modal.classList.remove("hidden");
    }

    function closeModal() {
        modal.classList.add("hidden");
        modalContent.innerHTML = "";
    }

    function showMessageModal(message, title = "Notification") {
        const modalHTML = `
            <h3 class="text-xl font-semibold mb-4">${title}</h3>
            <p class="text-gray-300 mb-6">${message}</p>
            <button id="modal-close-button" class="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300">
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
            myUserIdElement.textContent = currentUserId;
            
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
            myUserIdElement.textContent = "Not logged in";

            dashboardView.classList.add("hidden");
            dashboardView.classList.remove("flex");
            loginView.classList.remove("hidden");
            loginView.classList.add("flex");
            
            // Clean up listeners
            if (goalsUnsubscribe) goalsUnsubscribe();
            if (feedUnsubscribe) feedUnsubscribe();
            
            goalsList.innerHTML = "";
            feedList.innerHTML = "";
            circlesList.innerHTML = "";
            circleMembersList.innerHTML = "";
            accountabilityStatusList.innerHTML = ""; // NEW
            userGoals = [];
            userCircles = [];
        }
    });

    // --- User Profile & Circle Management ---
    async function loadUserProfile(user) {
        const userRef = doc(db, `users/${user.uid}`);
        const userSnap = await getDoc(userRef);

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
                    circles: [personalCircleData]
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
            
            if (userCircles.length > 0) {
                currentCircleId = userCircles[0].id; 
            } else {
                currentCircleId = null; 
            }
        }
        
        userDisplayNameElement.textContent = userDisplayName;
        renderCircleList();
        
        if (currentCircleId) {
            loadCircleFeed();
            loadCircleMembers(); 
        } else {
            feedList.innerHTML = `<p class="text-gray-400 text-sm">Join or create a circle to see a feed.</p>`;
            circleMembersList.innerHTML = `<p class="text-gray-400 text-sm">No circle selected.</p>`;
            accountabilityStatusList.innerHTML = `<p class="text-gray-400 text-sm">Select a circle.</p>`;
        }
    }

    function showAliasModal() {
        const modalHTML = `
            <form id="alias-form">
                <h3 class="text-xl font-semibold mb-6">Set Your Alias</h3>
                <div class="mb-4">
                    <label for="display-name" class="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
                    <input type="text" id="display-name" name="name" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" required value="${userDisplayName || ''}">
                </div>
                <div class="flex gap-4">
                    <button type="button" id="modal-cancel-button" class="w-1/2 bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition duration-300">
                        Cancel
                    </button>
                    <button type="submit" id="modal-submit-button" class="w-1/2 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300">
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
            circlesList.innerHTML = `<p class="text-gray-400 text-sm">You are not in any circles.</p>`;
            return;
        }

        userCircles.forEach(circle => {
            const isActive = circle.id === currentCircleId;
            const buttonClass = isActive
                ? "bg-indigo-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600";
            
            const circleElement = document.createElement("div");
            circleElement.className = "flex items-center gap-2";

            const circleButton = document.createElement("button");
            circleButton.className = `flex-1 text-left font-semibold py-2 px-4 rounded-lg transition duration-300 ${buttonClass}`;
            circleButton.textContent = circle.name;
            circleButton.dataset.circleId = circle.id;
            circleButton.addEventListener("click", () => handleSwitchCircle(circle.id));
            
            const infoButton = document.createElement("button");
            infoButton.className = "show-circle-id-button flex-shrink-0 bg-gray-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-gray-500 transition duration-300";
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
        renderCircleList(); 
        loadCircleFeed(); 
        loadCircleMembers();
    }

    function showCircleInfoModal(id, name) {
        const modalHTML = `
            <h3 class="text-xl font-semibold mb-4">Circle Info: ${name}</h3>
            <p class="text-sm text-gray-300 mb-2">Share this ID with friends so they can join this circle:</p>
            <input type="text" readonly id="circle-id-share" value="${id}" class="w-full bg-gray-900 border border-gray-700 text-indigo-300 rounded-lg px-3 py-2 select-all mb-4">
            <div class="flex gap-4">
                <button type="button" id="modal-cancel-button" class="w-1/2 bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition duration-300">
                    Close
                </button>
                <button type="button" id="copy-circle-id-button" class="w-1/2 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300">
                    Copy ID
                </button>
            </div>
        `;
        showModal(modalHTML);

        document.getElementById("modal-cancel-button").addEventListener("click", closeModal);
        
        const copyButton = document.getElementById("copy-circle-id-button");
        copyButton.addEventListener("click", () => {
            if (copyToClipboard(id)) {
                copyButton.textContent = "Copied!";
                setTimeout(() => { copyButton.textContent = "Copy ID"; }, 2000);
            } else {
                copyButton.textContent = "Failed!";
            }
        });
    }

    function showCreateCircleModal() {
        const modalHTML = `
            <form id="create-circle-form">
                <h3 class="text-xl font-semibold mb-6">Create New Circle</h3>
                <div class="mb-4">
                    <label for="circle-name" class="block text-sm font-medium text-gray-300 mb-2">Circle Name</label>
                    <input type="text" id="circle-name" name="name" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="e.g., DSA Grinders">
                </div>
                <div class="flex gap-4">
                    <button type="button" id="modal-cancel-button" class="w-1/2 bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition duration-300">
                        Cancel
                    </button>
                    <button type="submit" id="modal-submit-button" class="w-1/2 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300">
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
                <h3 class="text-xl font-semibold mb-6">Join a Circle</h3>
                <div class="mb-4">
                    <label for="circle-id" class="block text-sm font-medium text-gray-300 mb-2">Circle ID</label>
                    <input type="text" id="circle-id" name="id" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="Paste Circle ID here">
                </div>
                <div class="flex gap-4">
                    <button type="button" id="modal-cancel-button" class="w-1/2 bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition duration-300">
                        Cancel
                    </button>
                    <button type="submit" id="modal-submit-button" class="w-1/2 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300">
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
        
        circleMembersList.innerHTML = `<p class="text-gray-400 text-sm">Loading members...</p>`;
        accountabilityStatusList.innerHTML = `<p class="text-gray-400 text-sm">Loading status...</p>`; // NEW

        try {
            const circleRef = doc(db, `circles/${currentCircleId}`);
            const circleSnap = await getDoc(circleRef);

            if (!circleSnap.exists()) {
                throw new Error("Circle data not found.");
            }
            
            const memberIds = circleSnap.data().members || [];
            if (memberIds.length === 0) {
                 circleMembersList.innerHTML = `<p class="text-gray-400 text-sm">No members found.</p>`;
                 accountabilityStatusList.innerHTML = `<p class="text-gray-400 text-sm">No members.</p>`; // NEW
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
            loadAccountabilityStatus(members); // NEW

        } catch (error) {
            console.error("Error loading circle members:", error);
            circleMembersList.innerHTML = `<p class="text-red-400 text-sm">Error loading members.</p>`;
            accountabilityStatusList.innerHTML = `<p class="text-red-400 text-sm">Error loading status.</p>`; // NEW
        }
    }

    function renderCircleMembers(members) {
        circleMembersList.innerHTML = "";
        members.forEach(member => {
            const isMe = member.id === currentUserId;
            const memberElement = document.createElement("button");
            memberElement.className = "w-full text-left bg-gray-700 text-gray-200 py-2 px-3 rounded-lg hover:bg-gray-600 transition duration-300";
            memberElement.textContent = `${member.name} ${isMe ? "(You)" : ""}`;
            memberElement.dataset.memberId = member.id;
            memberElement.dataset.memberName = member.name;

            memberElement.addEventListener("click", () => {
                showMemberGoalsModal(member.id, member.name);
            });
            circleMembersList.appendChild(memberElement);
        });
    }

    // NEW: Accountability Logic
    async function loadAccountabilityStatus(members) {
        accountabilityStatusList.innerHTML = "";
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        let membersSafe = [];
        let membersMissed = [];

        try {
            const statusPromises = members.map(async (member) => {
                const feedRef = collection(db, `circles/${currentCircleId}/feed`);
                
                // --- THIS IS THE FIX ---
                // 1. Remove orderBy and limit, as they require an index.
                const q = query(
                    feedRef, 
                    where("userId", "==", member.id)
                );
                
                const postSnap = await getDocs(q);
                
                if (postSnap.empty) {
                    return { ...member, status: "missed" }; // Never posted
                } else {
                    // 2. We must now sort in JS to find the most recent post
                    let posts = [];
                    postSnap.forEach(doc => {
                        posts.push(doc.data());
                    });

                    posts.sort((a, b) => {
                        const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
                        const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
                        return timeB - timeA; // Newest first
                    });
                    
                    const lastPost = posts[0]; // Get the most recent one
                    // 3. Check if timestamp exists before calling .toDate()
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
            // --- END OF FIX ---

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
                safeHeader.className = "text-sm font-semibold text-green-400";
                safeHeader.textContent = "Up-to-Date";
                accountabilityStatusList.appendChild(safeHeader);
                
                membersSafe.forEach(member => {
                    const el = document.createElement('div');
                    el.className = "flex items-center bg-gray-700 p-2 rounded-lg";
                    el.innerHTML = `<span class="status-dot status-safe"></span><span class="text-sm text-gray-200">${member.name}</span>`;
                    accountabilityStatusList.appendChild(el);
                });
            }

            if (membersMissed.length > 0) {
                const missedHeader = document.createElement('h4');
                missedHeader.className = `text-sm font-semibold text-red-400 ${membersSafe.length > 0 ? 'mt-3' : ''}`;
                missedHeader.textContent = "Missed Update";
                accountabilityStatusList.appendChild(missedHeader);

                membersMissed.forEach(member => {
                    const el = document.createElement('div');
                    el.className = "flex items-center bg-gray-700 p-2 rounded-lg";
                    el.innerHTML = `<span class="status-dot status-missed"></span><span class="text-sm text-gray-200">${member.name}</span>`;
                    accountabilityStatusList.appendChild(el);
                });
            }
            
            if (membersSafe.length === 0 && membersMissed.length === 0) {
                 accountabilityStatusList.innerHTML = `<p class="text-gray-400 text-sm">No members in this circle.</p>`;
            }

        } catch (error) {
            console.error("Error loading accountability status:", error);
            accountabilityStatusList.innerHTML = `<p class="text-red-400 text-sm">Error loading status.</p>`;
        }
    }

    async function showMemberGoalsModal(memberId, memberName) {
        const modalHTML = `
            <h3 class="text-xl font-semibold mb-4">Goals for ${memberName}</h3>
            <div id="member-goals-list" class="space-y-3 max-h-60 overflow-y-auto pr-2">
                <p class="text-gray-400">Loading goals...</p>
            </div>
            <button id="modal-close-button" class="mt-6 w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300">
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
                memberGoalsList.innerHTML = `<p class="text-gray-400">${memberName} hasn't added any goals yet.</p>`;
                return;
            }
            
            memberGoalsList.innerHTML = ""; // Clear loading
            goalsSnap.forEach(doc => {
                const goal = doc.data();
                const current = Number(goal.current);
                const total = Number(goal.total);
                const percentage = total > 0 ? (current / total) * 100 : 0;
                
                let progressBarColor = "bg-indigo-500";
                if (percentage >= 100) progressBarColor = "bg-green-500";
                else if (percentage >= 50) progressBarColor = "bg-yellow-500";

                const goalElement = document.createElement("div");
                goalElement.className = "bg-gray-700 p-3 rounded-lg";
                goalElement.innerHTML = `
                    <div class="flex justify-between items-center">
                        <span class="font-semibold">${goal.title}</span>
                        <span class="text-gray-400">${current} / ${total}</span>
                    </div>
                    <div class="w-full bg-gray-600 rounded-full h-2 mt-2">
                        <div class="${progressBarColor} h-2 rounded-full" style="width: ${percentage}%"></div>
                    </div>
                `;
                memberGoalsList.appendChild(goalElement);
            });

        } catch (error) {
            console.error("Error fetching member goals:", error);
            memberGoalsList.innerHTML = `<p class="text-red-400">Could not load goals.</p>`;
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
            goalsList.innerHTML = `<p class="text-gray-400 text-sm">You haven't added any goals yet. Click the "+" button to get started.</p>`;
            return;
        }
        
        goals.forEach(goal => {
            const current = Number(goal.current);
            const total = Number(goal.total);
            const percentage = total > 0 ? (current / total) * 100 : 0;
            
            let progressBarColor = "bg-indigo-500";
            if (percentage >= 100) progressBarColor = "bg-green-500";
            else if (percentage >= 75) progressBarColor = "bg-blue-500";
            else if (percentage >= 50) progressBarColor = "bg-yellow-500";
            else if (percentage >= 25) progressBarColor = "bg-orange-500";

            const goalElement = document.createElement("div");
            goalElement.className = "bg-gray-700 p-4 rounded-lg";
            goalElement.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-semibold">${goal.title}</span>
                    <span class="text-gray-400">${current} / ${total}</span>
                </div>
                <div class="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                    <div class="${progressBarColor} h-2.5 rounded-full" style="width: ${percentage}%"></div>
                </div>
                <button data-id="${goal.id}" class="delete-goal-button text-xs text-red-400 hover:text-red-300 mt-2">
                    Delete
                </button>
            `;
            goalsList.appendChild(goalElement);
        });
        
        document.querySelectorAll('.delete-goal-button').forEach(button => {
            button.addEventListener('click', () => handleDeleteGoal(button.dataset.id));
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


    function showAddGoalModal() {
        const modalHTML = `
            <form id="add-goal-form">
                <h3 class="text-xl font-semibold mb-6">Add New Goal</h3>
                
                <div class="mb-4">
                    <label for="goal-title" class="block text-sm font-medium text-gray-300 mb-2">Goal Title</label>
                    <input type="text" id="goal-title" name="title" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="e.g., Leetcode Questions">
                </div>
                
                <div class="flex gap-4 mb-6">
                    <div class="w-1/2">
                        <label for="goal-current" class="block text-sm font-medium text-gray-300 mb-2">Current</label>
                        <input type="number" id="goal-current" name="current" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" required value="0" min="0">
                    </div>
                    <div class="w-1/2">
                        <label for="goal-total" class="block text-sm font-medium text-gray-300 mb-2">Total</label>
                        <input type="number" id="goal-total" name="total" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="e.g., 150" min="1">
                    </div>
                </div>
                
                <div class="flex gap-4">
                    <button type="button" id="modal-cancel-button" class="w-1/2 bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition duration-300">
                        Cancel
                    </button>
                    <button type="submit" id="modal-submit-button" class="w-1/2 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300">
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
                createdAt: new Date()
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
                <h3 class="text-xl font-semibold mb-6">Submit Daily Update</h3>
                
                <div class="mb-4">
                    <label for="checkin-goal-select" class="block text-sm font-medium text-gray-300 mb-2">Which goal did you work on?</label>
                    <select id="checkin-goal-select" name="goalId" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                        ${goalOptions}
                    </select>
                </div>
                
                <div class="mb-4">
                    <label for="checkin-new-value" class="block text-sm font-medium text-gray-300 mb-2">What is your new 'current' value?</label>
                    <input type="number" id="checkin-new-value" name="newValue" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" required min="0">
                </div>

                <div class="mb-6">
                    <label for="checkin-notes" class="block text-sm font-medium text-gray-300 mb-2">What did you do?</label>
                    <textarea id="checkin-notes" name="notes" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" rows="3" placeholder="e.g., 'Finished 2 DSA problems and reviewed graph concepts...'" required></textarea>
                </div>

                <div class="mb-4">
                    <label for="checkin-image" class="block text-sm font-medium text-gray-300 mb-2">Add a Screenshot (Max 1MB)</label>
                    <input type="file" id="checkin-image" name="image" class="w-full text-sm text-gray-400" accept="image/*">
                    <div id="image-preview-container" class="mt-2 hidden">
                        <img id="image-preview" src="#" alt="Image preview" class="max-h-32 rounded-lg border-2 border-gray-600">
                    </div>
                </div>
                
                <p class="text-xs text-gray-400 mb-4">Audio recording feature skipped.</p>

                <div class="flex gap-4">
                    <button type="button" id="modal-cancel-button" class="w-1/2 bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition duration-300">
                        Cancel
                    </button>
                    <button type="submit" id="modal-submit-button" class="w-1/2 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300">
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

            const goalRef = doc(db, `users/${currentUserId}/goals`, goalId);
            await updateDoc(goalRef, {
                current: newValue
            });
            
            const feedRef = collection(db, `circles/${currentCircleId}/feed`);
            await addDoc(feedRef, {
                userId: currentUserId,
                userName: userDisplayName, 
                userEmail: userEmail,
                goalTitle: selectedGoal.title,
                updateText: `updated ${selectedGoal.title} to ${newValue}/${selectedGoal.total}`,
                notes: notes,
                timestamp: serverTimestamp(),
                audioURL: null,
                imageURL: imageURL
            });
            
            closeModal();
            showMessageModal("Your update has been posted to the circle feed!", "Success");
            
            // NEW: Manually refresh accountability status after posting
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
            feedList.innerHTML = `<p class="text-gray-400 text-sm">Select a circle to see the feed.</p>`;
            return;
        }

        console.log("Loading feed for circle:", currentCircleId);
        const feedRef = collection(db, `circles/${currentCircleId}/feed`);
        
        feedUnsubscribe = onSnapshot(feedRef, (snapshot) => {
            let feedItems = [];
            snapshot.forEach((doc) => {
                feedItems.push({ id: doc.id, ...doc.data() });
            });
            
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
            feedList.innerHTML = `<p class="text-gray-400 text-sm">The feed is empty. Be the first to post an update!</p>`;
            return;
        }
        
        feedItems.forEach(item => {
            const postElement = document.createElement("div");
            postElement.className = "bg-gray-700 p-4 rounded-lg";
            
            const time = item.timestamp ? new Date(item.timestamp.toMillis()).toLocaleString() : "just now";
            const name = item.userName || item.userEmail.split('@')[0];
            
            let mediaHTML = '';
            if (item.imageURL) {
                mediaHTML = `
                    <div class="mt-3">
                        <img src="${item.imageURL}" alt="User screenshot" class="max-h-60 w-auto rounded-lg border-2 border-gray-600 cursor-pointer" data-img-src="${item.imageURL}">
                    </div>
                `;
            }

            postElement.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm font-semibold text-white">${name}</span>
                    <span class="text-xs text-gray-400">${time}</span>
                </div>
                <p class="text-gray-300 mb-2"><strong class="font-medium text-indigo-300">${item.updateText}</strong></p>
                <p class="text-gray-200 text-sm bg-gray-800 p-3 rounded-md">${item.notes}</p>
                ${mediaHTML}
            `;
            feedList.appendChild(postElement);
        });

        feedList.querySelectorAll('img[data-img-src]').forEach(img => {
            img.addEventListener('click', () => {
                showModal(`
                    <img src="${img.dataset.imgSrc}" alt="Enlarged screenshot" class="max-w-full max-h-[80vh] w-auto h-auto rounded-lg mx-auto">
                `);
            });
        });
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
                    `Firebase is blocking this app's domain. You must add this domain to your Firebase project's "Authorized domains" list.<br><br><strong class="text-white">Domain to add:</strong><br><code class="bg-gray-900 text-indigo-300 px-2 py-1 rounded-md block mt-2">${currentDomain}</code><br><br><strong>How to fix:</strong><B R>1. Go to your Firebase Console<br>2. Go to Authentication > Settings<br>3. Click 'Authorized domains'<br>4. Click 'Add domain' and paste the code above.`, 
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

    addGoalButton.addEventListener("click", showAddGoalModal);
    checkInButton.addEventListener("click", showCheckInModal);
    createCircleButton.addEventListener("click", showCreateCircleModal);
    joinCircleButton.addEventListener("click", showJoinCircleModal);
    editAliasButton.addEventListener("click", showAliasModal);

    if (!auth) {
        showMessageModal("Firebase is not initialized. The app cannot start.", "Fatal Error");
    }

});

