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
  serverTimestamp
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

const $ = (id) => document.getElementById(id);

const fields = [
  "title",
  "category",
  "status",
  "price",
  "area",
  "location",
  "legal",
  "image",
  "images",
  "video",
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

function showList() {
  $("formView").classList.add("hidden");
  $("listView").classList.remove("hidden");
  $("pageTitle").textContent = "Danh sách bất động sản";
  showFormMessage("");
}

function showForm(editing = false) {
  $("listView").classList.add("hidden");
  $("formView").classList.remove("hidden");
  $("pageTitle").textContent = editing
    ? "Sửa bất động sản"
    : "Thêm bất động sản";
  showFormMessage("");
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
    const image = item.image || "../assets/images/video-poster.jpg";
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
  } else {
    $("loginView").classList.remove("hidden");
    $("appView").classList.add("hidden");

    if (typeof unsubscribeSnapshot === "function") {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
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
