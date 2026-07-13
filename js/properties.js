import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig, COLLECTION_NAME } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const grid = document.getElementById("propertyGrid");
const emptyState = document.getElementById("emptyState");

let properties = [];
let activeCategory = "all";
let keyword = "";

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
  let url = String(value || "").trim();
  if (!url) return "";
  try {
    url = decodeURIComponent(url);
  } catch {}
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "github.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const blobIndex = parts.indexOf("blob");
      if (blobIndex >= 0 && parts.length > blobIndex + 2) {
        const owner = parts[0];
        const repo = parts[1];
        const branch = parts[blobIndex + 1];
        const filePath = parts.slice(blobIndex + 2).map(part => encodeURIComponent(part)).join("/");
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
      }
    }
  } catch {}
  return url;
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "bat-dong-san";
}

function landingUrl(item) {
  const slug = item.slug || `${slugify(item.title)}-${item.id}`;
  return `/p/?id=${encodeURIComponent(item.id)}&slug=${encodeURIComponent(slug)}`;
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
  if (!grid || !emptyState) return;
  grid.querySelectorAll(".property-card").forEach((card) => card.remove());
  const list = visibleProperties();

  list.forEach((item) => {
    const card = document.createElement("article");
    card.className = "property-card";
    card.dataset.type = item.category || "";
    card.dataset.name = item.title || "";
    const href = landingUrl(item);
    card.innerHTML = `
      <a class="property-image" href="${href}" aria-label="Xem ngay ${escapeHtml(item.title || "Bất động sản")}">
        <img loading="lazy" src="${escapeHtml(normalizeImageUrl(item.image) || "assets/images/video-poster.jpg")}" onerror="this.src='assets/images/video-poster.jpg'" alt="${escapeHtml(item.title || "Bất động sản")}">
        <span class="tag">${escapeHtml(statusLabels[item.status] || "Đang chào bán")}</span>
        <button class="heart" type="button" aria-label="Lưu tin"><i class="fa-regular fa-heart"></i></button>
      </a>
      <div class="property-body">
        <span class="property-type">${escapeHtml(labels[item.category] || item.category || "Bất động sản")}</span>
        <h3><a href="${href}">${escapeHtml(item.title || "Chưa có tiêu đề")}</a></h3>
        <div class="location"><i class="fa-solid fa-location-dot"></i>${escapeHtml(item.location || "")}</div>
        <div class="features">
          <span><i class="fa-solid fa-ruler-combined"></i>${escapeHtml(item.area || "")}</span>
          <span><i class="fa-solid fa-file-shield"></i>${escapeHtml(item.legal || "")}</span>
        </div>
        <div class="price-row">
          <span class="price">${escapeHtml(item.price || "Liên hệ")}</span>
          <a class="detail-link" href="${href}">Xem ngay →</a>
        </div>
      </div>`;

    card.querySelector(".heart").addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation();
      const icon = event.currentTarget.querySelector("i");
      icon.classList.toggle("fa-regular"); icon.classList.toggle("fa-solid");
    });
    grid.insertBefore(card, emptyState);
  });
  emptyState.style.display = list.length ? "none" : "block";
}

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

onSnapshot(collection(db, COLLECTION_NAME), (snapshot) => {
  const allDocs = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  properties = allDocs.filter((item) => item.status !== "tam-an");
  render();
}, (error) => {
  console.error("Không thể tải bất động sản:", error);
  if (emptyState) {
    emptyState.style.display = "block";
    const title = emptyState.querySelector("h3");
    const text = emptyState.querySelector("p");
    if (title) title.textContent = "Không thể tải sản phẩm";
    if (text) text.textContent = "Vui lòng tải lại trang hoặc kiểm tra kết nối Firebase.";
  }
});
