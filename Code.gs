// SPREADSHEET_ID = "1tRMjPks698vlieYnjjz_S6TPhnBhsDxvugzJ4z4Awtg"
// Nama Sheet: "Register"
//
// Tempatkan file ini di Google Apps Script editor Anda,
// lalu deploy sebagai Web App (Aplikasi Web) dengan akses: "Siapa saja (Anyone)".

var SPREADSHEET_ID = "1tRMjPks698vlieYnjjz_S6TPhnBhsDxvugzJ4z4Awtg";

function doGet(e) {
  var email = e.parameter.email;
  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Email required" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Register");
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ status: "not_found", message: "Sheet Register tidak ditemukan" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var data = sheet.getDataRange().getValues();
  var found = false;
  var userRow = null;
  var count = 0;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().toLowerCase() === email.toLowerCase()) {
      found = true;
      userRow = data[i];
      count++;
    }
  }
  
  if (found && userRow) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      registered: true,
      count: count,
      user: {
        email: userRow[0],
        telpon: userRow[1],
        koordinat: userRow[2],
        timestamp: userRow[3],
        status: userRow[4]
      }
    })).setMimeType(ContentService.MimeType.JSON);
  } else {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      registered: false,
      count: 0
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var postData;
  try {
    postData = JSON.parse(e.postData.contents);
  } catch (err) {
    postData = e.parameter;
  }
  
  var email = postData.email;
  var telpon = postData.telpon;
  var koordinat = postData.koordinat;
  
  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Email required" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("Register");
  if (!sheet) {
    sheet = ss.insertSheet("Register");
    sheet.appendRow(["Email", "Telpon", "Koordinat", "LoginTimeStamp", "Status"]);
  }
  
  var data = sheet.getDataRange().getValues();
  var count = 0;
  var existingRowIndex = -1;
  var currentStatus = 1;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().toLowerCase() === email.toLowerCase()) {
      count++;
      existingRowIndex = i + 1;
      currentStatus = data[i][4];
    }
  }
  
  var timestamp = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  
  if (count >= 1) {
    sheet.appendRow([email, telpon, koordinat, timestamp, 1]);
    return ContentService.createTextOutput(JSON.stringify({
      status: "blocked",
      message: "Anda Harus Meminta Admin untuk Mengupdate Agar bisa di gunakan",
      email: email,
      telpon: telpon,
      koordinat: koordinat,
      count: count + 1
    })).setMimeType(ContentService.MimeType.JSON);
  } else {
    sheet.appendRow([email, telpon, koordinat, timestamp, 1]);
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Registrasi Berhasil!",
      email: email,
      telpon: telpon,
      koordinat: koordinat,
      count: 1
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
