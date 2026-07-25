/**
 * Pastelly - Pinterest-Style Aesthetic Mood Board Generator
 * Upgraded Interactive Logic, Desktop Uploads, EXIF Date Extractor,
 * Themed Stickers, Synthesized Lo-Fi Player, Comments System, Anti-Gravity Physics,
 * Collaboration List Additions, Share/Export CORS fixes, and Community Board Explorer
 */

// ==========================================
// 1. STATE & DATA DEFINITIONS
// ==========================================
let activeBoardId = "board-saas";
let gravityActive = false;
let driftSpeedMultiplier = 1.0;
let floatAmplitude = 20; // pixels
let mouseSensitivity = 1.2;

// Interactive user profile state
let userProfile = {
  name: "Elena Rostova",
  role: "Lead Designer",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
};

// Collaborators state
let collaborators = [];

let boards = [
  {
    id: "board-saas",
    name: "SaaS Landing Page",
    desc: "A gravity-free canvas gathering wireframes, pastel profiles, and components for our new web project design.",
    theme: "#FFB0B5",
    liked: false,
    likesCount: 148
  },
  {
    id: "board-mobile",
    name: "E-Commerce App",
    desc: "Product cards, checkout flows, and sticker-decorated pastel notes.",
    theme: "#F9DCC0",
    liked: false,
    likesCount: 84
  }
];

let moodCards = [];

// Contextual stickers based on active board theme color
const stickerPacks = {
  "#FFB0B5": ["🎀 Ribbon", "🌸 Bloom", "🧸 Cozy", "✨ Sparkles", "🍨 Sweet"],
  "#FFC6CA": ["🎀 Ribbon", "🌸 Bloom", "🧸 Cozy", "✨ Sparkles", "🍨 Sweet"],
  "#FFD3D6": ["💾 Retro", "⚡ Zap", "👾 Pixel", "📼 Tape", "🔥 Hot"],
  "#F9DCC0": ["🍑 Peach", "☀️ Sun", "💡 Idea", "🍯 Warm", "🍊 Citrus"],
  "default": ["📌 Pin", "💡 Idea", "✨ Sparkles", "🍀 Clover", "🔮 Dream"]
};

// Explore Public Community Boards Data (dynamic state loaded from server)
let communityBoards = [];

// ==========================================
// 2. INTERACTIVE USER PROFILE EDITOR
// ==========================================
const profileModal = document.getElementById("profile-modal");
const profileEditPreview = document.getElementById("profile-edit-preview");
const profileFileInput = document.getElementById("profile-file-input");

if (document.getElementById("profile-widget-trigger")) {
  document.getElementById("profile-widget-trigger").addEventListener("click", () => {
    document.getElementById("profile-name-input").value = userProfile.name;
    document.getElementById("profile-role-input").value = userProfile.role;
    profileEditPreview.src = userProfile.avatar;
    profileModal.classList.remove("hidden");
  });
}

if (document.getElementById("btn-close-profile")) {
  document.getElementById("btn-close-profile").addEventListener("click", () => {
    profileModal.classList.add("hidden");
  });
}

if (profileModal) {
  profileModal.addEventListener("click", (e) => {
    if (e.target === profileModal) profileModal.classList.add("hidden");
  });
}

if (document.getElementById("profile-upload-circle")) {
  document.getElementById("profile-upload-circle").addEventListener("click", () => {
    profileFileInput.click();
  });
}

if (profileFileInput) {
  profileFileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      const reader = new FileReader();
      reader.onload = (event) => {
        profileEditPreview.src = event.target.result;
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  });
}

if (document.getElementById("profile-form")) {
  document.getElementById("profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const newName = document.getElementById("profile-name-input").value;
    const newRole = document.getElementById("profile-role-input").value;
    const newAvatar = profileEditPreview.src;
    
    fetch("/api/users/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": currentUser.id
      },
      body: JSON.stringify({ name: newName, role: newRole, avatar: newAvatar })
    })
    .then(r => {
      if (!r.ok) throw new Error("Failed to save profile.");
      return r.json();
    })
    .then(data => {
      userProfile.name = data.user.name;
      userProfile.role = data.user.role || newRole;
      userProfile.avatar = data.user.avatar;
      
      currentUser.name = userProfile.name;
      currentUser.avatar = userProfile.avatar;
      currentUser.role = userProfile.role;
      localStorage.setItem("pastelly_user", JSON.stringify(currentUser));
      
      // Update header UI
      document.getElementById("header-profile-avatar").src = userProfile.avatar;
      
      // Update local cards
      moodCards.forEach(card => {
        if (card.author === "Elena Rostova" || card.author === userProfile.name) {
          card.author = userProfile.name;
          card.authorAvatar = userProfile.avatar;
        }
      });
      
      profileModal.classList.add("hidden");
      renderMoodGrid();
      showToast("Profile details updated successfully! 🌸");
    })
    .catch(err => {
      console.error(err);
      showToast("Failed to save profile settings.");
    });
  });
}

const btnProfileSignout = document.getElementById("btn-profile-signout");
if (btnProfileSignout) {
  btnProfileSignout.addEventListener("click", () => {
    localStorage.removeItem("pastelly_user");
    currentUser = null;
    
    // Hide edit modal
    if (profileModal) profileModal.classList.add("hidden");
    
    // Reset active workspace variables
    userLoggedMoods = [];
    boards = [];
    moodCards = [];
    activeBoardId = null;
    
    // Force show auth overlay
    const authModal = document.getElementById("auth-modal");
    if (authModal) {
      authModal.classList.remove("hidden");
      authModal.style.display = "flex";
    }
    
    // Clear canvas grids and headers
    const boardNameInput = document.getElementById("board-name-input");
    if (boardNameInput) boardNameInput.value = "Dream Canvas";
    renderSidebarBoards();
    renderMoodGrid();
    renderMoodTrackerGrid();
    
    showToast("Logged out successfully! 🌸");
  });
}

// ==========================================
// 3. DESKTOP UPLOADS & FILE METADATA
// ==========================================
const dragDropOverlay = document.getElementById("drag-drop-overlay");
let currentUploadedFileDate = null;
let uploadedFileDataUrl = "";

window.addEventListener("dragenter", (e) => {
  if (e.dataTransfer.types.includes("Files")) {
    dragDropOverlay.classList.remove("hidden");
  }
});

if (dragDropOverlay) {
  dragDropOverlay.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  dragDropOverlay.addEventListener("dragleave", (e) => {
    if (e.relatedTarget === null || e.target === dragDropOverlay) {
      dragDropOverlay.classList.add("hidden");
    }
  });

  dragDropOverlay.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDropOverlay.classList.add("hidden");
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      handleLocalFile(files[0]);
    } else {
      showToast("Invalid file structure. Please drop an image!");
    }
  });
}

const fileInput = document.getElementById("file-uploader-input");
const dropboxPrompt = document.getElementById("drop-box-prompt");
const dropboxPreviewWrap = document.getElementById("drop-box-preview-wrap");
const previewImageEl = document.getElementById("upload-image-preview");
const uploadModal = document.getElementById("upload-modal");

if (document.getElementById("modal-upload-dropbox")) {
  document.getElementById("modal-upload-dropbox").addEventListener("click", () => {
    fileInput.click();
  });
}

if (fileInput) {
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleLocalFile(e.target.files[0]);
    }
  });
}

if (document.getElementById("btn-upload-trigger")) {
  document.getElementById("btn-upload-trigger").addEventListener("click", () => {
    resetUploadModal();
    loadStickerSelectorPack();
    uploadModal.classList.remove("hidden");
  });
}

if (document.getElementById("btn-close-upload")) {
  document.getElementById("btn-close-upload").addEventListener("click", () => {
    uploadModal.classList.add("hidden");
  });
}

function handleLocalFile(file) {
  if (file.lastModified) {
    const fileDate = new Date(file.lastModified);
    currentUploadedFileDate = fileDate.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    
    document.getElementById("extracted-date-label").textContent = currentUploadedFileDate;
    document.getElementById("exif-date-group").style.display = "flex";
    document.getElementById("upload-show-date").checked = true;
  } else {
    currentUploadedFileDate = null;
    document.getElementById("exif-date-group").style.display = "none";
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    uploadedFileDataUrl = event.target.result;
    
    previewImageEl.src = uploadedFileDataUrl;
    dropboxPrompt.classList.add("hidden");
    dropboxPreviewWrap.classList.remove("hidden");
    
    loadStickerSelectorPack();
    uploadModal.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function resetUploadModal() {
  uploadedFileDataUrl = "";
  previewImageEl.src = "";
  currentUploadedFileDate = null;
  dropboxPrompt.classList.remove("hidden");
  dropboxPreviewWrap.classList.add("hidden");
  document.getElementById("upload-pin-form").reset();
  document.getElementById("preview-sticker-badge").classList.add("hidden");
}

let selectedStickerText = "none";

function loadStickerSelectorPack() {
  const row = document.getElementById("upload-sticker-selector-row");
  if (!row) return;
  row.innerHTML = "";
  
  const activeB = boards.find(b => b.id === activeBoardId);
  const themeColor = activeB ? activeB.theme : "default";
  const pack = stickerPacks[themeColor] || stickerPacks["default"];
  
  selectedStickerText = "none";
  
  const noneBtn = document.createElement("button");
  noneBtn.type = "button";
  noneBtn.className = "btn-sticker active";
  noneBtn.textContent = "None";
  noneBtn.onclick = () => selectSticker(noneBtn, "none");
  row.appendChild(noneBtn);
  
  pack.forEach(sticker => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-sticker";
    btn.textContent = sticker;
    btn.onclick = () => selectSticker(btn, sticker);
    row.appendChild(btn);
  });
}

function selectSticker(buttonEl, stickerName) {
  document.querySelectorAll(".btn-sticker").forEach(btn => btn.classList.remove("active"));
  buttonEl.classList.add("active");
  selectedStickerText = stickerName;
  
  const previewSticker = document.getElementById("preview-sticker-badge");
  if (stickerName === "none") {
    previewSticker.classList.add("hidden");
  } else {
    previewSticker.textContent = stickerName;
    previewSticker.classList.remove("hidden");
  }
}

// ==========================================
// 4. COLOR SAMPLER / QUANTIZATION
// ==========================================
function extractDominantColors(imageSrc, callback) {
  const img = new Image();
  img.src = imageSrc;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 30;
    canvas.height = 30;
    
    ctx.drawImage(img, 0, 0, 30, 30);
    const imgData = ctx.getImageData(0, 0, 30, 30).data;
    
    let colorCounts = {};
    for (let i = 0; i < imgData.length; i += 16) {
      let r = imgData[i];
      let g = imgData[i+1];
      let b = imgData[i+2];
      let a = imgData[i+3];
      if (a < 150) continue;
      
      let qr = Math.round(r / 32) * 32;
      let qg = Math.round(g / 32) * 32;
      let qb = Math.round(b / 32) * 32;
      let key = `${qr},${qg},${qb}`;
      colorCounts[key] = (colorCounts[key] || 0) + 1;
    }
    
    let sortedColors = Object.keys(colorCounts).sort((x, y) => colorCounts[y] - colorCounts[x]);
    let hexPalettes = [];
    for (let j = 0; j < 4; j++) {
      let rgbStr = sortedColors[j] || "255,176,181";
      let rgbArr = rgbStr.split(",").map(Number);
      
      let pr = Math.round((rgbArr[0] + 255) / 2);
      let pg = Math.round((rgbArr[1] + 255) / 2);
      let pb = Math.round((rgbArr[2] + 255) / 2);
      
      let hex = "#" + ((1 << 24) + (pr << 16) + (pg << 8) + pb).toString(16).slice(1).toUpperCase();
      hexPalettes.push(hex);
    }
    callback(hexPalettes);
  };
  img.onerror = () => {
    callback(["#FFE5E7", "#FFD3D6", "#FFC6CA", "#F9DCC0"]);
  };
}

// ==========================================
// 5. GRID RENDERER & INTERACTIVE CARD LIKES
// ==========================================
const gridContainer = document.getElementById("mood-board-grid");
let activeCategory = "all";

function renderMoodGrid() {
  if (!gridContainer) return;
  gridContainer.innerHTML = "";
  
  const filtered = moodCards.filter(card => {
    const matchesFilter = activeCategory === "all" || card.category === activeCategory;
    const matchesBoard = card.boardId === activeBoardId;
    return matchesFilter && matchesBoard;
  });

  if (filtered.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="help-circle" style="width: 44px; height: 44px; color: var(--text-light); margin-bottom: 10px;"></i>
        <h3>No pins found</h3>
        <p>Drop a local desktop image or click "+ Add Pin" to build this canvas!</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  document.getElementById("board-stickers-count").textContent = 
    `${moodCards.filter(c => c.boardId === activeBoardId && c.sticker !== "none").length} Stickers`;

  filtered.forEach((card) => {
    const cardEl = document.createElement("div");
    cardEl.className = `mood-card border-${card.border} bg-${card.bgColor} ${card.size === "wide" ? "card-wide-slot" : ""}`;
    cardEl.setAttribute("data-id", card.id);
    
    if (!gravityActive) {
      cardEl.setAttribute("draggable", "true");
      cardEl.addEventListener("dragstart", handleCardDragStart);
      cardEl.addEventListener("dragover", handleCardDragOver);
      cardEl.addEventListener("drop", handleCardDrop);
      cardEl.addEventListener("dragend", handleCardDragEnd);
    } else {
      cardEl.removeAttribute("draggable");
      cardEl.addEventListener("mousedown", handleFloatingMouseDown);
    }

    let visualContent = "";
    if (card.visual.type === "image" || card.visual.type === "palette-image") {
      visualContent = `
        <div class="card-visual-wrap">
          <img src="${card.visual.src}" alt="${card.title}" crossorigin="anonymous" />
        </div>
      `;
    } else if (card.visual.type === "palette-gradient") {
      visualContent = `
        <div class="card-visual-wrap" style="height: 120px; background: linear-gradient(135deg, ${card.extractedColors[0]}, ${card.extractedColors[1]}); border-bottom: 1px solid var(--panel-border);"></div>
      `;
    } else if (card.visual.type === "note") {
      visualContent = `
        <div class="note-quote-box">
          "${card.description}"
        </div>
      `;
    }

    let swatchesHTML = "";
    if (card.extractedColors && card.extractedColors.length > 0) {
      swatchesHTML = `
        <div class="card-extracted-colors">
          ${card.extractedColors.map(color => `
            <div class="card-color-swatch" style="background-color: ${color};" title="Copy ${color}" data-hex="${color}"></div>
          `).join("")}
        </div>
      `;
    }

    let stickerHTML = "";
    if (card.sticker && card.sticker !== "none") {
      stickerHTML = `<div class="sticker-badge">${card.sticker}</div>`;
    }

    let fontClass = "font-serif";
    if (card.font === "sans") fontClass = "font-sans";
    else if (card.font === "cormorant") fontClass = "font-cormorant";
    else if (card.font === "pacifico") fontClass = "font-pacifico";
    else if (card.font === "courier") fontClass = "font-courier";
    else if (card.font === "syne") fontClass = "font-syne";
    else if (card.font === "outfit") fontClass = "font-outfit";

    let dateHTML = "";
    if (card.captureDate) {
      dateHTML = `
        <div class="card-date-badge">
          <i data-lucide="calendar"></i>
          <span>Captured: ${card.captureDate}</span>
        </div>
      `;
    }

    cardEl.innerHTML = `
      ${stickerHTML}
      <button class="btn-card-like ${card.liked ? 'liked' : ''}" title="Like pin" data-card-like-id="${card.id}">
        <i data-lucide="heart"></i>
      </button>
      <span class="card-like-indicator">${card.likesCount || 0} Likes</span>
      
      ${visualContent}
      <div class="card-details-panel">
        <h4 class="card-headline ${fontClass}">${card.title}</h4>
        ${card.visual.type !== 'note' ? `<p class="card-caption">${card.description}</p>` : ''}
        ${dateHTML}
        ${swatchesHTML}
      </div>
      <div class="card-bottom-bar">
        <div class="card-author-info">
          <img src="${card.authorAvatar}" alt="${card.author}" crossorigin="anonymous" class="avatar-small" />
          <span style="font-size: 10px; font-weight: 600;">${card.author.split(" ")[0]}</span>
        </div>
        <span class="card-badge-tag">${card.category}</span>
      </div>
    `;
    
    const likeBtn = cardEl.querySelector(".btn-card-like");
    likeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCardLike(card, likeBtn, cardEl.querySelector(".card-like-indicator"));
    });

    cardEl.addEventListener("click", (e) => {
      if (e.target.classList.contains("card-color-swatch")) {
        e.stopPropagation();
        const hex = e.target.getAttribute("data-hex");
        copyToClipboard(hex, `Copied color ${hex}!`);
        return;
      }
      if (e.currentTarget.classList.contains("dragging-now")) {
        return;
      }
      if (typeof handleWashiCardSelection !== "undefined" && handleWashiCardSelection(card.id)) {
        return;
      }
      openDetailView(card.id);
    });

    gridContainer.appendChild(cardEl);
  });

  lucide.createIcons();
}

function toggleCardLike(card, buttonEl, countSpan) {
  card.liked = !card.liked;
  if (card.liked) {
    card.likesCount = (card.likesCount || 0) + 1;
    buttonEl.classList.add("liked");
    showToast("Liked pin! ❤️");
  } else {
    card.likesCount = Math.max(0, (card.likesCount || 0) - 1);
    buttonEl.classList.remove("liked");
  }
  countSpan.textContent = `${card.likesCount} Likes`;

  if (currentUser) {
    fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
      body: JSON.stringify(card)
    });
  }
}

// Global Board Likes Toggle (Scoped to the Active Board Object)
if (document.getElementById("board-like-heart")) {
  document.getElementById("board-like-heart").addEventListener("click", (e) => {
    const activeB = boards.find(b => b.id === activeBoardId);
    if (!activeB) return;
    
    activeB.liked = !activeB.liked;
    const heart = e.currentTarget;
    const counter = document.getElementById("like-count");
    
    if (activeB.liked) {
      activeB.likesCount += 1;
      heart.classList.add("liked");
      showToast("Aesthetic board liked! ❤️");
    } else {
      activeB.likesCount = Math.max(0, activeB.likesCount - 1);
      heart.classList.remove("liked");
    }
    counter.textContent = `${activeB.likesCount} Likes`;

    if (currentUser) {
      fetch(`/api/boards/${activeBoardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({ name: activeB.name, desc: activeB.desc, theme: activeB.theme })
      });
    }
  });
}

// ==========================================
// 6. SWAP DRAG & DROP INDEX
// ==========================================
let draggedCardId = null;

function handleCardDragStart(e) {
  draggedCardId = this.getAttribute("data-id");
  this.classList.add("dragging-now");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", draggedCardId);
}

function handleCardDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

function handleCardDrop(e) {
  e.preventDefault();
  const targetId = this.getAttribute("data-id");
  
  if (draggedCardId && draggedCardId !== targetId) {
    const draggedIdx = moodCards.findIndex(c => c.id === draggedCardId);
    const targetIdx = moodCards.findIndex(c => c.id === targetId);
    
    if (draggedIdx !== -1 && targetIdx !== -1) {
      const temp = moodCards[draggedIdx];
      moodCards.splice(draggedIdx, 1);
      moodCards.splice(targetIdx, 0, temp);
      renderMoodGrid();
      showToast("Pins rearranged!");
    }
  }
}

function handleCardDragEnd() {
  this.classList.remove("dragging-now");
  draggedCardId = null;
}

// ==========================================
// 7. ANTI-GRAVITY card drift loops
// ==========================================
let animationFrameId = null;
let activeDraggingFloatingCard = null;
let dragOffset = { x: 0, y: 0 };

function toggleGravityMode(enabled) {
  gravityActive = enabled;
  const container = document.getElementById("canvas-container");
  const panel = document.getElementById("gravity-controls-panel");
  if (!container) return;
  
  if (enabled) {
    container.classList.add("gravity-active");
    if (panel) panel.classList.remove("hidden");
    document.getElementById("board-layout-val").textContent = "Anti-Gravity Drift";
    
    const containerWidth = container.clientWidth || 800;
    
    moodCards.forEach((card, idx) => {
      if (!card.physics.x || card.physics.x > containerWidth) {
        card.physics.x = (idx * 270) % (containerWidth - 200) + 30;
        card.physics.y = 120 + Math.random() * 200;
      }
      card.physics.base_y = card.physics.y;
      card.physics.phase = Math.random() * Math.PI * 2;
    });

    renderMoodGrid();
    startPhysicsLoop();
    showToast("Defying gravity! Vector controls enabled.");
  } else {
    container.classList.remove("gravity-active");
    if (panel) panel.classList.add("hidden");
    document.getElementById("board-layout-val").textContent = "Pastel Masonry";
    
    moodCards.forEach(card => {
      const el = document.querySelector(`[data-id="${card.id}"]`);
      if (el) {
        el.style.left = "";
        el.style.top = "";
      }
    });

    cancelAnimationFrame(animationFrameId);
    renderMoodGrid();
    showToast("Snapping back to columns layout.");
  }
}

function startPhysicsLoop() {
  const container = document.getElementById("canvas-container");
  if (!container) return;
  const containerWidth = container.clientWidth || 800;

  function updatePhysics() {
    // Apply washi links spring pulls
    if (typeof washiLinks !== "undefined" && washiLinks.length > 0) {
      washiLinks.forEach(link => {
        const cardA = moodCards.find(c => c.id === link.cardIdA);
        const cardB = moodCards.find(c => c.id === link.cardIdB);
        if (!cardA || !cardB) return;
        
        const dx = cardB.physics.x - cardA.physics.x;
        const dy = cardB.physics.y - cardA.physics.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const restLength = 220; 
        const k = 0.008; 
        
        if (dist > 5) {
          const force = (dist - restLength) * k;
          const pullX = (dx / dist) * force;
          const pullY = (dy / dist) * force;
          
          if (activeDraggingFloatingCard && activeDraggingFloatingCard.id === cardA.id) {
            // Card A is held by mouse, drag card B towards it
            cardB.physics.x -= pullX * 2;
            cardB.physics.base_y -= pullY * 2;
          } else if (activeDraggingFloatingCard && activeDraggingFloatingCard.id === cardB.id) {
            // Card B is held by mouse, drag card A towards it
            cardA.physics.x += pullX * 2;
            cardA.physics.base_y += pullY * 2;
          } else {
            cardA.physics.x += pullX;
            cardA.physics.base_y += pullY;
            cardB.physics.x -= pullX;
            cardB.physics.base_y -= pullY;
          }
        }
      });
    }

    moodCards.forEach(card => {
      if (activeDraggingFloatingCard && activeDraggingFloatingCard.id === card.id) {
        return;
      }

      card.physics.phase += 0.015 * driftSpeedMultiplier;
      let bob = Math.sin(card.physics.phase) * floatAmplitude;
      let targetY = card.physics.base_y + bob;

      // Mouse repel forces
      if (mouse.x !== null && mouse.y !== null) {
        const el = document.querySelector(`[data-id="${card.id}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          let dx = cx - mouse.x;
          let dy = cy - mouse.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 150) {
            let force = (150 - dist) / 150 * mouseSensitivity * 4;
            let angle = Math.atan2(dy, dx);
            card.physics.x += Math.cos(angle) * force;
            card.physics.base_y += Math.sin(angle) * force;
          }
        }
      }

      if (card.physics.x < 10) card.physics.x = 10;
      if (card.physics.x > containerWidth - 260) card.physics.x = containerWidth - 260;
      if (card.physics.base_y < 20) card.physics.base_y = 20;
      if (card.physics.base_y > 450) card.physics.base_y = 450;

      const el = document.querySelector(`[data-id="${card.id}"]`);
      if (el) {
        el.style.left = `${card.physics.x}px`;
        el.style.top = `${targetY}px`;
      }
    });

    animationFrameId = requestAnimationFrame(updatePhysics);
  }
  updatePhysics();
}

function handleFloatingMouseDown(e) {
  if (!gravityActive) return;
  if (e.target.closest(".card-color-swatch") || e.target.closest(".btn-card-like")) {
    return;
  }
  
  const cardId = this.getAttribute("data-id");
  const card = moodCards.find(c => c.id === cardId);
  if (!card) return;

  activeDraggingFloatingCard = card;
  this.classList.add("dragging-now");
  
  const rect = this.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;

  document.addEventListener("mousemove", handleFloatingMouseMove);
  document.addEventListener("mouseup", handleFloatingMouseUp);
}

function handleFloatingMouseMove(e) {
  if (!activeDraggingFloatingCard) return;
  
  const container = document.getElementById("canvas-container");
  const parentRect = container.getBoundingClientRect();
  
  let x = e.clientX - parentRect.left - dragOffset.x;
  let y = e.clientY - parentRect.top - dragOffset.y;
  
  if (x < 10) x = 10;
  if (x > parentRect.width - 260) x = parentRect.width - 260;
  if (y < 10) y = 10;
  if (y > 500) y = 500;

  activeDraggingFloatingCard.physics.x = x;
  activeDraggingFloatingCard.physics.y = y;
  activeDraggingFloatingCard.physics.base_y = y;

  const el = document.querySelector(`[data-id="${activeDraggingFloatingCard.id}"]`);
  if (el) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }
}

function handleFloatingMouseUp() {
  if (activeDraggingFloatingCard) {
    const el = document.querySelector(`[data-id="${activeDraggingFloatingCard.id}"]`);
    if (el) {
      el.classList.remove("dragging-now");
    }
    setTimeout(() => {
      activeDraggingFloatingCard = null;
    }, 50);
  }
  document.removeEventListener("mousemove", handleFloatingMouseMove);
  document.removeEventListener("mouseup", handleFloatingMouseUp);
}

// Slider controls listeners
if (document.getElementById("gravity-mode-checkbox")) {
  document.getElementById("gravity-mode-checkbox").addEventListener("change", (e) => {
    toggleGravityMode(e.target.checked);
  });
}

const sliderDrift = document.getElementById("slider-drift");
const valDrift = document.getElementById("val-drift");
if (sliderDrift) {
  sliderDrift.addEventListener("input", (e) => {
    driftSpeedMultiplier = parseFloat(e.target.value);
    valDrift.textContent = `${driftSpeedMultiplier.toFixed(1)}x`;
  });
}

const sliderAmp = document.getElementById("slider-amplitude");
const valAmp = document.getElementById("val-amplitude");
if (sliderAmp) {
  sliderAmp.addEventListener("input", (e) => {
    floatAmplitude = parseInt(e.target.value);
    valAmp.textContent = `${floatAmplitude}px`;
  });
}

const sliderSens = document.getElementById("slider-sensitivity");
const valSens = document.getElementById("val-sensitivity");
if (sliderSens) {
  sliderSens.addEventListener("input", (e) => {
    mouseSensitivity = parseFloat(e.target.value);
    valSens.textContent = `${mouseSensitivity.toFixed(1)}x`;
  });
}

if (document.getElementById("btn-randomize-float")) {
  document.getElementById("btn-randomize-float").addEventListener("click", () => {
    moodCards.forEach(card => {
      card.physics.phase = Math.random() * Math.PI * 2;
      card.physics.base_y = 120 + Math.random() * 200;
    });
    showToast("Floating phases randomized!");
  });
}

// ==========================================
// 8. BACKGROUND FLOATING PARTICLES
// ==========================================
const canvas = document.getElementById("gravity-canvas");
let ctx = null;
if (canvas) ctx = canvas.getContext("2d");
let particles = [];
let mouse = { x: null, y: null };

function resizeBgCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeBgCanvas);

window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
window.addEventListener("mouseleave", () => {
  mouse.x = null;
  mouse.y = null;
});

class PastelParticle {
  constructor() {
    this.reset();
    if (canvas) this.y = Math.random() * canvas.height;
  }
  reset() {
    if (!canvas) return;
    this.x = Math.random() * canvas.width;
    this.y = canvas.height + 20;
    this.size = Math.random() * 5 + 2;
    this.speed = (Math.random() * 0.4 + 0.1) * (gravityActive ? driftSpeedMultiplier : 0.6);
    this.color = ["#FFE5E7", "#FFD3D6", "#FFC6CA", "#F9DCC0"][Math.floor(Math.random() * 4)];
    this.alpha = Math.random() * 0.4 + 0.1;
  }
  update() {
    this.y -= this.speed;
    this.x += Math.sin(this.y * 0.01) * 0.15;
    
    if (mouse.x !== null && mouse.y !== null) {
      let dx = this.x - mouse.x;
      let dy = this.y - mouse.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        let push = (100 - dist) / 100 * 2;
        this.x += (dx / dist) * push;
        this.y += (dy / dist) * push;
      }
    }
    
    if (this.y < -20) {
      this.reset();
    }
  }
  draw() {
    if (!ctx) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function initBgParticles() {
  particles = [];
  const count = Math.floor(window.innerWidth / 20);
  for (let i = 0; i < count; i++) {
    particles.push(new PastelParticle());
  }
}

function animateBgParticles() {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.update();
    p.draw();
  });
  requestAnimationFrame(animateBgParticles);
}

// ==========================================
// 9. COZY LO-FI WEB AUDIO SYNTHESIZER
// ==========================================
let audioContext = null;
let rainNoiseNode = null;
let crackleSourceNode = null;
let humOscillatorNode = null;
let lofiSynthActive = false;

function initLofiSynth() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function playLofiSynth(trackId) {
  if (!audioContext) {
    initLofiSynth();
  }
  
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  // 1. Synthesize Rain static noise
  const bufferSize = audioContext.sampleRate * 2;
  const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  
  rainNoiseNode = audioContext.createBufferSource();
  rainNoiseNode.buffer = noiseBuffer;
  rainNoiseNode.loop = true;

  const rainFilter = audioContext.createBiquadFilter();
  rainFilter.type = "lowpass";
  rainFilter.frequency.value = trackId === "midnight-cafe" ? 450 : 800;

  const rainGain = audioContext.createGain();
  rainGain.gain.value = trackId === "cozy-fireplace" ? 0.02 : 0.08;

  rainNoiseNode.connect(rainFilter);
  rainFilter.connect(rainGain);
  rainGain.connect(audioContext.destination);
  rainNoiseNode.start(0);

  // 2. Synthesize Vinyl Crackles (Math spikes)
  const crackleBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const crackleOutput = crackleBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    crackleOutput[i] = Math.random() < 0.0012 ? (Math.random() * 2 - 1) : 0;
  }
  crackleSourceNode = audioContext.createBufferSource();
  crackleSourceNode.buffer = crackleBuffer;
  crackleSourceNode.loop = true;

  const crackleGain = audioContext.createGain();
  crackleGain.gain.value = trackId === "cozy-fireplace" ? 0.15 : 0.08;
  
  crackleSourceNode.connect(crackleGain);
  crackleGain.connect(audioContext.destination);
  crackleSourceNode.start(0);

  // 3. Synthesize Cozy low oscillator pads
  if (trackId === "cozy-fireplace" || trackId === "midnight-cafe") {
    humOscillatorNode = audioContext.createOscillator();
    humOscillatorNode.type = "triangle";
    humOscillatorNode.frequency.value = trackId === "cozy-fireplace" ? 82 : 110; 

    const humFilter = audioContext.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.value = 120;

    const humGain = audioContext.createGain();
    humGain.gain.value = 0.15;

    const lfo = audioContext.createOscillator();
    lfo.frequency.value = 0.5;
    const lfoGain = audioContext.createGain();
    lfoGain.gain.value = 0.05;
    
    lfo.connect(lfoGain);
    lfoGain.connect(humGain.gain);
    
    humOscillatorNode.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(audioContext.destination);
    
    humOscillatorNode.start(0);
    lfo.start(0);
  }

  lofiSynthActive = true;
}

function stopLofiSynth() {
  if (rainNoiseNode) {
    try { rainNoiseNode.stop(); } catch(e){}
    rainNoiseNode = null;
  }
  if (crackleSourceNode) {
    try { crackleSourceNode.stop(); } catch(e){}
    crackleSourceNode = null;
  }
  if (humOscillatorNode) {
    try { humOscillatorNode.stop(); } catch(e){}
    humOscillatorNode = null;
  }
  lofiSynthActive = false;
}

// Bind Player Controls
const btnLofiPlay = document.getElementById("btn-lofi-play");
const lofiPlayIcon = document.getElementById("lofi-play-icon");
const lofiVisualizer = document.getElementById("lofi-visualizer");
const lofiTrackStatus = document.getElementById("lofi-track-status");
const selectLofiTrack = document.getElementById("select-lofi-track");

if (btnLofiPlay) {
  btnLofiPlay.addEventListener("click", () => {
    if (lofiSynthActive) {
      stopLofiSynth();
      lofiPlayIcon.setAttribute("data-lucide", "play");
      lofiVisualizer.classList.remove("playing");
      lofiTrackStatus.textContent = "Idle";
      showToast("Ambient synthesizer paused.");
    } else {
      const track = selectLofiTrack.value;
      playLofiSynth(track);
      lofiPlayIcon.setAttribute("data-lucide", "pause");
      lofiVisualizer.classList.add("playing");
      lofiTrackStatus.textContent = "Playing Ambient";
      
      const trackNameMap = {
        "pastel-sunset": "Pastel Sunset",
        "cozy-fireplace": "Cozy Fireplace",
        "midnight-cafe": "Midnight Café"
      };
      document.getElementById("lofi-track-title").textContent = trackNameMap[track];
      showToast(`Synthesizing cozy ambient soundscape: ${trackNameMap[track]}! 🎵`);
    }
    lucide.createIcons();
  });
}

if (selectLofiTrack) {
  selectLofiTrack.addEventListener("change", () => {
    if (lofiSynthActive) {
      stopLofiSynth();
      const track = selectLofiTrack.value;
      playLofiSynth(track);
      
      const trackNameMap = {
        "pastel-sunset": "Pastel Sunset",
        "cozy-fireplace": "Cozy Fireplace",
        "midnight-cafe": "Midnight Café"
      };
      document.getElementById("lofi-track-title").textContent = trackNameMap[track];
    }
  });
}

// ==========================================
// 10. SUBMISSIONS OF PINS
// ==========================================
if (document.getElementById("upload-pin-form")) {
  document.getElementById("upload-pin-form").addEventListener("submit", (e) => {
    e.preventDefault();
    
    if (!uploadedFileDataUrl) {
      showToast("Please drag-and-drop or select an image file first!");
      return;
    }

    const title = document.getElementById("upload-title").value;
    const desc = document.getElementById("upload-desc").value;
    const fontStyle = document.getElementById("styling-font").value;
    const borderStyle = document.getElementById("styling-border").value;
    const shadeColor = document.getElementById("styling-color").value;
    const tagsStr = document.getElementById("upload-tags").value;
    const tags = tagsStr.split(",").map(t => t.trim()).filter(t => t.length > 0);
    const cardSize = document.getElementById("upload-size").value;
    
    const showDateCheckbox = document.getElementById("upload-show-date");
    const captureDate = (showDateCheckbox && showDateCheckbox.checked) ? currentUploadedFileDate : null;

    extractDominantColors(uploadedFileDataUrl, (extracted) => {
      const newCard = {
        id: `card-upload-${Date.now()}`,
        boardId: activeBoardId,
        title: title,
        category: "layouts",
        description: desc,
        author: userProfile.name,
        authorAvatar: userProfile.avatar,
        tags: tags.length > 0 ? tags : ["upload", "pastelly"],
        sticker: selectedStickerText,
        font: fontStyle,
        border: borderStyle,
        bgColor: shadeColor,
        size: cardSize,
        visual: {
          type: "image",
          src: uploadedFileDataUrl
        },
        extractedColors: extracted,
        physics: { x: null, y: null, base_y: null, phase: 0 },
        likesCount: 0,
        liked: false,
        captureDate: captureDate,
        comments: []
      };

      if (currentUser) {
        fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
          body: JSON.stringify(newCard)
        })
        .then(r => r.json())
        .then(savedCard => {
          moodCards.unshift(savedCard);
          uploadModal.classList.add("hidden");
          resetUploadModal();
          
          if (gravityActive) {
            toggleGravityMode(true);
          } else {
            renderMoodGrid();
          }
          showToast("Pin created & colors quantized! 🌸");
        });
      } else {
        moodCards.unshift(newCard);
        uploadModal.classList.add("hidden");
        resetUploadModal();
        
        if (gravityActive) {
          toggleGravityMode(true);
        } else {
          renderMoodGrid();
        }
        showToast("Pin created & colors quantized! 🌸");
      }
    });
  });
}

// Create text note pin submission
const addPinModal = document.getElementById("add-pin-modal");
if (document.getElementById("btn-add-pin-trigger")) {
  document.getElementById("btn-add-pin-trigger").addEventListener("click", () => {
    addPinModal.classList.remove("hidden");
  });
}
if (document.getElementById("btn-close-add-pin")) {
  document.getElementById("btn-close-add-pin").addEventListener("click", () => {
    addPinModal.classList.add("hidden");
  });
}

if (document.getElementById("add-pin-form")) {
  document.getElementById("add-pin-form").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const title = document.getElementById("pin-title").value;
    const category = document.getElementById("pin-category").value;
    const desc = document.getElementById("pin-desc").value;
    const rawTags = document.getElementById("pin-tags").value;
    const tags = rawTags.split(",").map(t => t.trim()).filter(t => t.length > 0);

    const newNoteCard = {
      id: `card-note-${Date.now()}`,
      boardId: activeBoardId,
      title: title,
      category: category,
      description: desc,
      author: userProfile.name,
      authorAvatar: userProfile.avatar,
      tags: tags.length > 0 ? tags : ["notes", "pastelly"],
      sticker: "none",
      font: "sans",
      border: "solid",
      bgColor: "cream",
      size: "normal",
      visual: {
        type: "note"
      },
      extractedColors: ["#FFE5E7", "#FFD3D6", "#FFC6CA", "#F9DCC0"],
      physics: { x: null, y: null, base_y: null, phase: 0 },
      likesCount: 0,
      liked: false,
      captureDate: null,
      comments: []
    };

    if (currentUser) {
      fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify(newNoteCard)
      })
      .then(r => r.json())
      .then(savedCard => {
        moodCards.unshift(savedCard);
        addPinModal.classList.add("hidden");
        document.getElementById("add-pin-form").reset();
        
        if (gravityActive) {
          toggleGravityMode(true);
        } else {
          renderMoodGrid();
        }
        showToast("Text note added! 🌸");
      });
    } else {
      moodCards.unshift(newNoteCard);
      addPinModal.classList.add("hidden");
      document.getElementById("add-pin-form").reset();
      
      if (gravityActive) {
        toggleGravityMode(true);
      } else {
        renderMoodGrid();
      }
      showToast("Text note added!");
    }
  });
}

// Create Board
const addBoardModal = document.getElementById("add-board-modal");
if (document.getElementById("btn-close-add-board")) {
  document.getElementById("btn-close-add-board").addEventListener("click", () => {
    addBoardModal.classList.add("hidden");
  });
}

if (document.getElementById("add-board-form")) {
  document.getElementById("add-board-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("board-title").value;
    const desc = document.getElementById("board-desc").value;
    const theme = document.querySelector('input[name="board-theme"]:checked').value;

    const newBoard = {
      name: name,
      desc: desc,
      theme: theme
    };

    if (currentUser) {
      fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify(newBoard)
      })
      .then(r => r.json())
      .then(savedBoard => {
        boards.push(savedBoard);
        activeBoardId = savedBoard.id;
        
        addBoardModal.classList.add("hidden");
        document.getElementById("add-board-form").reset();
        
        renderSidebarBoards();
        updateBoardHeaders();
        
        if (gravityActive) {
          toggleGravityMode(true);
        } else {
          renderMoodGrid();
        }
        showToast(`Board "${name}" loaded! 🌸`);
      });
    } else {
      const mockBoard = Object.assign({ id: `board-${Date.now()}`, liked: false, likesCount: 0 }, newBoard);
      boards.push(mockBoard);
      activeBoardId = mockBoard.id;
      
      addBoardModal.classList.add("hidden");
      document.getElementById("add-board-form").reset();
      
      renderSidebarBoards();
      updateBoardHeaders();
      
      if (gravityActive) {
        toggleGravityMode(true);
      } else {
        renderMoodGrid();
      }
      showToast(`Board "${name}" loaded!`);
    }
  });
}

// Edit Board Details
const editBoardModal = document.getElementById("edit-board-modal");
if (document.getElementById("btn-edit-board-trigger")) {
  document.getElementById("btn-edit-board-trigger").addEventListener("click", () => {
    const activeB = boards.find(b => b.id === activeBoardId);
    if (!activeB) return;
    
    document.getElementById("edit-board-title").value = activeB.name;
    document.getElementById("edit-board-desc").value = activeB.desc;
    
    // Select correct theme color radio button
    const themeRadios = document.querySelectorAll('input[name="edit-board-theme"]');
    themeRadios.forEach(radio => {
      if (radio.value === activeB.theme) {
        radio.checked = true;
      }
    });
    
    editBoardModal.classList.remove("hidden");
  });
}

if (document.getElementById("btn-close-edit-board")) {
  document.getElementById("btn-close-edit-board").addEventListener("click", () => {
    editBoardModal.classList.add("hidden");
  });
}

if (editBoardModal) {
  editBoardModal.addEventListener("click", (e) => {
    if (e.target === editBoardModal) editBoardModal.classList.add("hidden");
  });
}

if (document.getElementById("edit-board-form")) {
  document.getElementById("edit-board-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const activeB = boards.find(b => b.id === activeBoardId);
    if (!activeB) return;
    
    const newName = document.getElementById("edit-board-title").value;
    const newDesc = document.getElementById("edit-board-desc").value;
    
    const selectedThemeRadio = document.querySelector('input[name="edit-board-theme"]:checked');
    const newTheme = selectedThemeRadio ? selectedThemeRadio.value : activeB.theme;
    
    activeB.name = newName;
    activeB.desc = newDesc;
    activeB.theme = newTheme;
    
    if (currentUser) {
      fetch(`/api/boards/${activeBoardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({ name: newName, desc: newDesc, theme: newTheme })
      })
      .then(r => r.json())
      .then(() => {
        editBoardModal.classList.add("hidden");
        renderSidebarBoards();
        updateBoardHeaders();
        
        if (gravityActive) {
          toggleGravityMode(true);
        } else {
          renderMoodGrid();
        }
        showToast(`Board details updated! 🌸`);
      });
    } else {
      editBoardModal.classList.add("hidden");
      renderSidebarBoards();
      updateBoardHeaders();
      
      if (gravityActive) {
        toggleGravityMode(true);
      } else {
        renderMoodGrid();
      }
      showToast(`Board details updated! 🌸`);
    }
  });
}

// ==========================================
// 11. DETAILS DRAWER & COMMENT SYSTEM
// ==========================================
const detailModal = document.getElementById("detail-modal");
const dMediaContainer = document.getElementById("detail-media-container");
const dTitle = document.getElementById("detail-title");
const dDesc = document.getElementById("detail-description");
const dExtras = document.getElementById("detail-extras");
const dTags = document.getElementById("detail-tags");
const dAvatar = document.getElementById("detail-author-avatar");
const dAuthorName = document.getElementById("detail-author-name");

let currentActiveDetailCard = null;

function openDetailView(cardId) {
  const card = moodCards.find(c => c.id === cardId);
  if (!card) return;

  currentActiveDetailCard = card;

  dMediaContainer.innerHTML = "";
  dExtras.innerHTML = "";
  dTags.innerHTML = "";

  dTitle.textContent = card.title;
  dDesc.textContent = card.description;
  dAvatar.src = card.authorAvatar;
  dAuthorName.textContent = card.author;

  card.tags.forEach(tag => {
    const tagEl = document.createElement("span");
    tagEl.className = "tag";
    tagEl.textContent = `#${tag}`;
    dTags.appendChild(tagEl);
  });

  if (card.visual.type === "image" || card.visual.type === "palette-image") {
    dMediaContainer.innerHTML = `<img src="${card.visual.src}" alt="${card.title}" crossorigin="anonymous" />`;
  } else if (card.visual.type === "palette-gradient") {
    dMediaContainer.innerHTML = `<div style="width:100%; height:100%; background: linear-gradient(135deg, ${card.extractedColors[0]}, ${card.extractedColors[1]});"></div>`;
  } else {
    dMediaContainer.innerHTML = `
      <div style="padding: 40px; font-family: 'Playfair Display', serif; font-size: 20px; font-style: italic; text-align: center; color: var(--text-brand);">
        "${card.description}"
      </div>
    `;
  }

  if (card.extractedColors && card.extractedColors.length > 0) {
    dExtras.innerHTML = `
      <h4 style="font-size:9px; font-weight:750; text-transform:uppercase; margin-bottom:10px; color:var(--text-secondary);">Extracted Colors</h4>
      <div class="detail-palette-grid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
        ${card.extractedColors.map(c => `
          <div style="display:flex; flex-direction:column; gap:4px; text-align:center; cursor:copy;" onclick="copyToClipboard('${c}', 'Copied color ${c}!')">
            <div style="background-color: ${c}; height: 44px; border-radius: 8px; border:1px solid rgba(0,0,0,0.05);"></div>
            <span style="font-family: monospace; font-size: 9px; font-weight:600;">${c}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  renderCommentsList(card);

  document.getElementById("btn-detail-delete-card").onclick = () => {
    if (currentUser) {
      fetch(`/api/cards/${cardId}`, {
        method: "DELETE",
        headers: { "x-user-id": currentUser.id }
      })
      .then(r => r.json())
      .then(() => {
        moodCards = moodCards.filter(c => c.id !== cardId);
        detailModal.classList.add("hidden");
        
        if (gravityActive) {
          toggleGravityMode(true);
        } else {
          renderMoodGrid();
        }
        showToast("Pin deleted! 🌸");
      });
    } else {
      moodCards = moodCards.filter(c => c.id !== cardId);
      detailModal.classList.add("hidden");
      
      if (gravityActive) {
        toggleGravityMode(true);
      } else {
        renderMoodGrid();
      }
      showToast("Pin deleted.");
    }
  };

  detailModal.classList.remove("hidden");
  lucide.createIcons();
}

function renderCommentsList(card) {
  const list = document.getElementById("detail-comments-list");
  const count = document.getElementById("comment-count");
  if (!list) return;
  list.innerHTML = "";
  
  const comments = card.comments || [];
  count.textContent = comments.length;
  
  if (comments.length === 0) {
    list.innerHTML = `<div style="font-size:11px; color:var(--text-light); text-align:center; padding:10px 0;">No collaborator notes posted. Add one below!</div>`;
    return;
  }

  comments.forEach(c => {
    const bubble = document.createElement("div");
    bubble.className = "comment-bubble";
    bubble.innerHTML = `
      <div class="comment-author-meta">
        <span style="display:flex; align-items:center; gap:6px;">
          <img src="${c.avatar}" alt="${c.author}" crossorigin="anonymous" class="avatar-small" style="width:16px; height:16px;" />
          <span>${c.author}</span>
        </span>
        <span style="color:var(--text-light);">${c.time}</span>
      </div>
      <div class="comment-body">${c.text}</div>
    `;
    list.appendChild(bubble);
  });
  list.scrollTop = list.scrollHeight;
}

if (document.getElementById("comment-form")) {
  document.getElementById("comment-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentActiveDetailCard) return;
    
    const input = document.getElementById("comment-input");
    const text = input.value.trim();
    if (!text) return;
    
    const newComment = {
      author: userProfile.name,
      avatar: userProfile.avatar,
      text: text,
      time: "Just now"
    };

    if (!currentActiveDetailCard.comments) currentActiveDetailCard.comments = [];
    currentActiveDetailCard.comments.push(newComment);
    input.value = "";
    
    if (currentUser) {
      fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify(currentActiveDetailCard)
      })
      .then(r => r.json())
      .then(() => {
        renderCommentsList(currentActiveDetailCard);
        showToast("Design note posted! 💬");
      });
    } else {
      renderCommentsList(currentActiveDetailCard);
      showToast("Design note posted! 💬");
    }
  });
}

if (document.getElementById("btn-close-detail")) {
  document.getElementById("btn-close-detail").addEventListener("click", () => {
    detailModal.classList.add("hidden");
  });
}

// ==========================================
// 12. DYNAMIC COLLABORATION LISTS
// ==========================================
const collabModal = document.getElementById("collab-modal");
const collabList = document.getElementById("collab-active-list");

if (document.getElementById("btn-collab-trigger")) {
  document.getElementById("btn-collab-trigger").addEventListener("click", () => {
    renderCollaborators();
    collabModal.classList.remove("hidden");
  });
}
if (document.getElementById("btn-close-collab")) {
  document.getElementById("btn-close-collab").addEventListener("click", () => {
    collabModal.classList.add("hidden");
  });
}
if (collabModal) {
  collabModal.addEventListener("click", (e) => {
    if (e.target === collabModal) collabModal.classList.add("hidden");
  });
}

function renderCollaborators() {
  if (!collabList) return;
  collabList.innerHTML = "";
  
  if (collaborators.length === 0) {
    collabList.innerHTML = `<div style="text-align:center; padding: 20px; font-size:11px; color:var(--text-light);">No active collaborators invited yet. Use the form above to add one!</div>`;
    return;
  }
  
  collaborators.forEach(collab => {
    const item = document.createElement("div");
    item.className = "collab-item";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "space-between";
    item.style.padding = "8px 0";
    item.style.borderBottom = "1px solid var(--panel-border)";
    
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="${collab.avatar}" alt="${collab.name}" crossorigin="anonymous" class="avatar-small" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" />
        <div style="display:flex; flex-direction:column;">
          <span style="font-size:12px; font-weight:700; color:var(--text-brand);">${collab.name}</span>
          <span style="font-size:10px; color:var(--text-light);">${collab.email}</span>
        </div>
      </div>
      <span style="font-size:9px; font-weight:700; background:rgba(0,0,0,0.05); padding:2px 8px; border-radius:10px; color:${collab.status === 'Online' ? '#5FA777' : '#9C858E'};">${collab.status}</span>
    `;
    collabList.appendChild(item);
  });
}

if (document.getElementById("btn-send-collab-invite")) {
  document.getElementById("btn-send-collab-invite").addEventListener("click", () => {
    const emailInput = document.getElementById("collab-email");
    const email = emailInput.value.trim();
    if (email) {
      // Parse name from email
      const namePart = email.split("@")[0];
      const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      
      const newCollab = {
        name: name,
        email: email,
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=50&q=80",
        status: "Online"
      };
      
      collaborators.push(newCollab);
      emailInput.value = "";
      renderCollaborators();
      showToast(`Added ${name} as a collaborator! 🌸`);
    } else {
      showToast("Please enter a valid collaborator email.");
    }
  });
}

// ==========================================
// 13. EXPLORE PUBLIC COMMUNITY BOARDS
// ==========================================
const communityModal = document.getElementById("community-modal");
const communityGridContainer = document.getElementById("community-grid-container");

if (document.getElementById("btn-community-trigger")) {
  document.getElementById("btn-community-trigger").addEventListener("click", () => {
    fetchCommunityBoards();
    communityModal.classList.remove("hidden");
  });
}

const btnPublishBoardTrigger = document.getElementById("btn-publish-board-trigger");
if (btnPublishBoardTrigger) {
  btnPublishBoardTrigger.addEventListener("click", () => {
    if (!currentUser) {
      showToast("Please log in first!");
      return;
    }
    
    if (confirm("Would you like to publish your current active board to the community? 🚀")) {
      fetch("/api/community/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify({ boardId: activeBoardId })
      })
      .then(res => {
        if (!res.ok) throw new Error("Failed to publish board.");
        return res.json();
      })
      .then(() => {
        showToast("Board published to the community successfully! 🚀");
      })
      .catch(err => {
        console.error(err);
        showToast("Publish failed. Try again.");
      });
    }
  });
}

if (document.getElementById("btn-close-community")) {
  document.getElementById("btn-close-community").addEventListener("click", () => {
    communityModal.classList.add("hidden");
  });
}
if (communityModal) {
  communityModal.addEventListener("click", (e) => {
    if (e.target === communityModal) communityModal.classList.add("hidden");
  });
}

function fetchCommunityBoards() {
  fetch("/api/community")
  .then(res => res.json())
  .then(data => {
    communityBoards = data;
    renderCommunityGrid();
  })
  .catch(err => {
    console.error("Failed to load community boards:", err);
    showToast("Community board server offline.");
  });
}

function renderCommunityGrid() {
  if (!communityGridContainer) return;
  communityGridContainer.innerHTML = "";

  if (communityBoards.length === 0) {
    communityGridContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--text-secondary);">
        <i data-lucide="compass" style="width: 48px; height: 48px; color: var(--pastel-pink-highlight); margin-bottom: 12px;"></i>
        <h4 class="font-decorative" style="font-size: 16px; color: var(--text-brand); margin-bottom: 6px;">No public boards published yet</h4>
        <p style="font-size: 11px; max-width: 320px; margin: 0 auto; line-height: 1.4;">Be the first to share your aesthetic! Use the "Publish Board" button on the sidebar to share your creation with the community.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  communityBoards.forEach(b => {
    const item = document.createElement("div");
    item.className = "community-board-card";
    
    const thumbUrl = (b.cards && b.cards.find(c => c.visual && c.visual.src)) 
      ? b.cards.find(c => c.visual && c.visual.src).visual.src 
      : "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=400&q=80";

    item.innerHTML = `
      <div class="community-card-preview" style="height: 150px; overflow: hidden; border-radius: 12px; margin-bottom: 10px; border: 1px solid var(--panel-border);">
        <img src="${thumbUrl}" alt="${b.name}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      <div class="community-board-info">
        <h4 class="community-board-title" style="font-size: 13px; font-weight: 750; color: var(--text-brand);">${b.name}</h4>
        <div class="community-board-author" style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
          <img src="${b.authorAvatar}" alt="${b.author}" crossorigin="anonymous" style="width:16px; height:16px; border-radius:50%; object-fit: cover;" />
          <span style="font-size: 10px; color: var(--text-secondary);">by ${b.author}</span>
        </div>
      </div>
      <div class="community-board-meta-row" style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
        <span style="font-size: 9px; color: var(--text-light); font-weight: 600;">${b.likes} Likes • ${b.views} Views</span>
        <button class="btn btn-primary" style="height:26px; font-size:10px; padding:0 12px; border-radius:6px;" data-import-id="${b.id}">Import</button>
      </div>
    `;

    // Click on Import button
    item.querySelector("[data-import-id]").addEventListener("click", (e) => {
      e.stopPropagation();
      importCommunityBoard(b);
    });

    item.addEventListener("dblclick", () => {
      importCommunityBoard(b);
    });

    communityGridContainer.appendChild(item);
  });
  lucide.createIcons();
}

function importCommunityBoard(commBoard) {
  // Check if board already imported
  let existing = boards.find(b => b.name === commBoard.name);
  if (!existing) {
    const newBoard = {
      id: `board-imported-${Date.now()}`,
      name: commBoard.name,
      desc: `Imported community board by ${commBoard.author}. Views: ${commBoard.views}`,
      theme: commBoard.theme,
      liked: false,
      likesCount: commBoard.likes
    };
    
    boards.push(newBoard);
    
    // Import corresponding cards
    commBoard.cards.forEach(card => {
      const newCard = Object.assign({}, card, {
        id: `card-imported-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        boardId: newBoard.id
      });
      moodCards.unshift(newCard);
    });

    activeBoardId = newBoard.id;
  } else {
    activeBoardId = existing.id;
  }

  communityModal.classList.add("hidden");
  renderSidebarBoards();
  updateBoardHeaders();
  
  if (gravityActive) {
    toggleGravityMode(true);
  } else {
    renderMoodGrid();
  }
  showToast(`Imported public board "${commBoard.name}"! 🚀`);
}

// ==========================================
// 14. SHARE & EXPORT FUNCTIONALITY
// ==========================================
const shareModal = document.getElementById("share-modal");
if (document.getElementById("btn-share-trigger")) {
  document.getElementById("btn-share-trigger").addEventListener("click", () => {
    shareModal.classList.remove("hidden");
  });
}
if (document.getElementById("btn-close-share")) {
  document.getElementById("btn-close-share").addEventListener("click", () => {
    shareModal.classList.add("hidden");
  });
}
if (shareModal) {
  shareModal.addEventListener("click", (e) => {
    if (e.target === shareModal) shareModal.classList.add("hidden");
  });
}

if (document.getElementById("btn-copy-share-link")) {
  document.getElementById("btn-copy-share-link").addEventListener("click", () => {
    const input = document.getElementById("share-link-input");
    copyToClipboard(input.value, "Public share link copied!");
  });
}

// Route export button to Collage Studio modal
if (document.getElementById("btn-export-trigger")) {
  document.getElementById("btn-export-trigger").addEventListener("click", () => {
    openCollageStudio();
  });
}

// ==========================================
// 15. AUXILIARIES & THEMING
// ==========================================
const toastElement = document.getElementById("toast-notification");
const toastMsgText = document.getElementById("toast-message");

function showToast(message) {
  if (!toastElement) return;
  toastMsgText.textContent = message;
  toastElement.classList.remove("hidden");
  setTimeout(() => {
    toastElement.classList.add("hidden");
  }, 2300);
}

function copyToClipboard(text, message = "Copied to clipboard!") {
  navigator.clipboard.writeText(text).then(() => {
    showToast(message);
  });
}

// Cozy theme mode toggles on document root
const btnThemeToggle = document.getElementById("btn-theme-toggle");
if (btnThemeToggle) {
  btnThemeToggle.addEventListener("click", () => {
    const rootEl = document.documentElement;
    const isDark = rootEl.getAttribute("data-theme") === "dark";
    if (isDark) {
      rootEl.removeAttribute("data-theme");
      btnThemeToggle.querySelector("span").textContent = "Dreamy Mode";
      btnThemeToggle.querySelector("i").setAttribute("data-lucide", "sparkles");
      showToast("Light Cozy palette restored.");
    } else {
      rootEl.setAttribute("data-theme", "dark");
      btnThemeToggle.querySelector("span").textContent = "Warm Light";
      btnThemeToggle.querySelector("i").setAttribute("data-lucide", "sun");
      showToast("Dreamy Dark mode toggled.");
    }
    lucide.createIcons();
  });
}

// Sidebar boards render
const sidebarBoardsList = document.getElementById("sidebar-boards-list");
function renderSidebarBoards() {
  if (!sidebarBoardsList) return;
  sidebarBoardsList.innerHTML = "";
  
  boards.forEach(b => {
    const active = b.id === activeBoardId;
    const item = document.createElement("div");
    item.className = `board-card ${active ? "active" : ""}`;
    
    item.innerHTML = `
      <div class="board-icon-wrap" style="${active ? `background-color:${b.theme}; color:white;` : ''}">
        <i data-lucide="${b.id.includes('mobile') ? 'shopping-bag' : 'layout'}" class="board-icon"></i>
      </div>
      <div class="board-info">
        <h4 class="board-name">${b.name}</h4>
        <p class="board-meta">${moodCards.filter(c => c.boardId === b.id).length} Pins</p>
      </div>
    `;

    item.addEventListener("click", () => {
      activeBoardId = b.id;
      renderSidebarBoards();
      updateBoardHeaders();
      
      if (gravityActive) {
        toggleGravityMode(true);
      } else {
        renderMoodGrid();
      }
    });

    sidebarBoardsList.appendChild(item);
  });
  
  const addBtn = document.createElement("button");
  addBtn.className = "btn btn-dashed-full";
  addBtn.innerHTML = `<i data-lucide="plus"></i><span>Create Board</span>`;
  addBtn.style.marginTop = "6px";
  addBtn.style.border = "1.5px dashed var(--panel-border)";
  addBtn.style.background = "rgba(255, 255, 255, 0.1)";
  addBtn.style.width = "100%";
  addBtn.style.borderRadius = "12px";
  addBtn.style.height = "38px";
  
  addBtn.addEventListener("click", () => {
    addBoardModal.classList.remove("hidden");
  });
  
  sidebarBoardsList.appendChild(addBtn);
  lucide.createIcons();
}

function updateBoardHeaders() {
  const activeB = boards.find(b => b.id === activeBoardId);
  if (!activeB) return;
  
  document.getElementById("active-board-title-display").textContent = activeB.name;
  document.getElementById("active-board-desc-display").textContent = activeB.desc;
  
  document.getElementById("like-count").textContent = `${activeB.likesCount} Likes`;
  
  const boardHeart = document.getElementById("board-like-heart");
  if (boardHeart) {
    if (activeB.liked) {
      boardHeart.classList.add("liked");
    } else {
      boardHeart.classList.remove("liked");
    }
  }

  const swatchesContainer = document.getElementById("board-color-dots");
  if (swatchesContainer) {
    swatchesContainer.innerHTML = `
      <span class="color-dot" style="background-color: ${activeB.theme};" title="${activeB.theme}"></span>
      <span class="color-dot" style="background-color: #FFE5E7;" title="#FFE5E7"></span>
      <span class="color-dot" style="background-color: #FFC6CA;" title="#FFC6CA"></span>
      <span class="color-dot" style="background-color: #F9DCC0;" title="#F9DCC0"></span>
    `;
  }
}

// Category filter tag clicks
const tagsFilter = document.querySelectorAll(".filter-tag");
tagsFilter.forEach(tag => {
  tag.addEventListener("click", () => {
    tagsFilter.forEach(t => t.classList.remove("active"));
    tag.classList.add("active");
    activeCategory = tag.getAttribute("data-filter");
    
    if (gravityActive) {
      toggleGravityMode(true);
    } else {
      renderMoodGrid();
    }
  });
});

// Gravity gauge adjustments (Sync Vector pull and speeds)
const gravityVal = document.getElementById("gravity-val");
const gravityGaugeFill = document.querySelector(".gauge-fill");
const gravityGauge = document.querySelector(".gravity-gauge");

if (gravityGauge) {
  gravityGauge.addEventListener("click", (e) => {
    const rect = e.currentTarget.querySelector(".gauge-bar").getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    
    if (gravityGaugeFill) gravityGaugeFill.style.width = `${pct}%`;
    const force = pct / 100;
    if (gravityVal) gravityVal.textContent = `${force.toFixed(2)}G`;
    
    // Sync force to driftMultiplier and particles speed
    driftSpeedMultiplier = force * 4.0;
    particles.forEach(p => p.speed = (Math.random() * 0.4 + 0.1) * force * 2.5);
    
    // Sync values in control panel sliders
    if (sliderDrift) {
      sliderDrift.value = driftSpeedMultiplier;
      if (valDrift) valDrift.textContent = `${driftSpeedMultiplier.toFixed(1)}x`;
    }
    
    showToast(`Gravity Force vector set to ${force.toFixed(2)}G!`);
  });
}

// Search input with safeguards
const searchInput = document.getElementById("search-input");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    const cards = document.querySelectorAll(".mood-card");
    
    cards.forEach(cardEl => {
      const id = cardEl.getAttribute("data-id");
      const card = moodCards.find(c => c.id === id);
      if (!card) return;
      
      const stickerMatch = (card.sticker || "").toLowerCase().includes(term);
      const tagMatch = (card.tags || []).some(t => String(t).toLowerCase().includes(term));
      const categoryMatch = (card.category || "").toLowerCase().includes(term);
      const titleMatch = (card.title || "").toLowerCase().includes(term);
      const descMatch = (card.description || "").toLowerCase().includes(term);
      
      const match = titleMatch || descMatch || stickerMatch || tagMatch || categoryMatch;
      cardEl.style.display = match ? "flex" : "none";
    });
  });
}

window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    if (searchInput) searchInput.focus();
  }
});

// ==========================================
// 16. ADVANCED IMPORTERS & COLLAGE STUDIO EXPORTERS
// ==========================================
const mediaImporterModal = document.getElementById("media-importer-modal");

// Modal open triggers
if (document.getElementById("btn-media-import-trigger")) {
  document.getElementById("btn-media-import-trigger").addEventListener("click", () => {
    mediaImporterModal.classList.remove("hidden");
    document.getElementById("pinterest-preview-box").classList.add("hidden");
    document.getElementById("pinterest-url-input").value = "";
  });
}
if (document.getElementById("btn-close-media-importer")) {
  document.getElementById("btn-close-media-importer").addEventListener("click", () => {
    mediaImporterModal.classList.add("hidden");
  });
}
if (mediaImporterModal) {
  mediaImporterModal.addEventListener("click", (e) => {
    if (e.target === mediaImporterModal) mediaImporterModal.classList.add("hidden");
  });
}

// Pinterest url scraping
let parsedPinterestPinPhoto = "";
const pinImportForm = document.getElementById("pinterest-import-form");
const pinPreviewBox = document.getElementById("pinterest-preview-box");

if (pinImportForm) {
  pinImportForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = document.getElementById("pinterest-url-input").value.trim();
    if (!url) return;
    
    showToast("Scraping Pin URL details...");
    
    // Call our Express server API
    fetch(`/api/scrape-pinterest?url=${encodeURIComponent(url)}`)
      .then(res => {
        if (!res.ok) throw new Error("Could not parse Pin. Verify the link is public.");
        return res.json();
      })
      .then(data => {
        parsedPinterestPinPhoto = `/api/proxy-image?url=${encodeURIComponent(data.image)}`;
        document.getElementById("pinterest-preview-img").src = parsedPinterestPinPhoto;
        document.getElementById("pinterest-preview-title").textContent = data.title;
        document.getElementById("pinterest-preview-desc").textContent = data.description || "Saved Pinterest Swatch details.";
        
        pinPreviewBox.classList.remove("hidden");
        showToast("Metadata fetched! Confirm to import.");
      })
      .catch(err => {
        console.error(err);
        showToast(err.message || "Failed to fetch Pin.");
      });
  });
}

if (document.getElementById("btn-pinterest-confirm-add")) {
  document.getElementById("btn-pinterest-confirm-add").addEventListener("click", () => {
    if (!parsedPinterestPinPhoto) return;
    
    const pTitle = document.getElementById("pinterest-preview-title").textContent;
    const pDesc = document.getElementById("pinterest-preview-desc").textContent;
    
    extractDominantColors(parsedPinterestPinPhoto, (extracted) => {
      const newCard = {
        id: `card-pinterest-${Date.now()}`,
        boardId: activeBoardId,
        title: pTitle,
        category: "layouts",
        description: pDesc,
        author: userProfile.name,
        authorAvatar: userProfile.avatar,
        tags: ["saved-from-pinterest"],
        sticker: "📌 Pin",
        font: "serif",
        border: "solid",
        bgColor: "default",
        size: "normal",
        visual: {
          type: "image",
          src: parsedPinterestPinPhoto
        },
        extractedColors: extracted,
        physics: { x: null, y: null, base_y: null, phase: 0 },
        likesCount: 0,
        liked: false,
        captureDate: null,
        comments: []
      };

      moodCards.unshift(newCard);
      mediaImporterModal.classList.add("hidden");
      pinPreviewBox.classList.add("hidden");
      document.getElementById("pinterest-url-input").value = "";
      
      if (gravityActive) {
        toggleGravityMode(true);
      } else {
        renderMoodGrid();
      }
      showToast("Saved Pinterest card onto board! 📌");
    });
  });
}

// Spotify functionality removed. Native synth ambient loops kept.

// Collage Studio Modal controls
const collageStudioModal = document.getElementById("collage-studio-modal");
const collageFrame = document.getElementById("collage-frame-target");
const collageWatermark = document.getElementById("collage-watermark-stamp");
const collageDateStamp = document.getElementById("collage-date-stamp");
const collageCardsContainer = document.getElementById("collage-cards-container");
const collagePaletteBar = document.getElementById("collage-palette-bar");

function openCollageStudio() {
  if (!collageStudioModal) return;
  buildCollageStudioLayout();
  collageStudioModal.classList.remove("hidden");
}

if (document.getElementById("btn-close-collage-studio")) {
  document.getElementById("btn-close-collage-studio").addEventListener("click", () => {
    collageStudioModal.classList.add("hidden");
  });
}

// Regenerate button
if (document.getElementById("btn-build-collage-images")) {
  document.getElementById("btn-build-collage-images").addEventListener("click", () => {
    buildCollageStudioLayout();
    showToast("Collage layout reshuffled! 🎨");
  });
}

// Preset format selectors
const collagePresetSelect = document.getElementById("collage-preset-select");
if (collagePresetSelect) {
  collagePresetSelect.addEventListener("change", () => {
    const val = collagePresetSelect.value;
    
    // Clear classes
    collageFrame.className = "";
    collageCardsContainer.className = "";
    
    if (val === "story") {
      collageFrame.className = "collage-frame-story";
      collageCardsContainer.className = "collage-grid-story";
    } else if (val === "post") {
      collageFrame.className = "collage-frame-post";
      collageCardsContainer.className = "collage-grid-post";
    } else if (val === "pin") {
      collageFrame.className = "collage-frame-pin";
      collageCardsContainer.className = "collage-grid-pin";
    }
  });
}

// Watermark Handle input sync
const watermarkInput = document.getElementById("collage-watermark-input");
if (watermarkInput) {
  watermarkInput.addEventListener("input", (e) => {
    collageWatermark.textContent = e.target.value;
  });
}

// Toggle overlays
if (document.getElementById("toggle-collage-date")) {
  document.getElementById("toggle-collage-date").addEventListener("change", (e) => {
    collageDateStamp.style.display = e.target.checked ? "flex" : "none";
  });
}
if (document.getElementById("toggle-collage-palette")) {
  document.getElementById("toggle-collage-palette").addEventListener("change", (e) => {
    collagePaletteBar.style.display = e.target.checked ? "flex" : "none";
  });
}

function buildCollageStudioLayout() {
  if (!collageCardsContainer) return;
  collageCardsContainer.innerHTML = "";
  
  // Find cards belonging to the active board
  const boardCards = moodCards.filter(c => c.boardId === activeBoardId);
  if (boardCards.length === 0) {
    collageCardsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; font-size:12px; color:var(--text-light);">Create some pins on your board to build a collage!</div>`;
    return;
  }

  // Shuffle and pick up to 4 cards
  const shuffled = [...boardCards].sort(() => 0.5 - Math.random());
  const selectedCards = shuffled.slice(0, 4);
  
  selectedCards.forEach(card => {
    const cardEl = document.createElement("div");
    cardEl.className = "collage-card-inner";
    
    let visualHTML = "";
    if (card.visual.type === "image" || card.visual.type === "palette-image") {
      visualHTML = `<img src="${card.visual.src}" alt="${card.title}" crossorigin="anonymous" />`;
    } else {
      visualHTML = `<div style="height: 55%; border-radius:8px; background:linear-gradient(135deg, ${card.extractedColors[0]}, ${card.extractedColors[1]});"></div>`;
    }
    
    cardEl.innerHTML = `
      ${visualHTML}
      <div style="display:flex; flex-direction:column; gap:2px; height: 40%; justify-content:center;">
        <span class="collage-card-title">${card.title}</span>
        <p class="collage-card-desc" style="margin:0;">${card.description || ""}</p>
      </div>
    `;
    collageCardsContainer.appendChild(cardEl);
  });

  // Extract color dots of the active board
  const activeB = boards.find(b => b.id === activeBoardId);
  const themeColor = activeB ? activeB.theme : "#FFB0B5";
  
  collagePaletteBar.innerHTML = "";
  const colors = [themeColor, "#FFE5E7", "#FFC6CA", "#F9DCC0"];
  colors.forEach(c => {
    const colorStrip = document.createElement("div");
    colorStrip.style.flexGrow = "1";
    colorStrip.style.backgroundColor = c;
    collagePaletteBar.appendChild(colorStrip);
  });

  // Init fields
  collageWatermark.textContent = watermarkInput ? watermarkInput.value : "@yourusername";
}

// Download Collage
if (document.getElementById("btn-download-collage-studio")) {
  document.getElementById("btn-download-collage-studio").addEventListener("click", () => {
    showToast("Generating high-res collage PNG...");
    
    html2canvas(collageFrame, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      scale: 2
    }).then(canvas => {
      const link = document.createElement("a");
      link.download = `Pastelly_Collage_${activeBoardId}_Story.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("Collage exported successfully! 📸");
    }).catch(err => {
      console.error(err);
      showToast("Collage export failed.");
    });
  });
}

// Send to Phone QR Link
const phoneShareModal = document.getElementById("phone-share-modal");
if (document.getElementById("btn-close-phone-share")) {
  document.getElementById("btn-close-phone-share").addEventListener("click", () => {
    phoneShareModal.classList.add("hidden");
  });
}
if (phoneShareModal) {
  phoneShareModal.addEventListener("click", (e) => {
    if (e.target === phoneShareModal) phoneShareModal.classList.add("hidden");
  });
}

if (document.getElementById("btn-send-to-phone-trigger")) {
  document.getElementById("btn-send-to-phone-trigger").addEventListener("click", () => {
    document.getElementById("qr-loading-spinner").classList.remove("hidden");
    document.getElementById("qr-code-wrapper").classList.add("hidden");
    document.getElementById("phone-share-temp-link").textContent = "Uploading image...";
    phoneShareModal.classList.remove("hidden");
    
    html2canvas(collageFrame, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      scale: 1.5
    }).then(canvas => {
      canvas.toBlob(blob => {
        const formData = new FormData();
        formData.append("file", blob, `pastelly_collage_${activeBoardId}.png`);
        
        // Upload to our Node server upload endpoint!
        fetch("/api/upload-collage", {
          method: "POST",
          body: formData
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            const shortLink = data.link;
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shortLink)}`;
            
            document.getElementById("qr-code-image").src = qrImageUrl;
            document.getElementById("phone-share-temp-link").href = shortLink;
            document.getElementById("phone-share-temp-link").textContent = shortLink;
            
            document.getElementById("qr-loading-spinner").classList.add("hidden");
            document.getElementById("qr-code-wrapper").classList.remove("hidden");
            showToast("QR Code Generated! Scan to save image.");
          } else {
            showToast("Upload failed. Try again.");
            phoneShareModal.classList.add("hidden");
          }
        })
        .catch(err => {
          console.error(err);
          showToast("Upload server error. Try again.");
          phoneShareModal.classList.add("hidden");
        });
      }, "image/png");
    });
  });
}

// ==========================================
// 17. USER AUTHENTICATION & INTERACTIVE CONTROLS
// ==========================================

let currentUser = null;
let userLoggedMoods = [];
let washiTapeMode = false;
let washiSelectedCardId = null;
let washiLinks = [];
let bujoGridActive = false;

// 1. Session Init
function initSession() {
  const session = localStorage.getItem("pastelly_user");
  const authModal = document.getElementById("auth-modal");
  
  if (session) {
    currentUser = JSON.parse(session);
    if (authModal) {
      authModal.classList.add("hidden");
      authModal.style.display = "none";
    }
    
    userProfile.name = currentUser.name;
    userProfile.avatar = currentUser.avatar;
    const headerAvatar = document.getElementById("header-profile-avatar");
    if (headerAvatar) headerAvatar.src = currentUser.avatar;
    
    fetchUserData();
  } else {
    if (authModal) {
      authModal.classList.remove("hidden");
      authModal.style.display = "flex";
    }
  }
}

function fetchUserData() {
  if (!currentUser) return;
  
  // Get boards
  fetch("/api/boards", {
    headers: { "x-user-id": currentUser.id }
  })
  .then(res => res.json())
  .then(userBoards => {
    boards = userBoards;
    if (boards.length > 0) {
      activeBoardId = boards[0].id;
    }
    
    // Get cards
    return fetch("/api/cards", {
      headers: { "x-user-id": currentUser.id }
    });
  })
  .then(res => res.json())
  .then(userCards => {
    moodCards = userCards;
    
    // Get moods
    return fetch("/api/moods", {
      headers: { "x-user-id": currentUser.id }
    });
  })
  .then(res => res.json())
  .then(userMoods => {
    userLoggedMoods = userMoods;
    renderMoodTrackerGrid();
    
    renderSidebarBoards();
    updateBoardHeaders();
    renderMoodGrid();
    
    const swatchContainer = document.getElementById("board-color-dots");
    if (swatchContainer && !document.getElementById("btn-sidebar-harmonize")) {
      const harmBtn = document.createElement("button");
      harmBtn.id = "btn-sidebar-harmonize";
      harmBtn.className = "btn btn-outline btn-block";
      harmBtn.style.marginTop = "12px";
      harmBtn.style.fontSize = "10px";
      harmBtn.style.height = "28px";
      harmBtn.style.padding = "0 8px";
      harmBtn.innerHTML = `<i data-lucide="palette" style="width:10px; height:10px;"></i><span>Harmonize Colors</span>`;
      harmBtn.addEventListener("click", () => harmonizeBoardPalette());
      swatchContainer.parentElement.appendChild(harmBtn);
      lucide.createIcons();
    }
  })
  .catch(err => {
    console.error("Sync data failed:", err);
    showToast("Server sync error. Reconnect network.");
  });
}

// 2. Auth Panel Event Listeners
const authModal = document.getElementById("auth-modal");
const authLoginContainer = document.getElementById("auth-login-container");
const authSignupContainer = document.getElementById("auth-signup-container");
const authLoginForm = document.getElementById("auth-login-form");
const authSignupForm = document.getElementById("auth-signup-form");
const authOtpScreen = document.getElementById("auth-otp-screen");

// Navigation links
const linkGoToSignup = document.getElementById("link-go-to-signup");
const linkGoToLogin = document.getElementById("link-go-to-login");

if (linkGoToSignup) {
  linkGoToSignup.addEventListener("click", () => {
    authLoginContainer.classList.add("hidden");
    authSignupContainer.classList.remove("hidden");
    authOtpScreen.classList.add("hidden");
  });
}

if (linkGoToLogin) {
  linkGoToLogin.addEventListener("click", () => {
    authSignupContainer.classList.add("hidden");
    authLoginContainer.classList.remove("hidden");
    authOtpScreen.classList.add("hidden");
  });
}

// Google Login popup trigger and message receiver
function handleGoogleLoginSuccess(name, email, avatar) {
  fetch("/api/auth/google-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, avatar })
  })
  .then(res => {
    if (!res.ok) throw new Error("Google login verification failed.");
    return res.json();
  })
  .then(data => {
    localStorage.setItem("pastelly_user", JSON.stringify(data.user));
    showToast(`Welcome back, ${data.user.name}! 🌸`);
    initSession();
  })
  .catch(err => {
    console.error(err);
    showToast(err.message || "Google sign-in failed.");
  });
}

const btnGoogleLogin = document.getElementById("btn-google-login");
if (btnGoogleLogin) {
  btnGoogleLogin.addEventListener("click", () => {
    let clientId = localStorage.getItem("google_client_id");
    if (!clientId) {
      const userInput = prompt("To display your real Google accounts, please enter your Google OAuth Client ID (or click Cancel to use mock profiles):\nYou can create one in the Google Cloud Console.", "");
      if (userInput === null) {
        // Fallback to mock account chooser popup
        const width = 500;
        const height = 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        window.open(
          "google-signin-mock.html",
          "Google Sign-In",
          `width=${width},height=${height},left=${left},top=${top}`
        );
        return;
      }
      clientId = userInput.trim();
      if (clientId) {
        localStorage.setItem("google_client_id", clientId);
      } else {
        return;
      }
    }

    if (clientId) {
      try {
        if (typeof google === "undefined" || !google.accounts) {
          showToast("Google OAuth SDK loading... Please wait a second.");
          return;
        }
        
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "profile email",
          callback: (response) => {
            if (response.error) {
              console.error(response.error);
              showToast("Google authorization declined.");
              return;
            }
            if (response.access_token) {
              fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${response.access_token}`)
              .then(res => res.json())
              .then(userInfo => {
                handleGoogleLoginSuccess(userInfo.name, userInfo.email, userInfo.picture || userInfo.avatar);
              })
              .catch(err => {
                console.error(err);
                showToast("Failed to fetch Google profile details.");
              });
            }
          }
        });
        tokenClient.requestAccessToken();
      } catch (err) {
        console.error("Google login initialization error:", err);
        showToast("Invalid Client ID or SDK initialization failed.");
      }
    }
  });
}

const linkConfigureGoogleId = document.getElementById("link-configure-google-id");
if (linkConfigureGoogleId) {
  linkConfigureGoogleId.addEventListener("click", (e) => {
    e.preventDefault();
    const currentId = localStorage.getItem("google_client_id") || "";
    const userInput = prompt("Please paste your Google OAuth Client ID here:\n(e.g., xxxxxxx.apps.googleusercontent.com)", currentId);
    if (userInput !== null) {
      const trimmed = userInput.trim();
      if (trimmed) {
        localStorage.setItem("google_client_id", trimmed);
        showToast("Google Client ID configured successfully! 🔑");
      } else {
        localStorage.removeItem("google_client_id");
        showToast("Google Client ID cleared.");
      }
    }
  });
}

window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "GOOGLE_SIGNIN_SUCCESS") {
    const { name, email, avatar } = event.data.user;
    handleGoogleLoginSuccess(name, email, avatar);
  }
});

// Avatar upload trigger
let signupAvatarDataUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80";
const signupAvatarInput = document.getElementById("signup-avatar-input");
const signupAvatarPreview = document.getElementById("signup-avatar-preview");

if (signupAvatarInput && signupAvatarPreview) {
  signupAvatarInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      signupAvatarDataUrl = event.target.result;
      signupAvatarPreview.src = signupAvatarDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

// Submit login
if (authLoginForm) {
  authLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    })
    .then(res => {
      if (!res.ok) throw new Error("Invalid login email or password.");
      return res.json();
    })
    .then(data => {
      localStorage.setItem("pastelly_user", JSON.stringify(data.user));
      showToast(`Welcome back, ${data.user.name}! 🌸`);
      initSession();
    })
    .catch(err => {
      console.error(err);
      showToast(err.message || "Login failed.");
    });
  });
}

// Submit signup with password checks
if (authSignupForm) {
  authSignupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    
    // Password validation logic
    if (password.length < 8 || password.length > 12) {
      showToast("Password must be between 8 and 12 characters long!");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showToast("Password must contain at least one uppercase letter!");
      return;
    }
    if (!/[a-z]/.test(password)) {
      showToast("Password must contain at least one lowercase letter!");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      showToast("Password must contain at least one special character!");
      return;
    }
    
    fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, avatar: signupAvatarDataUrl })
    })
    .then(res => {
      if (!res.ok) throw new Error("Signup failed. Email may already be registered.");
      return res.json();
    })
    .then(data => {
      localStorage.setItem("pastelly_user", JSON.stringify(data.user));
      showToast(`Signup successful! Welcome, ${data.user.name}! ✨`);
      initSession();
    })
    .catch(err => {
      console.error(err);
      showToast(err.message || "Signup failed.");
    });
  });
}

if (document.getElementById("profile-widget-trigger")) {
  document.getElementById("profile-widget-trigger").addEventListener("dblclick", () => {
    localStorage.removeItem("pastelly_user");
    showToast("Logged out of session. Cozy vibes await!");
    location.reload();
  });
}

// 3. Washi Tape Connecting mode
const btnTapeConnectMode = document.getElementById("btn-tape-connect-mode");
if (btnTapeConnectMode) {
  btnTapeConnectMode.addEventListener("click", () => {
    washiTapeMode = !washiTapeMode;
    washiSelectedCardId = null;
    
    if (washiTapeMode) {
      btnTapeConnectMode.classList.add("active-tab");
      showToast("Tape Mode ON: Click card A then card B to link them!");
    } else {
      btnTapeConnectMode.classList.remove("active-tab");
      showToast("Tape Mode deactivated.");
    }
  });
}

function handleWashiCardSelection(cardId) {
  if (!washiTapeMode) return false;
  
  if (!washiSelectedCardId) {
    washiSelectedCardId = cardId;
    showToast("A selected. Click second card to link!");
  } else {
    if (washiSelectedCardId === cardId) {
      washiSelectedCardId = null;
      showToast("Deselected.");
      return true;
    }
    
    const newLink = {
      id: `washi-${Date.now()}`,
      cardIdA: washiSelectedCardId,
      cardIdB: cardId
    };
    washiLinks.push(newLink);
    renderWashiTapes();
    
    washiSelectedCardId = null;
    washiTapeMode = false;
    btnTapeConnectMode.classList.remove("active-tab");
    showToast("Washi Tape linked successfully! 🌸");
  }
  return true;
}

function renderWashiTapes() {
  const container = document.getElementById("canvas-container");
  if (!container) return;
  
  document.querySelectorAll(".washi-tape-link").forEach(el => el.remove());
  
  washiLinks.forEach(link => {
    const cardElA = document.querySelector(`[data-id="${link.cardIdA}"]`);
    const cardElB = document.querySelector(`[data-id="${link.cardIdB}"]`);
    if (!cardElA || !cardElB) return;
    
    const rectA = cardElA.getBoundingClientRect();
    const rectB = cardElB.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    const xA = (rectA.left + rectA.width / 2) - containerRect.left;
    const yA = (rectA.top + rectA.height / 2) - containerRect.top;
    const xB = (rectB.left + rectB.width / 2) - containerRect.left;
    const yB = (rectB.top + rectB.height / 2) - containerRect.top;
    
    const distance = Math.sqrt((xB - xA) * (xB - xA) + (yB - yA) * (yB - yA));
    const angle = Math.atan2(yB - yA, xB - xA) * 180 / Math.PI;
    
    const tape = document.createElement("div");
    tape.className = "washi-tape-link";
    tape.style.left = `${xA}px`;
    tape.style.top = `${yA}px`;
    tape.style.width = `${distance}px`;
    tape.style.transform = `rotate(${angle}deg)`;
    tape.textContent = "🌸 Washi Link 🌸";
    
    container.appendChild(tape);
  });
}

// 4. Dot Journal Grid paper overlay
const btnToggleBujoGrid = document.getElementById("btn-toggle-bujo-grid");
if (btnToggleBujoGrid) {
  btnToggleBujoGrid.addEventListener("click", () => {
    bujoGridActive = !bujoGridActive;
    const canvasContainer = document.getElementById("canvas-container");
    if (canvasContainer) {
      if (bujoGridActive) {
        canvasContainer.classList.add("dot-grid-active");
        btnToggleBujoGrid.classList.add("active-tab");
      } else {
        canvasContainer.classList.remove("dot-grid-active");
        btnToggleBujoGrid.classList.remove("active-tab");
      }
    }
    showToast(bujoGridActive ? "Dot-Journal Grid paper toggled ON! 📓" : "Grid paper toggled OFF.");
  });
}

// 5. Polaroid Quote Generator
const cozyQuotes = [
  "Cozy days and sweet coffee breaks.",
  "In a room full of art, I'd still stare at the pastel sky.",
  "Create your own gravity-free workspace.",
  "Mellow yellow and peach blossom haze.",
  "Always choose pastel sunset lanes.",
  "Lofi tapes, warm crackles, and cozy fireplaces."
];

const btnQuoteGeneratorTrigger = document.getElementById("btn-quote-generator-trigger");
if (btnQuoteGeneratorTrigger) {
  btnQuoteGeneratorTrigger.addEventListener("click", () => {
    if (!currentUser) {
      showToast("Please log in first!");
      return;
    }
    const quote = cozyQuotes[Math.floor(Math.random() * cozyQuotes.length)];
    
    const newQuoteCard = {
      id: `card-quote-${Date.now()}`,
      boardId: activeBoardId,
      title: "Cozy Inspiration Quote 🌸",
      category: "notes",
      description: quote,
      author: userProfile.name,
      authorAvatar: userProfile.avatar,
      tags: ["poetry", "inspiration"],
      sticker: "✨ Sparkles",
      font: "serif",
      border: "solid",
      bgColor: "peach",
      size: "normal",
      visual: {
        type: "note"
      },
      extractedColors: ["#F9DCC0", "#FFE5E7", "#FFC6CA", "#FFD3D6"],
      physics: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200, base_y: 150, phase: 0 },
      likesCount: 0,
      liked: false,
      captureDate: null,
      comments: []
    };

    fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
      body: JSON.stringify(newQuoteCard)
    })
    .then(r => r.json())
    .then(savedCard => {
      moodCards.unshift(savedCard);
      if (gravityActive) {
        toggleGravityMode(true);
      } else {
        renderMoodGrid();
      }
      showToast("Spawned polaroid quote card! 📜");
    });
  });
}

// 6. Smart Palette Harmonizer
function harmonizeBoardPalette() {
  const activeCards = moodCards.filter(c => c.boardId === activeBoardId);
  if (activeCards.length === 0) {
    showToast("Create some cards to harmonize color swatches!");
    return;
  }
  
  let colorsList = [];
  activeCards.forEach(c => {
    if (c.extractedColors) colorsList.push(...c.extractedColors);
  });
  
  if (colorsList.length === 0) {
    colorsList = ["#FFB0B5", "#FFE5E7", "#FFC6CA", "#F9DCC0"];
  }
  
  const uniqueColors = [...new Set(colorsList)].slice(0, 4);
  while (uniqueColors.length < 4) {
    uniqueColors.push(["#FFB0B5", "#FFE5E7", "#FFC6CA", "#F9DCC0"][uniqueColors.length]);
  }
  
  const activeB = boards.find(b => b.id === activeBoardId);
  if (activeB) {
    activeB.theme = uniqueColors[0];
    
    fetch(`/api/boards/${activeBoardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
      body: JSON.stringify({ theme: uniqueColors[0] })
    })
    .then(r => r.json())
    .then(() => {
      updateBoardHeaders();
      showToast("Color swatches harmonized to board mood! 🎨");
    });
  }
}

// 7. Interactive Monthly Calendar Mood Tracker
let calendarCurrentDate = new Date();
let selectedMood = "Cozy";
let selectedColor = "#FFE5E7";

const moodLogModal = document.getElementById("mood-log-modal");
const moodLogTitle = document.getElementById("mood-log-title");
const moodLogForm = document.getElementById("mood-log-form");
const moodLogDateInput = document.getElementById("mood-log-date");
const moodTagInput = document.getElementById("mood-tag-input");
const moodNoteInput = document.getElementById("mood-note-input");
const btnCloseMoodLog = document.getElementById("btn-close-mood-log");

if (btnCloseMoodLog) {
  btnCloseMoodLog.addEventListener("click", () => {
    moodLogModal.classList.add("hidden");
    moodLogModal.style.display = "none";
  });
}
if (moodLogModal) {
  moodLogModal.addEventListener("click", (e) => {
    if (e.target === moodLogModal) {
      moodLogModal.classList.add("hidden");
      moodLogModal.style.display = "none";
    }
  });
}

function openMoodLogModal(dateString) {
  if (!currentUser) {
    showToast("Please log in first!");
    return;
  }
  
  if (moodLogDateInput) moodLogDateInput.value = dateString;
  if (moodLogTitle) moodLogTitle.textContent = `Log Vibe: ${dateString}`;
  
  const existing = userLoggedMoods.find(m => m.date === dateString);
  if (existing) {
    selectedMood = existing.mood;
    selectedColor = existing.color;
    if (moodTagInput) moodTagInput.value = existing.tag || "";
    if (moodNoteInput) moodNoteInput.value = existing.note || "";
    highlightMoodPickerButton(existing.mood);
  } else {
    selectedMood = "Cozy";
    selectedColor = "#FFE5E7";
    if (moodTagInput) moodTagInput.value = "Creative";
    if (moodNoteInput) moodNoteInput.value = "";
    highlightMoodPickerButton("Cozy");
  }
  
  if (moodLogModal) {
    moodLogModal.classList.remove("hidden");
    moodLogModal.style.display = "flex";
  }
}

document.querySelectorAll(".mood-picker-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    selectedMood = e.currentTarget.getAttribute("data-mood");
    selectedColor = e.currentTarget.getAttribute("data-color");
    highlightMoodPickerButton(selectedMood);
  });
});

function highlightMoodPickerButton(mood) {
  document.querySelectorAll(".mood-picker-btn").forEach(btn => {
    if (btn.getAttribute("data-mood") === mood) {
      btn.style.borderColor = "var(--text-brand)";
      btn.style.boxShadow = "0 0 8px rgba(255, 176, 185, 0.5)";
    } else {
      btn.style.borderColor = "var(--panel-border)";
      btn.style.boxShadow = "none";
    }
  });
}

if (moodLogForm) {
  moodLogForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const date = moodLogDateInput.value;
    const tag = moodTagInput.value.trim();
    const note = moodNoteInput.value.trim();
    
    fetch("/api/moods", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
      body: JSON.stringify({ date, mood: selectedMood, color: selectedColor, tag, note })
    })
    .then(r => r.json())
    .then(loggedEntry => {
      const idx = userLoggedMoods.findIndex(m => m.date === loggedEntry.date);
      if (idx > -1) {
        userLoggedMoods[idx] = loggedEntry;
      } else {
        userLoggedMoods.push(loggedEntry);
      }
      renderMoodTrackerGrid();
      
      if (moodLogModal) {
        moodLogModal.classList.add("hidden");
        moodLogModal.style.display = "none";
      }
      showToast(`Mood logged successfully! 🌸`);
    })
    .catch(err => {
      console.error(err);
      showToast("Failed to log mood.");
    });
  });
}

function renderMoodTrackerGrid() {
  const grid = document.getElementById("mood-tracker-grid");
  const monthYearDisplay = document.getElementById("calendar-month-year");
  if (!grid) return;
  grid.innerHTML = "";
  
  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();
  
  const monthName = calendarCurrentDate.toLocaleString("default", { month: "long" });
  if (monthYearDisplay) {
    monthYearDisplay.textContent = `${monthName} ${year}`;
  }
  
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  
  // Render empty padding squares from previous month
  for (let i = firstDayIndex; i > 0; i--) {
    const pad = document.createElement("div");
    pad.style.opacity = "0.2";
    pad.style.fontSize = "8px";
    pad.style.padding = "3px";
    pad.style.textAlign = "center";
    pad.style.color = "var(--text-secondary)";
    pad.textContent = prevMonthDays - i + 1;
    grid.appendChild(pad);
  }
  
  // Render active month days
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("div");
    cell.style.borderRadius = "4px";
    cell.style.fontSize = "8px";
    cell.style.padding = "3px";
    cell.style.textAlign = "center";
    cell.style.cursor = "pointer";
    cell.style.border = "1px solid var(--panel-border)";
    cell.style.background = "rgba(255, 255, 255, 0.25)";
    cell.style.transition = "transform 0.15s ease, background-color 0.15s ease";
    cell.textContent = day;
    
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const logged = userLoggedMoods.find(m => m.date === dateString);
    
    if (logged) {
      cell.style.backgroundColor = logged.color;
      cell.style.color = "var(--text-brand)";
      cell.style.fontWeight = "bold";
      cell.style.border = "1.2px solid var(--text-brand)";
      cell.title = `${monthName} ${day}: ${logged.mood} (${logged.tag || "No Tag"}) ${logged.note ? `- ${logged.note}` : ""}`;
    } else {
      cell.style.color = "var(--text-secondary)";
      cell.title = `Click to log mood for ${monthName} ${day}`;
    }
    
    cell.addEventListener("mouseenter", () => {
      cell.style.transform = "scale(1.2)";
      cell.style.zIndex = "10";
    });
    cell.addEventListener("mouseleave", () => {
      cell.style.transform = "scale(1)";
      cell.style.zIndex = "1";
    });
    cell.addEventListener("click", () => {
      openMoodLogModal(dateString);
    });
    
    grid.appendChild(cell);
  }
}

// Calendar controls listeners
const btnCalPrev = document.getElementById("btn-calendar-prev");
const btnCalNext = document.getElementById("btn-calendar-next");

if (btnCalPrev) {
  btnCalPrev.addEventListener("click", () => {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
    renderMoodTrackerGrid();
  });
}
if (btnCalNext) {
  btnCalNext.addEventListener("click", () => {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
    renderMoodTrackerGrid();
  });
}

// 8. Weather selector logic
const selectLofiWeather = document.getElementById("select-lofi-weather");
if (selectLofiWeather) {
  selectLofiWeather.addEventListener("change", () => {
    const val = selectLofiWeather.value;
    
    if (lofiSynthActive) {
      stopLofiSynth();
      playLofiSynth(selectLofiTrack.value);
    }
    
    if (val === "rain") {
      particles.forEach(p => {
        p.speed = (Math.random() * 2 + 1) * 3;
        p.color = "#C4D4E0";
      });
      showToast("Weather set to Cozy Rain 🌧️");
    } else if (val === "snow") {
      particles.forEach(p => {
        p.speed = (Math.random() * 0.4 + 0.1) * 0.5;
        p.color = "#FFFFFF";
      });
      showToast("Weather set to Soft Snow ❄️");
    } else if (val === "fog") {
      particles.forEach(p => {
        p.speed = (Math.random() * 0.1 + 0.05);
        p.color = "#E5E1E6";
      });
      showToast("Weather set to Misty Fog 🌫️");
    } else {
      particles.forEach(p => p.reset());
      showToast("Weather cleared ☀️");
    }
  });
}

// Live Clock & Weather Widget logic
function updateCozyClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 12 instead of 0
  const timeStr = `${String(hours).padStart(2, '0')}:${minutes}`;
  
  const timeEl = document.getElementById("clock-time");
  const ampmEl = document.getElementById("clock-ampm");
  if (timeEl) timeEl.textContent = timeStr;
  if (ampmEl) ampmEl.textContent = ampm;
}

function getWeatherDescription(code) {
  if (code === 0) return { desc: "Clear Sky", icon: "☀️" };
  if (code >= 1 && code <= 3) return { desc: "Partly Cloudy", icon: "🌤️" };
  if (code === 45 || code === 48) return { desc: "Cozy Fog", icon: "🌫️" };
  if (code >= 51 && code <= 55) return { desc: "Light Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 65) return { desc: "Cozy Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { desc: "Soft Snow", icon: "❄️" };
  if (code >= 80 && code <= 82) return { desc: "Rain Showers", icon: "🌦️" };
  if (code >= 95 && code <= 99) return { desc: "Stormy Vibe", icon: "⛈️" };
  return { desc: "Cozy Day", icon: "🌸" };
}

function initCozyWeather() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchLiveWeather(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.warn("Geolocation failed. Fallback to default.", error);
        fetchLiveWeather(51.5074, -0.1278); // Fallback London
      }
    );
  } else {
    fetchLiveWeather(51.5074, -0.1278);
  }
}

function fetchLiveWeather(lat, lon) {
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
  .then(res => {
    if (!res.ok) throw new Error("Weather request failed.");
    return res.json();
  })
  .then(data => {
    const current = data.current_weather;
    if (current) {
      const temp = Math.round(current.temperature);
      const wDetails = getWeatherDescription(current.weathercode);
      
      const iconEl = document.getElementById("weather-icon");
      const tempEl = document.getElementById("weather-temp");
      const descEl = document.getElementById("weather-desc");
      
      if (iconEl) iconEl.textContent = wDetails.icon;
      if (tempEl) tempEl.textContent = `${temp}°C`;
      if (descEl) {
        descEl.textContent = wDetails.desc;
        descEl.title = wDetails.desc;
      }
    }
  })
  .catch(err => {
    console.error("Fetch weather failed:", err);
    const descEl = document.getElementById("weather-desc");
    if (descEl) descEl.textContent = "Offline Vibe";
  });
}

// 9. Bootstrap & Physics overrides
function startPastelly() {
  initSession();
  
  resizeBgCanvas();
  initBgParticles();
  animateBgParticles();
  
  updateCozyClock();
  setInterval(updateCozyClock, 1000);
  initCozyWeather();
  
  setInterval(renderWashiTapes, 100);
}

window.addEventListener("load", startPastelly);
