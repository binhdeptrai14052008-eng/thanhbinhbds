import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig, COLLECTION_NAME } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const grid = document.getElementById("propertyGrid");
const emptyState = document.getElementById("emptyState");

let properties = [];
let activeCategory = "all";
let keyword = "";
let firebaseReady = false;

const labels = {
  "dat-nen": "Đất nền",
  "nha-pho": "Nhà phố",
  "can-ho": "Căn hộ",
  "nha-vuon": "Nhà vườn",
  "dat-nong-nghiep": "Đất nông nghiệp",
  "nghi-duong": "BĐS nghỉ dưỡng",
  "du-an": "Dự án"
};

const statusLabels = {
  "dang-ban": "Đang chào bán",
  "da-coc": "Đã cọc",
  "da-ban": "Đã bán"
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}


function normalizeImageUrl(value = "") {
  const url = String(value || "").trim();
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (parsed.hostname === "github.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const blobIndex = parts.indexOf("blob");
      if (blobIndex >= 0 && parts.length > blobIndex + 2) {
        const owner = parts[0];
        const repo = parts[1];
        const branch = parts[blobIndex + 1];
        const filePath = parts.slice(blobIndex + 2)
          .map(part => encodeURIComponent(decodeURIComponent(part)))
          .join("/");
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
      }
    }
  } catch (error) {
    return url;
  }
  return url;
}

function visibleProperties() {
  return properties.filter((item) => {
    if (item.status === "tam-an") return false;
    const categoryOK = activeCategory === "all" || item.category === activeCategory;
    const text = `${item.title || ""} ${item.location || ""}`.toLowerCase();
    return categoryOK && (!keyword || text.includes(keyword));
  });
}

function render() {
  if (!firebaseReady || !grid) return;
  grid.querySelectorAll(".property-card").forEach((card) => card.remove());
  const list = visibleProperties();

  list.forEach((item) => {
    const card = document.createElement("article");
    card.className = "property-card";
    card.dataset.type = item.category || "";
    card.dataset.name = item.title || "";
    card.innerHTML = `
      <div class="property-image">
        <img loading="lazy" src="${escapeHtml(normalizeImageUrl(item.image) || "assets/images/video-poster.jpg")}" onerror="this.src='assets/images/video-poster.jpg'" alt="${escapeHtml(item.title || "Bất động sản")}">
        <span class="tag">${escapeHtml(statusLabels[item.status] || "Đang chào bán")}</span>
        <button class="heart" type="button" aria-label="Lưu tin"><i class="fa-regular fa-heart"></i></button>
      </div>
      <div class="property-body">
        <span class="property-type">${escapeHtml(labels[item.category] || item.category || "Bất động sản")}</span>
        <h3>${escapeHtml(item.title || "Chưa có tiêu đề")}</h3>
        <div class="location"><i class="fa-solid fa-location-dot"></i>${escapeHtml(item.location || "")}</div>
        <div class="features">
          <span><i class="fa-solid fa-ruler-combined"></i>${escapeHtml(item.area || "")}</span>
          <span><i class="fa-solid fa-file-shield"></i>${escapeHtml(item.legal || "")}</span>
        </div>
        <div class="price-row">
          <span class="price">${escapeHtml(item.price || "Liên hệ")}</span>
          <span class="detail-link">Xem chi tiết →</span>
        </div>
      </div>`;

    card.addEventListener("click", () => openProperty(item));
    card.querySelector(".heart").addEventListener("click", (event) => {
      event.stopPropagation();
      const icon = event.currentTarget.querySelector("i");
      icon.classList.toggle("fa-regular");
      icon.classList.toggle("fa-solid");
    });
    grid.insertBefore(card, emptyState);
  });

  emptyState.style.display = list.length ? "none" : "block";
}

function listItems(value) {
  return String(value || "").split(/\r?\n|•/).map((line) => line.trim()).filter(Boolean)
    .map((line) => `<li>${escapeHtml(line)}</li>`).join("");
}

function youtubeId(url = "") {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?v=|embed\/))([\w-]{6,})/);
  return match ? match[1] : "";
}

function openProperty(item) {
  const modal = document.getElementById("propertyModal");
  if (!modal) return;

  modal.querySelector(".property-type").textContent = `${labels[item.category] || item.category || "Bất động sản"} · ${statusLabels[item.status] || "Đang chào bán"}`;
  modal.querySelector(".detail-info h3").textContent = item.title || "";
  modal.querySelector(".detail-price").textContent = item.price || "Liên hệ";
  modal.querySelector(".detail-note").textContent = item.description || "";
  modal.querySelector(".detail-badges").innerHTML = `
    <span><i class="fa-solid fa-ruler-combined"></i> ${escapeHtml(item.area || "")}</span>
    <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(item.location || "")}</span>
    <span><i class="fa-solid fa-file-shield"></i> ${escapeHtml(item.legal || "")}</span>`;

  const images = Array.isArray(item.images) ? item.images.map(normalizeImageUrl).filter(Boolean) : [];
  const coverImage = normalizeImageUrl(item.image);
  if (coverImage && !images.includes(coverImage)) images.unshift(coverImage);
  window.galleryImages = images.length ? images : ["assets/images/video-poster.jpg"];
  window.currentLightboxIndex = 0;
  document.getElementById("mainDetailImage").src = window.galleryImages[0];
  modal.querySelector(".gallery-grid").innerHTML = window.galleryImages.map((url, index) =>
    `<img loading="lazy" src="${escapeHtml(url)}" alt="${escapeHtml(item.title || "Bất động sản")} ${index + 1}" onclick="openLightboxBySrc(this.src)">`
  ).join("");

  const boxes = modal.querySelectorAll(".detail-box ul");
  [item.traffic, item.utilities, item.resort, item.investment].forEach((value, index) => {
    if (boxes[index]) boxes[index].innerHTML = listItems(value);
  });

  const id = youtubeId(item.video || "");
  modal.querySelector(".video-wrap").innerHTML = id
    ? `<div class="youtube-short"><iframe src="https://www.youtube.com/embed/${id}" title="${escapeHtml(item.title || "Video bất động sản")}" loading="lazy" frameborder="0" allowfullscreen></iframe></div>`
    : "<p>Chưa có video.</p>";

  if (typeof window.openPropertyDetail === "function") {
    window.openPropertyDetail();
  } else {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }
}

// Thay các nút lọc bằng bản sao để loại bỏ listener cũ của HTML tĩnh.
document.querySelectorAll(".filter-btn").forEach((oldButton) => {
  const button = oldButton.cloneNode(true);
  oldButton.replaceWith(button);
  button.addEventListener("click", () => {
    activeCategory = button.dataset.filter || "all";
    document.querySelectorAll(".filter-btn").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

window.searchProperties = () => {
  activeCategory = document.getElementById("typeFilter")?.value || "all";
  keyword = (document.getElementById("keyword")?.value || "").trim().toLowerCase();
  render();
  document.getElementById("properties")?.scrollIntoView({ behavior: "smooth" });
};

onSnapshot(
  collection(db, COLLECTION_NAME),
  (snapshot) => {
    const allDocs = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    // Chỉ thay sản phẩm mẫu khi Firestore đã có ít nhất một tin hợp lệ.
    properties = allDocs.filter((item) => item.title && item.category);
    firebaseReady = properties.length > 0;
    if (firebaseReady) render();
  },
  (error) => console.error("Không thể tải bất động sản:", error)
);
