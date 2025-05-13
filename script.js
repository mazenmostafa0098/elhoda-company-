const CONFIG = {
  requiredStatuses: ["منفذ", "معاينة", "سحب", "سحب للمصنع"],
  MAX_VIDEO_SIZE_MB: 100,
  API_URL:
    "https://script.google.com/macros/s/AKfycbw8GHQg6kvaFm6CLz1PzoBzKFUid0GeHSkWE4Au-asgF71fTHBdd4Dvc1IjpES015P4XA/exec", // ← رابط النشر الجديد
};

// ------------------- المتغيرات العامة -------------------
let state = {
  selectedTech: null,
  isSubmitting: false,
  uploadedFiles: {},
  signaturePad: null,
  db: null,
  debounceTimer: null,
};

// ------------------- إدارة قاعدة البيانات -------------------
const DBHandler = {
  init: () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open("OfflineReportsDB", 1);

      request.onupgradeneeded = (event) => {
        state.db = event.target.result;
        if (!state.db.objectStoreNames.contains("reports")) {
          state.db.createObjectStore("reports", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      };

      request.onsuccess = (event) => {
        state.db = event.target.result;
        resolve();
      };

      request.onerror = () => reject("فشل فتح قاعدة البيانات");
    }),

  saveReport: (reportData) =>
    new Promise((resolve, reject) => {
      const transaction = state.db.transaction(["reports"], "readwrite");
      const store = transaction.objectStore("reports");
      const request = store.add(reportData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject("فشل الحفظ المحلي");
    }),

  deleteReport: (id) =>
    new Promise((resolve, reject) => {
      const transaction = state.db.transaction(["reports"], "readwrite");
      const store = transaction.objectStore("reports");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject();
    }),
};

// ------------------- إدارة الملفات -------------------
const FileManager = {
  handleUpload: (inputElement) => {
    const file = inputElement.files[0];
    const elementId = inputElement.id;
    const statusSpan = document.getElementById(`${elementId}Status`);

    if (!file) {
      FileManager.clearFileStatus(elementId, statusSpan);
      return;
    }

    if (!ValidationManager.validateSelections()) {
      FileManager.clearFileStatus(elementId, statusSpan);
      return;
    }

    if (file.type.startsWith("video/")) {
      if (!ValidationManager.validateVideoSize(file)) {
        FileManager.clearFileStatus(elementId, statusSpan);
        return;
      }
    }

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
  },
};

// ------------------- التحقق من الصحة -------------------
const ValidationManager = {
  validateSelections: () => {
    const isValid =
      document.getElementById("techName").value &&
      document.getElementById("clientName").value;
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
    const requiredFields = {
      techName: "اسم الفني",
      clientName: "اسم العميل",
      reportNumber: "رقم البلاغ",
      collectedAmountFromClient: "المبلغ المحصل",
    };

    for (const [field, name] of Object.entries(requiredFields)) {
      const element = document.getElementById(field);
      if (!element.value.trim()) {
        FormValidator.showFieldError(element, name);
        return false;
      }
    }
    return true;
  },
};

// ------------------- إدارة النماذج -------------------
const FormManager = {
  initSelections: async () => {
    try {
      const response = await fetch(`${CONFIG.API_URL}?action=getTechnicians`);
      if (!response.ok) throw new Error("فشل جلب البيانات");

      const techs = await response.json();
      const techSelect = document.getElementById("techName");
      techSelect.innerHTML = '<option value="">اختر الفني</option>';

      techs.data.forEach((tech) => {
        const option = new Option(tech.name, tech.name);
        techSelect.add(option);
      });
    } catch (error) {
      console.error("خطأ في جلب الفنيين:", error);
      alert("❗ تعذر تحميل بيانات الفنيين");
    }
  },

  toggleSections: (showClient = false, showReport = false) => {
    document
      .getElementById("clientSection")
      .classList.toggle("hidden", !showClient);
    document
      .getElementById("reportSection")
      .classList.toggle("hidden", !showReport);
  },

  fillClientDetails: () => {
    const clientSelect = document.getElementById("clientName");
    const selectedOption = clientSelect.options[clientSelect.selectedIndex];

    const fieldsMapping = {
      companyType: "company",
      address: "address",
      phone1: "phone1",
      phone2: "phone2",
      reportNumber: "reportnumber",
      requiredCollection: "requiredcollection",
      fault: "fault",
      productType: "producttype",
      adminNotes: "adminnotes",
    };

    Object.entries(fieldsMapping).forEach(([fieldId, dataKey]) => {
      document.getElementById(fieldId).value =
        selectedOption.dataset[dataKey] || "";
    });
  },

  clearForm: () => {
    // ... (الكود السابق مع تعديل لاستخدام state)
  },
};

// ------------------- الأحداث الرئيسية -------------------
document.addEventListener("DOMContentLoaded", async () => {
  await DBHandler.init();
  FormManager.initSelections();
  SignatureManager.init();
  EventHandlers.setup();
});

// ------------------- إدارة التوقيع -------------------
const SignatureManager = {
  init: () => {
    state.signaturePad = new SignaturePad(
      document.getElementById("signatureCanvas"),
      {
        backgroundColor: "rgb(255, 255, 255)",
      }
    );
  },

  clear: () => {
    state.signaturePad.clear();
    document.getElementById("signatureStatus").textContent = "";
    delete state.uploadedFiles.signature;
  },

  save: () => {
    const statusSpan = document.getElementById("signatureStatus");
    if (!state.signaturePad.isEmpty()) {
      state.uploadedFiles.signature = state.signaturePad.toDataURL();
      statusSpan.textContent = "تم حفظ التوقيع ✔";
      statusSpan.className = "file-upload-status success";
    }
  },
};

// ------------------- إدارة الأحداث -------------------
const EventHandlers = {
  setup: () => {
    document
      .getElementById("techName")
      .addEventListener("change", EventHandlers.onTechChange);
    document
      .getElementById("techPassword")
      .addEventListener("input", EventHandlers.onPasswordInput);
    document
      .getElementById("clientName")
      .addEventListener("change", FormManager.fillClientDetails);
    document
      .getElementById("submitButton")
      .addEventListener("click", EventHandlers.onSubmit);
    document.querySelectorAll('input[type="file"]').forEach((input) => {
      input.addEventListener("change", (e) =>
        FileManager.handleUpload(e.target)
      );
    });
    document
      .querySelector(".signature-buttons button:first-child")
      .addEventListener("click", SignatureManager.clear);
    document
      .querySelector(".signature-buttons button:last-child")
      .addEventListener("click", SignatureManager.save);
  },

  onTechChange: () => {
    state.selectedTech = document.getElementById("techName").value;
    document.getElementById("passwordSection").classList.remove("hidden");
    FormManager.toggleSections(false, false);
  },

  onPasswordInput: (e) => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      if (e.target.value.trim()) FormManager.toggleSections(true, false);
    }, 500);
  },

  onSubmit: async () => {
    if (state.isSubmitting || !FormValidator.validateForm()) return;

    state.isSubmitting = true;
    try {
      const reportData = FormManager.prepareData();

      if (navigator.onLine) {
        await APIHandler.sendToGoogleSheets(reportData);
      } else {
        await DBHandler.saveReport(reportData);
        alert("تم الحفظ محليًا، سيتم الإرسال عند توفر اتصال");
      }

      UIHandler.showSuccess();
    } catch (error) {
      UIHandler.showError(error);
    } finally {
      state.isSubmitting = false;
    }
  },
};

// ------------------- الواجهة البصرية -------------------
const UIHandler = {
  showLoading: () => {
    document.getElementById("loadingOverlay").classList.remove("hidden");
    document.getElementById("progressContainer").style.display = "block";
  },

  showSuccess: () => {
    document.getElementById("overallProgressText").textContent =
      "تم الإرسال بنجاح ✔";
    setTimeout(() => window.location.reload(), 1000);
  },

  showError: (error) => {
    console.error("فشل الإرسال:", error);
    document.getElementById("loadingOverlay").classList.add("hidden");
    alert("حدث خطأ أثناء الإرسال، يرجى المحاولة مرة أخرى");
  },
};

// ------------------- الاتصال بالخادم -------------------
const APIHandler = {
  sendToGoogleSheets: async (data) => {
    const response = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("فشل الإرسال");
  },
};

// ------------------- التحقق النهائي للنموذج -------------------
const FormValidator = {
  checkFormValidity: () => {
    const isValid =
      document.getElementById("clientName").value &&
      !document.querySelectorAll('#reportSection input[type="file"]:disabled')
        .length;
    document.getElementById("submitButton").disabled =
      !isValid || state.isSubmitting;
  },

  validateForm: () => {
    if (!ValidationManager.validateRequiredFields()) return false;

    // تحقق من وجود التوقيع
    if (!state.uploadedFiles.signature) {
      alert("❗ يرجى إضافة التوقيع");
      return false;
    }

    return true;
  },

  showFieldError: (element, fieldName) => {
    alert(`❗ حقل ${fieldName} مطلوب`);
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("invalid");
  },
};

// ------------------- Service Worker -------------------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "activated") {
          window.location.reload();
        }
      });
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
