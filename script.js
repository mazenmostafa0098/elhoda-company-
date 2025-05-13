//════════════════════════════════════════════════════════════════════════════════════════════════════
// ██ CONFIGURATION (الإعدادات)
//════════════════════════════════════════════════════════════════════════════════════════════════════
const SPREADSHEET_ID = '1EvgdIeotF6fxOTQXfsBOq5xIa62oysaoNGSd1YNK2Lo';
const DRIVE_FOLDER_ID = '1zBDAXNyZXirunr_e9nreXMKxYW83U_HX';
const TECH_SHEET = 'الفنيين';
const CLIENTS_SHEET = 'العملاء';
const REPORTS_SHEET = 'التقارير';

//════════════════════════════════════════════════════════════════════════════════════════════════════
// ██ MAIN FUNCTIONS (الدوال الرئيسية)
//════════════════════════════════════════════════════════════════════════════════════════════════════

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ██ HANDLE GET REQUESTS (معالجة طلبات الجلب)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function doGet(e) {
  try {
    const action = e.parameter.action;
    switch (action) {
      case 'getTechnicians':
        return _createResponse(_getTechnicians());
      case 'getClients':
        return _createResponse(_getClients());
      default:
        throw new Error('❗ الطلب غير معروف');
    }
  } catch (error) {
    return _createErrorResponse(error);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ██ HANDLE POST REQUESTS (معالجة طلبات الإرسال)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const processedData = _handleFileUploads(data);
    _saveToSpreadsheet(processedData);
    return _createSuccessResponse();
  } catch (error) {
    Logger.log(`❌ خطأ: ${error.message}`);
    return _createErrorResponse(error);
  }
}

//════════════════════════════════════════════════════════════════════════════════════════════════════
// ██ CORE FUNCTIONALITIES (الوظائف الأساسية)
//════════════════════════════════════════════════════════════════════════════════════════════════════

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ██ FILE UPLOAD HANDLER (معالجة رفع الملفات)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _handleFileUploads(data) {
  const UPLOAD_FIELDS = ['serialImage', 'modelImage', 'invoice', 'warrantyImage', 'video1', 'video2', 'otherImage', 'signature'];
  const clientFolderName = `${data.clientName}_${data.reportNumber}`;
  const mainFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const clientFolder = mainFolder.createFolder(clientFolderName);

  UPLOAD_FIELDS.forEach(field => {
    if (data[field]) {
      const fileBlob = Utilities.newBlob(
        Utilities.base64Decode(data[field].content),
        data[field].type,
        `${clientFolderName}_${field}.${data[field].ext}`
      );
      const uploadedFile = clientFolder.createFile(fileBlob);
      data[field] = uploadedFile.getUrl();
    }
  });
  return data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ██ DATA SAVING (حفظ البيانات في الجداول)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _saveToSpreadsheet(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetName = _getTargetSheetName(data.status);
  const targetSheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  
  const reportRow = [
    Utilities.formatDate(new Date(), 'GMT+3', 'yyyy-MM-dd HH:mm'),
    data.techName,
    data.clientName,
    data.reportNumber,
    data.companyType,
    data.address,
    data.phone1,
    data.phone2,
    data.requiredCollection,
    data.fault,
    data.productType,
    data.adminNotes,
    data.serialText,
    data.serialImage,
    data.modelText,
    data.modelImage,
    data.invoice,
    data.warrantyImage,
    data.warrantyStatus,
    data.video1,
    data.video2,
    data.report,
    data.status,
    data.collectedAmountFromClient,
    data.otherImage,
    data.signature
  ];
  
  targetSheet.appendRow(reportRow);
}

//════════════════════════════════════════════════════════════════════════════════════════════════════
// ██ HELPER FUNCTIONS (الدوال المساعدة)
//════════════════════════════════════════════════════════════════════════════════════════════════════

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ██ DATA RETRIEVAL (جلب البيانات)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _getTechnicians() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(TECH_SHEET);
  const data = sheet.getDataRange().getValues();
  return data.slice(1).map(row => ({ 
    name: row[0], 
    password: row[1] 
  }));
}

function _getClients() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(CLIENTS_SHEET);
  const [headers, ...rows] = sheet.getDataRange().getValues();
  return rows.map(row => {
    const client = {};
    headers.forEach((header, index) => client[header] = row[index]);
    return client;
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ██ SHEET MAPPING (تعيين الجداول)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _getTargetSheetName(status) {
  const STATUS_SHEETS = {
    'مرتجع': 'المرتجع',
    'معاينة': 'معاينة',
    'سحب': 'سحب',
    'لاغى': 'لاغى'
  };
  return STATUS_SHEETS[status] || REPORTS_SHEET;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ██ RESPONSE HANDLING (معالجة الاستجابات)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ data }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}

function _createSuccessResponse() {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function _createErrorResponse(error) {
  return ContentService
    .createTextOutput(JSON.stringify({ 
      success: false, 
      error: error.message 
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}
