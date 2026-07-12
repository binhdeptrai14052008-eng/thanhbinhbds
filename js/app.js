import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
  firebaseConfig,
  COLLECTION_NAME,
  SITE_CONFIG
} from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const state = {
  items: [],
  activeCategory: "all",
  keyword: "",
  selected: null,
  gallery: [],
  galleryIndex: 0
};

const labels = {
  "dat-nen": "Đất nền",
  "nha-pho": "Nhà phố",
  "can-ho": "Căn hộ",
  "nha-vuon": "Nhà vườn",
  "dat-nong-nghiep": "Đất nông nghiệp",
  "nghi-duong": "BĐS nghỉ dưỡng",
  "du-an": "Dự án"
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
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
        const path = parts
          .slice(blobIndex + 2)
          .map((part) => encodeURIComponent(decodeURIComponent(part)))
          .join("/");

        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      }
    }
  } catch {
    return url;
  }

  return url;
}

function statusText(status) {
  if (status === "da-ban") return "Đã bán";
  if (status === "da-coc") return "Đã cọc";
  if (status === "tam-an") return "Tạm ẩn";
  return "Đang chào bán";
}

function setupContacts() {
  $$("[data-phone]").forEach((el) => {
    el.textContent = SITE_CONFIG.phoneDisplay;
    el.href = `tel:${SITE_CONFIG.phone}`;
  });

  $$("[data-zalo]").forEach((el) => {
    el.href = SITE_CONFIG.zaloUrl;
  });

  $$("[data-facebook]").forEach((el) => {
    el.href = SITE_CONFIG.facebookUrl;
  });

  $$("[data-tiktok]").forEach((el) => {
    el.href = SITE_CONFIG.tiktokUrl;
  });
}

function filteredItems() {
  return state.items.filter((item) => {
    const categoryOk =
      state.activeCategory === "all" ||
      item.category === state.activeCategory;

    const searchable = `${item.title || ""} ${item.location || ""}`.toLowerCase();
    const keywordOk =
      !state.keyword ||
      searchable.includes(state.keyword);

    return item.status !== "tam-an" && categoryOk && keywordOk;
  });
}

function renderProperties() {
  const grid = $("#propertyGrid");
  const empty = $("#emptyState");
  if (!grid || !empty) return;

  const list = filteredItems();
  grid.innerHTML = "";

  list.forEach((item) => {
    const image =
      normalizeImageUrl(item.image) ||
      normalizeImageUrl(Array.isArray(item.images) ? item.images[0] : "") ||
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80";

    const card = document.createElement("article");
    card.className = "property-card";
    card.innerHTML = `
      <button class="property-card__media" type="button" aria-label="Xem chi tiết">
        <img
          src="${escapeHtml(image)}"
          alt="${escapeHtml(item.title || "Bất động sản")}"
          loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80'"
        >
        <span class="property-status">${escapeHtml(statusText(item.status))}</span>
      </button>

      <div class="property-card__body">
        <span class="property-category">${escapeHtml(labels[item.category] || "Bất động sản")}</span>
        <h3>${escapeHtml(item.title || "Chưa có tiêu đề")}</h3>

        <p class="property-location">
          <i class="fa-solid fa-location-dot"></i>
          ${escapeHtml(item.location || "Khánh Hòa")}
        </p>

        <div class="property-meta">
          <span><i class="fa-solid fa-ruler-combined"></i>${escapeHtml(item.area || "Đang cập nhật")}</span>
          <span><i class="fa-solid fa-file-shield"></i>${escapeHtml(item.legal || "Đang cập nhật")}</span>
        </div>

        <div class="property-card__footer">
          <strong>${escapeHtml(item.price || "Liên hệ")}</strong>
          <button class="detail-button" type="button">Xem chi tiết</button>
        </div>
      </div>
    `;

    $$(".property-card__media, .detail-button", card).forEach((button) => {
      button.addEventListener("click", () => openDetail(item));
    });

    grid.appendChild(card);
  });

  empty.hidden = list.length > 0;
}

function setModalText(selector, value) {
  const el = $(selector);
  if (el) el.textContent = value || "";
}

function asList(value) {
  return String(value || "")
    .split(/\r?\n|•/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderList(selector, value) {
  const el = $(selector);
  if (!el) return;

  const items = asList(value);
  el.innerHTML = items.length
    ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Đang cập nhật</li>";
}

function openDetail(item) {
  state.selected = item;

  const images = Array.isArray(item.images)
    ? item.images.map(normalizeImageUrl).filter(Boolean)
    : [];

  const cover = normalizeImageUrl(item.image);
  if (cover && !images.includes(cover)) images.unshift(cover);

  state.gallery = images.length
    ? images
    : ["https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80"];
  state.galleryIndex = 0;

  setModalText("#detailCategory", labels[item.category] || "Bất động sản");
  setModalText("#detailStatus", statusText(item.status));
  setModalText("#detailTitle", item.title || "Chưa có tiêu đề");
  setModalText("#detailPrice", item.price || "Liên hệ");
  setModalText("#detailArea", item.area || "Đang cập nhật");
  setModalText("#detailLocation", item.location || "Khánh Hòa");
  setModalText("#detailLegal", item.legal || "Đang cập nhật");
  setModalText("#detailDescription", item.description || "Đang cập nhật");

  renderList("#detailTraffic", item.traffic);
  renderList("#detailUtilities", item.utilities);
  renderList("#detailResort", item.resort);
  renderList("#detailInvestment", item.investment);

  const mainImage = $("#detailMainImage");
  mainImage.src = state.gallery[0];

  const thumbs = $("#detailThumbs");
  thumbs.innerHTML = state.gallery
    .map((src, index) => `
      <button class="detail-thumb ${index === 0 ? "active" : ""}" type="button" data-index="${index}">
        <img src="${escapeHtml(src)}" alt="Ảnh ${index + 1}">
      </button>
    `)
    .join("");

  $$(".detail-thumb", thumbs).forEach((button) => {
    button.addEventListener("click", () => {
      state.galleryIndex = Number(button.dataset.index);
      updateGallery();
    });
  });

  const modal = $("#detailModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function updateGallery() {
  const src = state.gallery[state.galleryIndex];
  $("#detailMainImage").src = src;

  $$(".detail-thumb").forEach((button, index) => {
    button.classList.toggle("active", index === state.galleryIndex);
  });
}

function closeDetail() {
  const modal = $("#detailModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function setupNavigation() {
  const menuButton = $("#menuButton");
  const nav = $("#mainNav");

  menuButton.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
  });

  $$("#mainNav a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

function setupFilters() {
  $$(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCategory = button.dataset.category;

      $$(".filter-button").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      renderProperties();
    });
  });

  $("#propertySearch").addEventListener("input", (event) => {
    state.keyword = event.target.value.trim().toLowerCase();
    renderProperties();
  });
}

function setupModal() {
  $("#closeDetail").addEventListener("click", closeDetail);

  $("#detailModal").addEventListener("click", (event) => {
    if (event.target.id === "detailModal") closeDetail();
  });

  $("#galleryPrev").addEventListener("click", () => {
    state.galleryIndex =
      (state.galleryIndex - 1 + state.gallery.length) %
      state.gallery.length;
    updateGallery();
  });

  $("#galleryNext").addEventListener("click", () => {
    state.galleryIndex =
      (state.galleryIndex + 1) %
      state.gallery.length;
    updateGallery();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetail();
  });
}

onSnapshot(
  collection(db, COLLECTION_NAME),
  (snapshot) => {
    state.items = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

    renderProperties();
  },
  (error) => {
    console.error("Không thể tải dữ liệu Firestore:", error);
    $("#emptyState").hidden = false;
    $("#emptyState").textContent = "Không thể tải dữ liệu bất động sản.";
  }
);

setupContacts();
setupNavigation();
setupFilters();
setupModal();
