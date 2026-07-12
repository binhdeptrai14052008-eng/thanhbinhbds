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
let unsubscribe = null;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

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
  "description",
  "traffic",
  "utilities",
  "resort",
  "investment"
];

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

function message(text = "", error = false) {
  const el = $("#formMessage");
  el.textContent = text;
  el.classList.toggle("error", error);
}

function loginMessage(text = "") {
  $("#loginError").textContent = text;
}

function authError(error) {
  const messages = {
    "auth/invalid-credential": "Sai email hoặc mật khẩu.",
    "auth/invalid-email": "Email không hợp lệ.",
    "auth/too-many-requests": "Thử sai quá nhiều lần. Vui lòng thử lại sau."
  };

  return messages[error?.code] || error?.message || "Có lỗi xảy ra.";
}

function showList() {
  $("#formView").hidden = true;
  $("#listView").hidden = false;
  $("#pageTitle").textContent = "Danh sách bất động sản";
}

function showForm(editing = false) {
  $("#listView").hidden = true;
  $("#formView").hidden = false;
  $("#pageTitle").textContent = editing
    ? "Sửa bất động sản"
    : "Thêm bất động sản";
}

function resetForm() {
  $("#propertyForm").reset();
  $("#docId").value = "";
  $("#status").value = "dang-ban";
  $("#featured").checked = false;
  message("");
}

function render() {
  const keyword = $("#searchInput").value.trim().toLowerCase();
  const category = $("#filterCategory").value;

  const list = items.filter((item) => {
    const categoryOk =
      category === "all" ||
      item.category === category;

    const searchable =
      `${item.title || ""} ${item.location || ""}`.toLowerCase();

    return categoryOk &&
      (!keyword || searchable.includes(keyword));
  });

  const container = $("#propertyList");

  if (!list.length) {
    container.innerHTML =
      '<div class="admin-empty">Chưa có bất động sản phù hợp.</div>';
    return;
  }

  container.innerHTML = list.map((item) => {
    const image =
      normalizeImageUrl(item.image) ||
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80";

    return `
      <article class="admin-property">
        <img src="${image}" alt="">
        <div>
          <h3>${item.title || "Chưa có tiêu đề"}</h3>
          <p>${item.location || "Chưa có vị trí"}</p>
          <strong>${item.price || "Chưa có giá"}</strong>
        </div>
        <div class="admin-property__actions">
          <button type="button" data-edit="${item.id}">Sửa</button>
          <button type="button" class="danger" data-delete="${item.id}">Xóa</button>
        </div>
      </article>
    `;
  }).join("");

  $$("[data-edit]", container).forEach((button) => {
    button.addEventListener("click", () => editItem(button.dataset.edit));
  });

  $$("[data-delete]", container).forEach((button) => {
    button.addEventListener("click", () => deleteItem(button.dataset.delete));
  });
}

function listen() {
  if (unsubscribe) unsubscribe();

  unsubscribe = onSnapshot(
    collection(db, COLLECTION_NAME),
    (snapshot) => {
      items = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

      render();
    },
    (error) => {
      console.error(error);
      $("#propertyList").innerHTML =
        '<div class="admin-empty">Không thể tải dữ liệu.</div>';
    }
  );
}

function editItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  resetForm();
  $("#docId").value = id;

  fields.forEach((field) => {
    const element = document.getElementById(field);
    if (!element) return;

    if (field === "images") {
      element.value = Array.isArray(item.images)
        ? item.images.join("\n")
        : item.images || "";
    } else {
      element.value = item[field] || "";
    }
  });

  $("#featured").checked = Boolean(item.featured);
  showForm(true);
}

async function deleteItem(id) {
  const item = items.find((entry) => entry.id === id);
  const title = item?.title || "bất động sản này";

  if (!confirm(`Xóa "${title}"?`)) return;

  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    alert(error.message);
  }
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage("");

  try {
    await signInWithEmailAndPassword(
      auth,
      $("#email").value.trim(),
      $("#password").value
    );
  } catch (error) {
    loginMessage(authError(error));
  }
});

$("#logoutButton").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    $("#userEmail").textContent = user.email || "";
    listen();
  } else {
    $("#loginView").hidden = false;
    $("#appView").hidden = true;

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }
});

$("#propertyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  message("");

  const data = {};

  fields.forEach((field) => {
    const element = document.getElementById(field);
    const value = element.value;

    if (field === "images") {
      data.images = value
        .split(/\r?\n/)
        .map(normalizeImageUrl)
        .filter(Boolean);
    } else if (field === "image") {
      data.image = normalizeImageUrl(value);
    } else {
      data[field] = value.trim();
    }
  });

  data.featured = $("#featured").checked;
  data.updatedAt = serverTimestamp();

  if (!data.image && data.images.length) {
    data.image = data.images[0];
  }

  try {
    const id = $("#docId").value.trim();

    if (id) {
      await updateDoc(doc(db, COLLECTION_NAME, id), data);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, COLLECTION_NAME), data);
    }

    resetForm();
    showList();
  } catch (error) {
    message(error.message, true);
  }
});

$("#addButton").addEventListener("click", () => {
  resetForm();
  showForm(false);
});

$("#cancelButton").addEventListener("click", () => {
  resetForm();
  showList();
});

$("#searchInput").addEventListener("input", render);
$("#filterCategory").addEventListener("change", render);
