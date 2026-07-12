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
import { firebaseConfig, COLLECTION_NAME } from "../js/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let items = [];
let unsubscribeSnapshot = null;
const $ = (id) => document.getElementById(id);

const fields = [
  "title", "category", "status", "price", "area", "location", "legal",
  "image", "images", "video", "map", "description", "traffic",
  "utilities", "resort", "investment"
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

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function errorMessage(error) {
  const messages = {
    "auth/invalid-credential": "Sai email hoặc mật khẩu.",
    "auth/invalid-email": "Email không hợp lệ.",
    "auth/user-disabled": "Tài khoản đã bị khóa.",
    "auth/too-many-requests": "Đăng nhập sai quá nhiều lần. Hãy thử lại sau.",
    "auth/network-request-failed": "Không thể kết nối Firebase. Kiểm tra mạng rồi thử lại.",
    "permission-denied": "Tài khoản không có quyền thực hiện thao tác này."
  };
  return messages[error?.code] || error?.message || "Đã xảy ra lỗi.";
}

function setLoginError(message = "") {
  $("loginError").textContent = message;
}

function setFormMessage(message = "", isError = false) {
  const element = $("formMessage");
  element.textContent = message;
  element.style.color = isError ? "#c93434" : "#08745a";
}

function showList() {
  $("formView").classList.add("hidden");
  $("listView").classList.remove("hidden");
  $("pageTitle").textContent = "Danh sách bất động sản";
  setFormMessage();
}

function showForm(editing = false) {
  $("listView").classList.add("hidden");
  $("formView").classList.remove("hidden");
  $("pageTitle").textContent = editing ? "Sửa bất động sản" : "Thêm bất động sản";
  setFormMessage();
}

function resetForm() {
  $("propertyForm").reset();
  $("docId").value = "";
  $("status").value = "dang-ban";
  $("featured").checked = false;
  setFormMessage();
}

function render() {
  const keyword = $("searchInput").value.trim().toLowerCase();
  const category = $("filterCategory").value;
  const list = items.filter((item) => {
    const categoryOK = category === "all" || item.category === category;
    const text = `${item.title || ""} ${item.location || ""}`.toLowerCase();
    return categoryOK && (!keyword || text.includes(keyword));
  });

  if (!list.length) {
    $("propertyList").innerHTML = '<div class="form-card">Chưa có bất động sản phù hợp.</div>';
    return;
  }

  $("propertyList").innerHTML = list.map((item) => {
    const image = item.image || "../assets/images/video-poster.jpg";
    const title = item.title || "Chưa có tiêu đề";
    return `
      <div class="property-row">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}"
             onerror="this.src='../assets/images/video-poster.jpg'">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <div>
            <span class="badge">${escapeHtml(labels[item.category] || item.category || "Khác")}</span>
            <span class="badge">${escapeHtml(statusLabels[item.status] || item.status || "Đang chào bán")}</span>
          </div>
          <div class="meta">${escapeHtml(item.price || "Chưa có giá")} · ${escapeHtml(item.area || "")} · ${escapeHtml(item.location || "")}</div>
        </div>
        <div class="row-actions">
          <button type="button" data-edit="${item.id}">Sửa</button>
          <button type="button" class="danger" data-delete="${item.id}">Xóa</button>
        </div>
      </div>`;
  }).join("");

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => editProperty(button.dataset.edit));
  });
  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => removeProperty(button.dataset.delete));
  });
}

function listenForProperties() {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  unsubscribeSnapshot = onSnapshot(
    collection(db, COLLECTION_NAME),
    (snapshot) => {
      items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      render();
    },
    (error) => {
      console.error(error);
      $("propertyList").innerHTML = `<div class="form-card error">Không thể tải dữ liệu: ${escapeHtml(errorMessage(error))}</div>`;
    }
  );
}

function editProperty(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return alert("Không tìm thấy bất động sản này.");
  resetForm();
  $("docId").value = id;
  fields.forEach((field) => {
    const element = $(field);
    if (field === "images") {
      element.value = Array.isArray(item.images) ? item.images.join("\n") : (item.images || "");
    } else {
      element.value = item[field] || "";
    }
  });
  $("featured").checked = Boolean(item.featured);
  showForm(true);
}

async function removeProperty(id) {
  const item = items.find((entry) => entry.id === id);
  if (!confirm(`Xóa "${item?.title || "bất động sản này"}"?`)) return;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error(error);
    alert(`Không thể xóa: ${errorMessage(error)}`);
  }
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginError();
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) return setLoginError("Vui lòng nhập đầy đủ email và mật khẩu.");
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error(error);
    setLoginError(errorMessage(error));
  }
});

$("logoutBtn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    $("userEmail").textContent = user.email || "";
    listenForProperties();
  } else {
    $("loginView").classList.remove("hidden");
    $("appView").classList.add("hidden");
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  }
});

$("propertyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormMessage();
  const data = {};
  fields.forEach((field) => {
    if (field === "images") {
      data.images = $(field).value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    } else {
      data[field] = $(field).value.trim();
    }
  });
  data.featured = $("featured").checked;
  data.updatedAt = serverTimestamp();
  if (!data.image && data.images.length) data.image = data.images[0];

  try {
    const id = $("docId").value.trim();
    if (id) {
      await updateDoc(doc(db, COLLECTION_NAME, id), data);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, COLLECTION_NAME), data);
    }
    resetForm();
    showList();
  } catch (error) {
    console.error(error);
    setFormMessage(`Lỗi: ${errorMessage(error)}`, true);
  }
});

$("addBtn").addEventListener("click", () => { resetForm(); showForm(false); });
$("cancelBtn").addEventListener("click", () => { resetForm(); showList(); });
$("searchInput").addEventListener("input", render);
$("filterCategory").addEventListener("change", render);

document.querySelectorAll(".nav").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    if (button.dataset.view === "form") {
      resetForm();
      showForm(false);
    } else {
      showList();
    }
  });
});
