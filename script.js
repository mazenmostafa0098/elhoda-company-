const CONFIG = {
  requiredStatuses: ["منفذ", "معاينة", "سحب", "سحب للمصنع"],
  MAX_VIDEO_SIZE_MB: 100,
  API_URL: "https://script.google.com/macros/s/AKfycbzi4V5C-njBWH8x5F693b6-gWZeEuBPsanpO_fdbMjq4xEBgcSgvRH0NdWY5Ux9Z1nM6A/exec"
};

let state = {
  selectedTech: null,
  isSubmitting: false,
  uploadedFiles: {},
  signaturePad: null,
  db: null,
  debounceTimer: null
};

const DBHandler = {
  init: () => new Promise((resolve, reject) => {
    const request = indexedDB.open("OfflineReportsDB", 1);
    request.onupgradeneeded = (event) => {
      state.db = event.target.result;
      if (!state.db.objectStoreNames.contains("reports")) {
        state.db.createObjectStore("reports", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = (event) => {
      state.db = event.target.result;
      resolve();
    };
    request.onerror = () => reject("فشل فتح قاعدة البيانات");
  }),

  saveReport: (reportData) => new Promise((resolve, reject) => {
    const transaction = state.db.transaction(["reports"], "readwrite");
    const store = transaction.objectStore("reports");
    const request = store.add(reportData);
    request.onsuccess = () => resolve();
    request.onerror = () => reject("فشل الحفظ المحلي");
  })
};

const FileManager = {
  handleUpload: (inputElement) => {
    const file = inputElement.files[0];
    const elementId = inputElement.id;
    const statusSpan = document.getElementById(`${elementId}Status`);
    if (!file || !ValidationManager.validateSelections()) {
      FileManager.clearFileStatus(elementId, statusSpan);
      return;
    }
    if (file.type.startsWith("video/") && !ValidationManager.validateVideoSize(file)) return;
    FileManager.updateFileStatus(elementId, statusSpan, file.name);
  },
  clearFileStatus: (elementId, statusSpan) => {
    delete state.uploadedFiles[elementId];
    if (statusSpan) {
      statusSpan.textContent = "";
      statusSpan.className = "file-upload-status";
    }
  },
  updateFileStatus: (elementId, statusSpan, fileName) => {
    state.uploadedFiles[elementId] = fileName;
    if (statusSpan) {
      statusSpan.textContent = "تم الرفع ✔";
      statusSpan.className = "file-upload-status success";
    }
    FormValidator.checkFormValidity();
  }
};

const ValidationManager = {
  validateSelections: () => {
    const isValid = document.getElementById("techName").value && document.getElementById("clientName").value;
    if (!isValid) alert("❗ يرجى اختيار الفني والعميل أولاً");
    return isValid;
  },
  validateVideoSize: (file) => {
    const maxSize = CONFIG.MAX_VIDEO_SIZE_MB * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`حجم الفيديو يجب ألا يتجاوز ${CONFIG.MAX_VIDEO_SIZE_MB}MB`);
      return false;
    }
    return true;
  },
  validateRequiredFields: () => {
    const requiredFields = { techName: "اسم الفني", clientName: "اسم العميل", reportNumber: "رقم البلاغ", collectedAmountFromClient: "المبلغ المحصل" };
    for (const [field, name] of Object.entries(requiredFields)) {
      const element = document.getElementById(field);
      if (!element.value.trim()) {
        FormValidator.showFieldError(element, name);
        return false;
      }
    }
    return true;
  }
};

const FormManager = {
  initSelections: async () => {
    try {
      const response = await fetch(`${CONFIG.API_URL}?action=getTechnicians`);
      if (!response.ok) throw new Error("فشل جلب البيانات");
      const techs = await response.json();
      const techSelect = document.getElementById("techName");
      techSelect.innerHTML = '<option value="">اختر الفني</option>';
      techs.data.forEach(tech => techSelect.add(new Option(tech.name, tech.name)));
    } catch (error) {
      alert("❗ تعذر تحميل بيانات الفنيين");
    }
  },
  toggleSections: (showClient = false, showReport = false) => {
    document.getElementById("clientSection").classList.toggle("hidden", !showClient);
    document.getElementById("reportSection").classList.toggle("hidden", !showReport);
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  await DBHandler.init();
  FormManager.initSelections();
  document.getElementById("techName").addEventListener("change", () => {
    state.selectedTech = document.getElementById("techName").value;
    document.getElementById("passwordSection").classList.remove("hidden");
  });
  document.getElementById("submitButton").addEventListener("click", async () => {
    if (state.isSubmitting || !ValidationManager.validateRequiredFields()) return;
    state.isSubmitting = true;
    try {
      const reportData = {}; // Add data collection logic here
      if (navigator.onLine) {
        await fetch(CONFIG.API_URL, { method: "POST", body: JSON.stringify(reportData) });
      } else {
        await DBHandler.saveReport(reportData);
        alert("تم الحفظ محليًا، سيتم الإرسال عند توفر اتصال");
      }
      window.location.reload();
    } catch (error) {
      alert("حدث خطأ أثناء الإرسال");
    } finally {
      state.isSubmitting = false;
    }
  });
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js");
}
