import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
  firebaseConfig,
  COLLECTION_NAME
} from "../js/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let items = [];
let unsubscribeSnapshot = null;
let unsubscribeLeads = null;
let leads = [];

const $ = (id) => document.getElementById(id);

const fields = [
  "title",
  "slug",
  "category",
  "status",
  "price",
  "area",
  "location",
  "legal",
  "image",
  "images",
  "video",
  "coordinates",
  "map",
  "description",
  "traffic",
  "utilities",
  "resort",
  "investment"
];

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
  "da-ban": "Đã bán",
  "tam-an": "Tạm ẩn"
};


function extractCoordinates(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";

  const match = text.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!match) return "";

  const lat = Number(match[1]);
  const lng = Number(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return "";

  return `${lat},${lng}`;
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeImageUrl(value = "") {
  const url = String(value).trim();

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
        const filePath = parts.slice(blobIndex + 2).map(encodeURIComponent).join("/");

        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
      }
    }

    return url;
  } catch {
    return url;
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function showLoginError(message = "") {
  $("loginError").textContent = message;
}

function showFormMessage(message = "", isError = false) {
  const element = $("formMessage");
  element.textContent = message;
  element.style.color = isError ? "#c93434" : "#08745a";
}

function getErrorMessage(error) {
  const code = error?.code || "";

  const messages = {
    "auth/invalid-credential": "Sai email hoặc mật khẩu.",
    "auth/invalid-email": "Email không hợp lệ.",
    "auth/user-disabled": "Tài khoản này đã bị khóa.",
    "auth/too-many-requests": "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.",
    "auth/network-request-failed": "Không thể kết nối Firebase. Kiểm tra mạng rồi thử lại.",
    "permission-denied": "Tài khoản không có quyền thực hiện thao tác này."
  };

  return messages[code] || error?.message || "Đã xảy ra lỗi. Vui lòng thử lại.";
}

function hideAllViews() {
  $("listView").classList.add("hidden");
  $("formView").classList.add("hidden");
  $("leadsView").classList.add("hidden");
}

function setActiveNav(view) {
  document.querySelectorAll(".nav").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
}

function showList() {
  hideAllViews();
  $("listView").classList.remove("hidden");
  $("pageTitle").textContent = "Danh sách bất động sản";
  $("addBtn").style.display = "";
  setActiveNav("list");
  showFormMessage("");
}

function showForm(editing = false) {
  hideAllViews();
  $("formView").classList.remove("hidden");
  $("pageTitle").textContent = editing
    ? "Sửa bất động sản"
    : "Thêm bất động sản";
  $("addBtn").style.display = "";
  setActiveNav("form");
  showFormMessage("");
}

function showLeads() {
  hideAllViews();
  $("leadsView").classList.remove("hidden");
  $("pageTitle").textContent = "Khách hàng quan tâm";
  $("addBtn").style.display = "none";
  setActiveNav("leads");
  renderLeads();
}

function resetForm() {
  $("propertyForm").reset();
  $("docId").value = "";
  $("status").value = "dang-ban";
  $("featured").checked = false;
  showFormMessage("");
}

function render() {
  const keyword = $("searchInput").value.trim().toLowerCase();
  const category = $("filterCategory").value;

  const filteredItems = items.filter((item) => {
    const categoryMatched =
      category === "all" || item.category === category;

    const searchableText = `${item.title || ""} ${item.location || ""}`.toLowerCase();
    const keywordMatched =
      keyword === "" || searchableText.includes(keyword);

    return categoryMatched && keywordMatched;
  });

  if (filteredItems.length === 0) {
    $("propertyList").innerHTML =
      '<div class="form-card">Chưa có bất động sản phù hợp.</div>';
    return;
  }

  $("propertyList").innerHTML = filteredItems.map((item) => {
    const image = normalizeImageUrl(item.image) || "../assets/images/video-poster.jpg";
    const title = item.title || "Chưa có tiêu đề";
    const categoryLabel = labels[item.category] || item.category || "Khác";
    const statusLabel = statusLabels[item.status] || item.status || "Đang chào bán";

    return `
      <div class="property-row">
        <img
          src="${escapeHtml(image)}"
          alt="${escapeHtml(title)}"
          onerror="this.src='../assets/images/video-poster.jpg'"
        >

        <div>
          <h3>${escapeHtml(title)}</h3>

          <div>
            <span class="badge">${escapeHtml(categoryLabel)}</span>
            <span class="badge">${escapeHtml(statusLabel)}</span>
          </div>

          <div class="meta">
            ${escapeHtml(item.price || "Chưa có giá")}
            · ${escapeHtml(item.area || "")}
            · ${escapeHtml(item.location || "")}
          </div>
        </div>

        <div class="row-actions">
          <button type="button" data-edit="${item.id}">Sửa</button>
          <button type="button" class="danger" data-delete="${item.id}">Xóa</button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      editProperty(button.dataset.edit);
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      removeProperty(button.dataset.delete);
    });
  });
}

function listenForProperties() {
  if (typeof unsubscribeSnapshot === "function") {
    unsubscribeSnapshot();
  }

  unsubscribeSnapshot = onSnapshot(
    collection(db, COLLECTION_NAME),
    (snapshot) => {
      items = snapshot.docs
        .map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data()
        }))
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

      render();
    },
    (error) => {
      console.error("Firestore snapshot error:", error);
      $("propertyList").innerHTML = `
        <div class="form-card error">
          Không thể tải dữ liệu: ${escapeHtml(getErrorMessage(error))}
        </div>
      `;
    }
  );
}

function editProperty(id) {
  const item = items.find((entry) => entry.id === id);

  if (!item) {
    alert("Không tìm thấy bất động sản này.");
    return;
  }

  resetForm();
  $("docId").value = id;

  fields.forEach((field) => {
    const element = $(field);
    if (!element) return;

    if (field === "images") {
      element.value = Array.isArray(item.images)
        ? item.images.join("\n")
        : item.images || "";
    } else {
      element.value = item[field] || "";
    }
  });

  $("featured").checked = Boolean(item.featured);
  showForm(true);
}

async function removeProperty(id) {
  const item = items.find((entry) => entry.id === id);
  const title = item?.title || "bất động sản này";

  const confirmed = window.confirm(`Xóa "${title}"?`);

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error("Delete error:", error);
    alert(`Không thể xóa: ${getErrorMessage(error)}`);
  }
}


function leadTime(value) {
  if (!value) return "Vừa gửi";
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Vừa gửi";
  return date.toLocaleString("vi-VN");
}

function renderLeads() {
  const keyword = ($("leadSearch")?.value || "").trim().toLowerCase();
  const status = $("leadStatusFilter")?.value || "all";

  const filtered = leads.filter((lead) => {
    const searchable = `${lead.name || ""} ${lead.phone || ""} ${lead.propertyTitle || ""}`.toLowerCase();
    return (status === "all" || lead.status === status) &&
      (!keyword || searchable.includes(keyword));
  });

  if (!filtered.length) {
    $("leadList").innerHTML = '<div class="form-card">Chưa có khách hàng phù hợp.</div>';
    return;
  }

  $("leadList").innerHTML = filtered.map((lead) => `
    <article class="lead-row">
      <div class="lead-main">
        <div class="lead-title">
          <strong>${escapeHtml(lead.name || "Khách chưa nhập tên")}</strong>
          <span class="badge ${lead.status === "da-lien-he" ? "done" : "new"}">
            ${lead.status === "da-lien-he" ? "Đã liên hệ" : "Mới"}
          </span>
        </div>
        <a class="lead-phone" href="tel:${escapeHtml(lead.phone || "")}">
          ${escapeHtml(lead.phone || "Không có số điện thoại")}
        </a>
        <p><b>BĐS:</b> ${escapeHtml(lead.propertyTitle || "Không rõ")}</p>
        ${lead.note ? `<p><b>Nội dung:</b> ${escapeHtml(lead.note)}</p>` : ""}
        <small>${escapeHtml(leadTime(lead.createdAt))}</small>
      </div>
      <div class="lead-actions">
        ${lead.propertyUrl ? `<a href="${escapeHtml(lead.propertyUrl)}" target="_blank">Mở tin</a>` : ""}
        <button data-lead-status="${lead.id}" type="button">
          ${lead.status === "da-lien-he" ? "Đánh dấu mới" : "Đã liên hệ"}
        </button>
        <button data-lead-delete="${lead.id}" class="danger" type="button">Xóa</button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-lead-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const lead = leads.find((item) => item.id === button.dataset.leadStatus);
      if (!lead) return;
      await updateDoc(doc(db, "leads", lead.id), {
        status: lead.status === "da-lien-he" ? "moi" : "da-lien-he",
        updatedAt: serverTimestamp()
      });
    });
  });

  document.querySelectorAll("[data-lead-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Xóa liên hệ này?")) return;
      await deleteDoc(doc(db, "leads", button.dataset.leadDelete));
    });
  });
}

function listenForLeads() {
  if (typeof unsubscribeLeads === "function") unsubscribeLeads();

  unsubscribeLeads = onSnapshot(
    query(collection(db, "leads"), orderBy("createdAt", "desc")),
    (snapshot) => {
      leads = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      if (!$("leadsView").classList.contains("hidden")) renderLeads();
    },
    (error) => {
      console.error("Leads snapshot error:", error);
      $("leadList").innerHTML = `<div class="form-card error">Không thể tải khách quan tâm: ${escapeHtml(getErrorMessage(error))}</div>`;
    }
  );
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  showLoginError("");

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    showLoginError("Vui lòng nhập đầy đủ email và mật khẩu.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Login error:", error);
    showLoginError(getErrorMessage(error));
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
    alert(getErrorMessage(error));
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    $("userEmail").textContent = user.email || "";
    listenForProperties();
    listenForLeads();
  } else {
    $("loginView").classList.remove("hidden");
    $("appView").classList.add("hidden");

    if (typeof unsubscribeSnapshot === "function") {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }

    if (typeof unsubscribeLeads === "function") {
      unsubscribeLeads();
      unsubscribeLeads = null;
    }
  }
});

$("propertyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  showFormMessage("");

  const data = {};

  fields.forEach((field) => {
    const value = $(field).value;

    if (field === "images") {
      data.images = value
        .split(/\r?\n/)
        .map((line) => normalizeImageUrl(line))
        .filter(Boolean);
    } else if (field === "image") {
      data.image = normalizeImageUrl(value);
    } else {
      data[field] = value.trim();
    }
  });

  data.slug = data.slug || slugify(data.title);
  data.coordinates =
    extractCoordinates(data.coordinates) ||
    extractCoordinates(data.map);

  data.featured = $("featured").checked;
  data.updatedAt = serverTimestamp();

  if (!data.image && data.images.length > 0) {
    data.image = data.images[0];
  }

  try {
    const documentId = $("docId").value.trim();

    if (documentId) {
      await updateDoc(
        doc(db, COLLECTION_NAME, documentId),
        data
      );
    } else {
      data.createdAt = serverTimestamp();

      await addDoc(
        collection(db, COLLECTION_NAME),
        data
      );
    }

    showFormMessage("Đã lưu thành công.");
    resetForm();
    showList();
  } catch (error) {
    console.error("Save error:", error);
    showFormMessage(`Lỗi: ${getErrorMessage(error)}`, true);
  }
});

$("addBtn").addEventListener("click", () => {
  resetForm();
  showForm(false);
});

$("cancelBtn").addEventListener("click", () => {
  resetForm();
  showList();
});

document.querySelectorAll(".nav").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav").forEach((navButton) => {
      navButton.classList.remove("active");
    });

    button.classList.add("active");

    if (button.dataset.view === "form") {
      resetForm();
      showForm(false);
    } else {
      showList();
    }
  });
});

$("searchInput").addEventListener("input", render);
$("filterCategory").addEventListener("change", render);

$("title").addEventListener("blur", () => { if (!$("slug").value.trim()) $("slug").value = slugify($("title").value); });


document.querySelectorAll(".nav").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (view === "list") showList();
    if (view === "form") {
      resetForm();
      showForm(false);
    }
    if (view === "leads") showLeads();
  });
});

$("leadSearch")?.addEventListener("input", renderLeads);
$("leadStatusFilter")?.addEventListener("change", renderLeads);
