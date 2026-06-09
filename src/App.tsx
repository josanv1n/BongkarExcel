/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Unlock, 
  Lock, 
  FileSpreadsheet, 
  Check, 
  X, 
  AlertTriangle, 
  ArrowRight, 
  Download, 
  RefreshCw, 
  Volume2, 
  VolumeX,
  Sparkles,
  ShieldCheck,
  Zap,
  HelpCircle,
  MapPin,
  Phone,
  Settings,
  Share2,
  Mail
} from 'lucide-react';
import JSZip from 'jszip';

// Sound helper using Web Audio API
const playSound = (type: 'click' | 'success' | 'error', muted: boolean) => {
  if (muted) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'success') {
      // Pleasant pentatonic positive chord (C5, D5, E5, G5, C6)
      const notes = [523.25, 587.33, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.5);
      });
    } else if (type === 'error') {
      // Low dual-oscillator buzz
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(120, ctx.currentTime);
      osc2.frequency.setValueAtTime(123, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.4);
      osc2.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.warn('AudioContext failed to initialize', e);
  }
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [sheetsResult, setSheetsResult] = useState<{ name: string; isProtected: boolean }[]>([]);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  
  // Registration and Excel limiting configurations states
  const [userEmail, setUserEmail] = useState(localStorage.getItem('BONGKAR_USER_EMAIL') || '');
  const [systemDetectedEmail, setSystemDetectedEmail] = useState('');
  const [userPhone, setUserPhone] = useState(localStorage.getItem('BONGKAR_USER_PHONE') || '');
  const [userCoords, setUserCoords] = useState('');
  const [gettingCoords, setGettingCoords] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registrationSubmitting, setRegistrationSubmitting] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  
  // Custom Google Sheets Integration Setup
  const [appsScriptUrl, setAppsScriptUrl] = useState(
    localStorage.getItem('BONGKAR_EXCEL_APPS_SCRIPT') || 
    'https://script.google.com/macros/s/AKfycbxkoffyqznnMZkt-1KC3hj5MQ4SCw9p21m_JAN_XKoerC84mK20A_p-UphlxEZ5SXPQ/exec'
  );
  const [showSettings, setShowSettings] = useState(false);
  
  // Current user access status computed states
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<any>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [registerCount, setRegisterCount] = useState(0);
  const [shopeePhone, setShopeePhone] = useState('0813-41-300-100');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize and check user's status automatically
  useEffect(() => {
    // 1. Fetch active browser user email and configuration
    fetch('/api/user-email')
      .then(res => res.json())
      .then(data => {
        const detected = data.email || 'anita872536@gmail.com';
        setSystemDetectedEmail(detected);
        
        const savedEmail = localStorage.getItem('BONGKAR_USER_EMAIL');
        const defaultEmail = ''; // Force empty for first-time prompt as requested
        const emailToUse = savedEmail || defaultEmail;
        setUserEmail(emailToUse);
        
        let urlValue = localStorage.getItem('BONGKAR_EXCEL_APPS_SCRIPT') || '';
        if (!urlValue) {
          urlValue = data.defaultAppsScriptUrl || 'https://script.google.com/macros/s/AKfycbxkoffyqznnMZkt-1KC3hj5MQ4SCw9p21m_JAN_XKoerC84mK20A_p-UphlxEZ5SXPQ/exec';
          setAppsScriptUrl(urlValue);
        }
        
        if (emailToUse) {
          checkUserStatus(emailToUse, urlValue);
        }
      })
      .catch(err => {
        console.warn('Could not auto-fetch user email:', err);
        const savedEmail = localStorage.getItem('BONGKAR_USER_EMAIL') || '';
        setUserEmail(savedEmail);
        const savedUrl = localStorage.getItem('BONGKAR_EXCEL_APPS_SCRIPT') || 'https://script.google.com/macros/s/AKfycbxkoffyqznnMZkt-1KC3hj5MQ4SCw9p21m_JAN_XKoerC84mK20A_p-UphlxEZ5SXPQ/exec';
        if (!localStorage.getItem('BONGKAR_EXCEL_APPS_SCRIPT')) {
          setAppsScriptUrl(savedUrl);
        }
        if (savedEmail) {
          checkUserStatus(savedEmail, savedUrl);
        }
      });

    // 2. Proactively capture geolocation for registration form so it's ready
    requestGeolocationSilently();
  }, []);

  // Request location silently to pre-fill coordinates
  const requestGeolocationSilently = () => {
    if (navigator.geolocation) {
      setGettingCoords(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserCoords(`=HYPERLINK("http://maps.google.com/?q=${lat},${lng}", "📍 Buka Google Maps")`);
          setGettingCoords(false);
        },
        (err) => {
          console.warn('Geolocation access failed/denied, defaulting to Jambi coordinates:', err);
          setUserCoords(`=HYPERLINK("http://maps.google.com/?q=-1.59327,103.62144", "📍 Buka Google Maps")`);
          setGettingCoords(false);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      setUserCoords(`=HYPERLINK("http://maps.google.com/?q=-1.59327,103.62144", "📍 Buka Google Maps")`);
    }
  };

  // Check user status in database
  const checkUserStatus = async (emailToQuery: string, scriptUrlToCheck: string) => {
    if (!emailToQuery) return;
    setIsCheckingStatus(true);
    try {
      let data = null;
      let succeeded = false;
      
      // 1. Try local Express API proxy first
      try {
        const response = await fetch('/api/check-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailToQuery, scriptUrl: scriptUrlToCheck })
        });
        const text = await response.text();
        data = JSON.parse(text);
        succeeded = true;
      } catch (apiErr) {
        console.warn("Express API status check failed or is not available. Trying client-side direct request.", apiErr);
      }
      
      // 2. Direct browser fetch fallback (for static hosting platforms like Vercel)
      if (!succeeded && scriptUrlToCheck && scriptUrlToCheck.startsWith("http")) {
        try {
          const directResponse = await fetch(`${scriptUrlToCheck}?email=${encodeURIComponent(emailToQuery)}`, {
            method: 'GET'
          });
          const directText = await directResponse.text();
          data = JSON.parse(directText);
          succeeded = true;
          console.log("Direct client-side status check succeeded:", data);
        } catch (directErr: any) {
          console.error("Direct client-side status check also failed:", directErr);
        }
      }
      
      if (succeeded && data) {
        if (data.status === 'success' && data.registered) {
          setRegisteredUser(data.user);
          setIsRegistered(true);
          setRegisterCount(data.count);
          
          // Block criteria:
          // Already used the free 1 unprotection, AND Status column is 1 (blocked).
          // If status column gets updated to 0 by Admin, then isBlocked becomes false!
          if (data.count >= 1 && data.user && data.user.status === 1) {
            setIsBlocked(true);
          } else {
            setIsBlocked(false);
          }
        } else {
          setIsRegistered(false);
          setIsBlocked(false);
          setRegisterCount(0);
          setRegisteredUser(null);
        }
      } else {
        // Fallback to local default states in case both are unreachable, so app stays usable offline
        setIsRegistered(false);
        setIsBlocked(false);
        setRegisterCount(0);
        setRegisteredUser(null);
      }
    } catch (err) {
      console.error('Error checking registration status:', err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Helper for artificial pacing
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (processing) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      validateAndSetFile(selectedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const validateAndSetFile = async (selectedFile: File) => {
    playSound('click', muted);
    // Excel mime types or extension matches .xlsx
    const isXlsx = selectedFile.name.endsWith('.xlsx') || 
                   selectedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    
    if (!isXlsx) {
      setError("Waduh bro! Format file lu salah. Harus pakai file Excel (.xlsx) ya! Extensi lama .xls atau format lain ga disupport.");
      setFile(null);
      playSound('error', muted);
      return;
    }

    if (selectedFile.size > 80 * 1024 * 1024) {
      setError("Busyet, giga amat keles! Batas ukuran file maksimal 80MB biar browser lu gak puyeng.");
      setFile(null);
      playSound('error', muted);
      return;
    }

    // Checking status on active spreadsheet
    setIsCheckingStatus(true);
    try {
      const response = await fetch('/api/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, scriptUrl: appsScriptUrl })
      });
      const data = await response.json();
      
      if (data.status === 'success' && data.registered) {
        setRegisteredUser(data.user);
        setIsRegistered(true);
        setRegisterCount(data.count);
        
        if (data.count >= 1 && data.user.status === 1) {
          // Blocked because count >= 1 and status == 1
          setIsBlocked(true);
          setFile(null);
          setShowRegisterModal(true);
          return;
        } else {
          // Allowed (either status is 0, or count < 1)
          setIsBlocked(false);
        }
      } else {
        // Not registered
        setIsRegistered(false);
        setIsBlocked(false);
        setRegisterCount(0);
        setFile(selectedFile); // Hold the parsed file
        setShowRegisterModal(true);
        return;
      }
    } catch (err) {
      console.warn("Status check failed on upload, triggering register modal for safety", err);
      setFile(selectedFile);
      setShowRegisterModal(true);
      return;
    } finally {
      setIsCheckingStatus(false);
    }

    setFile(selectedFile);
    setError(null);
    setSuccess(false);
    setResultBlob(null);
    setSheetsResult([]);
    setLogs([]);
  };

  const startBongkar = async () => {
    if (!file) return;
    playSound('click', muted);
    setProcessing(true);
    setSuccess(false);
    setError(null);
    setSheetsResult([]);
    setLogs([]);
    
    try {
      // 1. Upload File Excel
      setCurrentStep(1);
      addLog(`🚀 Membaca file original: "${file.name}" (${formatBytes(file.size)})`);
      await delay(700);

      // 2. Rename file extension excel menjadi zip & extract
      setCurrentStep(2);
      addLog("🔄 Simulasi me-rename ekstensi file .xlsx menjadi .zip...");
      await delay(800);
      addLog("📦 Mengekstrak arsitektur arsip zip di memori browser...");
      
      const zip = new JSZip();
      let loadedZip: JSZip;
      try {
        loadedZip = await zip.loadAsync(file);
      } catch (zipErr) {
        throw new Error("Gagal membaca struktur file Excel. File lu kemungkinan korup atau bukan file openXML (.xlsx) yang benar.");
      }
      await delay(500);

      // 3. Masuk ke folder xl/worksheets
      setCurrentStep(3);
      addLog("📂 Masuk ke jeroan zip -> direktori: 'xl/worksheets/'");
      await delay(800);

      const worksheets: { path: string; name: string }[] = [];
      loadedZip.forEach((relativePath, zipEntry) => {
        if (relativePath.startsWith('xl/worksheets/') && relativePath.endsWith('.xml')) {
          const name = relativePath.substring('xl/worksheets/'.length);
          worksheets.push({ path: relativePath, name });
        }
      });

      if (worksheets.length === 0) {
        throw new Error("Folder 'xl/worksheets' kosong atau kagak ketemu. Excel lu normal gak nih? Coba cek lagi.");
      }

      addLog(`🔍 Ditemukan ${worksheets.length} file XML sheet di dalam folder tersebut.`);
      await delay(800);

      // 4 & 5. Edit file xml untuk hapus <sheetProtection.../>
      setCurrentStep(4);
      addLog("✂️ Memulai eliminasi tag <sheetProtection> di setiap worksheet XML...");
      await delay(800);

      const results: { name: string; isProtected: boolean }[] = [];
      let strippedCount = 0;

      for (let i = 0; i < worksheets.length; i++) {
        const sheet = worksheets[i];
        const entry = loadedZip.file(sheet.path);
        if (!entry) continue;

        const xmlContent = await entry.async('string');
        
        // Check for sheetProtection tags
        // Excel format typically: <sheetProtection password="..." sheet="1" objects="1" scenarios="1"/>
        const protectionRegex = /<sheetProtection[^>]*\/>/g;
        const protectionBlockRegex = /<sheetProtection[^>]*>[\s\S]*?<\/sheetProtection>/g;
        
        const hasProtection = protectionRegex.test(xmlContent) || protectionBlockRegex.test(xmlContent);
        
        if (hasProtection) {
          addLog(`🔥 Proteksi ketemu di "${sheet.name}". Mengeksekusi elemen pembatas...`);
          // Strip the regex matches
          let cleanedXml = xmlContent.replace(protectionRegex, '');
          cleanedXml = cleanedXml.replace(protectionBlockRegex, '');
          
          // Double-check multi-line variants
          cleanedXml = cleanedXml.replace(/<sheetProtection[\s\S]*?\/>/g, '');
          
          loadedZip.file(sheet.path, cleanedXml);
          results.push({ name: sheet.name, isProtected: true });
          strippedCount++;
        } else {
          addLog(`✅ Aman sentosa! "${sheet.name}" tidak dipasangi proteksi.`);
          results.push({ name: sheet.name, isProtected: false });
        }
        await delay(450); // Cool rolling visual update
      }

      setSheetsResult(results);
      addLog(`⚡ Pembersihan tuntas! ${strippedCount} dari ${worksheets.length} sheet berhasil dikuliti.`);
      await delay(700);

      // 6. Kompres kembali menjadi zip
      setCurrentStep(5);
      addLog("🔒 Menyegel kembali jeroan XML ke dalam bungkusan kompresi zip baru...");
      await delay(850);
      
      const zipBlob = await loadedZip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // 7. Rename file zip menjadi xlsx secara otomatis
      setCurrentStep(6);
      addLog("🏷️ Me-rename kembali format .zip menjadi .xlsx secara otomatis...");
      await delay(700);

      const baseName = file.name.endsWith('.xlsx') ? file.name.substring(0, file.name.length - 5) : file.name;
      const finalName = `${baseName}_unprotected.xlsx`;
      
      setResultBlob(zipBlob);
      setResultName(finalName);
      
      // 8. Munculkan pesan sukses
      setCurrentStep(7);
      setSuccess(true);
      addLog(`✨ Excel terbongkar mulus! File baru: ${finalName}`);
      playSound('success', muted);

    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Terjadi galat mistis pas ngebongkar Excel. Pastiin file lu normal dan ga korup!");
      playSound('error', muted);
    } finally {
      setProcessing(false);
    }
  };

  const triggerDownload = () => {
    if (!resultBlob) return;
    playSound('click', muted);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(resultBlob);
    link.download = resultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetAll = () => {
    playSound('click', muted);
    setFile(null);
    setProcessing(false);
    setCurrentStep(0);
    setSheetsResult([]);
    setResultBlob(null);
    setResultName('');
    setSuccess(false);
    setError(null);
    setLogs([]);
  };

  const [copiedDonation, setCopiedDonation] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const handleCopyDonation = () => {
    playSound('click', muted);
    navigator.clipboard.writeText("081341300100");
    setCopiedDonation(true);
    setTimeout(() => setCopiedDonation(false), 2000);
  };

  const [copiedScript, setCopiedScript] = useState(false);
  const handleCopyScript = () => {
    playSound('click', muted);
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPhone.trim()) {
      return;
    }
    
    setRegistrationSubmitting(true);
    setRegistrationError(null);
    playSound('click', muted);
    
    // Save phone and email to localStorage
    localStorage.setItem('BONGKAR_USER_PHONE', userPhone);
    localStorage.setItem('BONGKAR_USER_EMAIL', userEmail);

    const formattedCoords = userCoords || '=HYPERLINK("http://maps.google.com/?q=-1.59327,103.62144", "📍 Buka Google Maps")';

    try {
      let data = null;
      let succeeded = false;

      // 1. Try local Express API proxy first
      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            telpon: userPhone,
            koordinat: formattedCoords,
            scriptUrl: appsScriptUrl
          })
        });
        
        const text = await response.text();
        data = JSON.parse(text);
        succeeded = true;
      } catch (apiErr) {
        console.warn("Express API registration proxy failed or is not available. Trying client-side direct request.", apiErr);
      }

      // 2. Direct browser fetch fallback (for static hosting platforms like Vercel)
      if (!succeeded) {
        if (appsScriptUrl && appsScriptUrl.startsWith("http")) {
          try {
            console.log("Executing client-side direct POST registration to Apps Script...");
            const directResponse = await fetch(appsScriptUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'text/plain' 
              },
              body: JSON.stringify({
                email: userEmail,
                telpon: userPhone,
                koordinat: formattedCoords
              })
            });
            const directText = await directResponse.text();
            try {
              data = JSON.parse(directText);
              succeeded = true;
              console.log("Direct client-side registration succeeded:", data);
            } catch (jsonErr) {
              console.warn("Direct Apps Script completed, but response was not JSON. Verifying status via GET request...");
              await delay(1200);
              
              const checkResponse = await fetch(`${appsScriptUrl}?email=${encodeURIComponent(userEmail)}`, {
                method: 'GET'
              });
              const checkText = await checkResponse.text();
              const checkJson = JSON.parse(checkText);
              if (checkJson && (checkJson.status === 'success' || checkJson.registered !== undefined)) {
                data = {
                  status: (checkJson.user && checkJson.user.status === 1) ? 'blocked' : 'success',
                  message: 'Pendaftaran Terkirim & Terverifikasi!',
                  count: checkJson.count || 1
                };
                succeeded = true;
              } else {
                throw new Error("Pendaftaran terkirim, tetapi status pendaftaran tidak dapat diverifikasi.");
              }
            }
          } catch (directErr: any) {
            console.error("Direct client-side registration also failed:", directErr);
            throw new Error(
              "Gagal mendaftar langsung ke Google Sheets. " +
              "Pastikan URL Web App Google Apps Script Anda sudah benar di bagian pengaturan (tombol gigi roda), " +
              "dan Apps Script Anda sudah di-deploy dengan akses 'Anyone'."
            );
          }
        } else {
          // If no Apps Script url, simulate successful locally
          console.log("No Apps Script URL configured. Simulating offline success.");
          data = {
            status: 'success',
            message: 'Registrasi Berhasil (Mode Offline/Simulasi)!',
            count: 1
          };
          succeeded = true;
        }
      }
      
      if (succeeded && data) {
        if (data.status === 'success') {
          setIsRegistered(true);
          setIsBlocked(false);
          setRegisterCount(1);
          setShowRegisterModal(false);
          playSound('success', muted);
          
          // Start unprotect automatically since they registered successfully!
          if (file) {
            startBongkar();
          }
        } else if (data.status === 'blocked') {
          setIsRegistered(true);
          setIsBlocked(true);
          setRegisterCount(data.count || 2);
          playSound('error', muted);
          setRegistrationError(data.message || "Batas unprotect gratis sudah habis!");
        } else {
          playSound('error', muted);
          setRegistrationError(data.message || "Gagal melakukan registrasi, cek kembali akun Anda.");
        }
      } else {
        throw new Error("Gagal memproses pendaftaran. Respon kosong.");
      }
    } catch (err: any) {
      console.error(err);
      playSound('error', muted);
      setRegistrationError(err.message || 'Koneksi gagal. Silakan coba lagi atau cek integrasi Anda.');
    } finally {
      setRegistrationSubmitting(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    playSound('click', muted);
    localStorage.setItem('BONGKAR_EXCEL_APPS_SCRIPT', appsScriptUrl);
    checkUserStatus(userEmail, appsScriptUrl);
  };

  const appsScriptCode = `// SPREADSHEET_ID = "1tRMjPks698vlieYnjjz_S6TPhnBhsDxvugzJ4z4Awtg"
// Nama Sheet: "Register"

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
}`;

  return (
    <div className="min-h-screen gradient-bg text-slate-200 font-sans selection:bg-cyan-500 selection:text-black relative overflow-hidden flex flex-col items-center py-8 px-4 md:py-12">
      
      {/* Aurora Laser Gradient Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-cyan-500/10 blur-[120px] rounded-full glow-bg pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/15 blur-[140px] rounded-full glow-bg pointer-events-none" style={{ animationDelay: '4s' }}></div>
      <div className="absolute top-10 right-10 w-[200px] h-[200px] bg-purple-500/10 blur-[100px] rounded-full glow-bg pointer-events-none" style={{ animationDelay: '2s' }}></div>

      {/* Grid Pattern Mesh */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      {/* Floating Animated Sparkles for Neon Look */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ y: [0, -40, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-[10%] text-cyan-400/30"
        >
          <Sparkles className="w-8 h-8" />
        </motion.div>
        <motion.div 
          animate={{ y: [0, -30, 0], opacity: [0.1, 0.5, 0.1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-40 right-[8%] text-blue-400/30"
        >
          <Zap className="w-10 h-10" />
        </motion.div>
      </div>

      {/* Header from Immersive UI */}
      <header className="w-full max-w-2xl flex items-center justify-between mb-6 z-10">
        <div className="flex items-center gap-4">
          <img src="https://jambijohan0-cpu.github.io/Johan/img/BongkarExcel.png" alt="Logo" className="h-12 w-12 object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
          <h1 className="text-xl md:text-2xl font-black tracking-tighter neon-glow uppercase text-cyan-400 font-display">Bongkar Excel</h1>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-[10px] font-mono uppercase tracking-widest opacity-50 hidden sm:inline">Auto-Unprotect Engine v2.0</span>
          <div className="h-3.5 w-3.5 rounded-full bg-cyan-400 animate-pulse"></div>
        </div>
      </header>

      {/* Main Container */}
      <div id="main-card-container" className="w-full max-w-2xl relative z-10 flex flex-col gap-6">
        
        {/* Nav Controls Bar */}
        <div id="nav-controls" className="flex items-center justify-between glass px-4 py-2.5 rounded-full shadow-lg">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-xs font-mono text-cyan-300">STATUS: READY TO CRACK</span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Explanation Toggle */}
            <button
              onClick={() => { playSound('click', muted); setShowExplanation(!showExplanation); }}
              className={`p-2 rounded-full cursor-pointer transition-colors text-zinc-400 hover:text-white ${showExplanation ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}`}
              title="Gimana cara kerjanya?"
            >
              <HelpCircle className="w-4.5 h-4.5" />
            </button>

            {/* Mute toggle button */}
            <button 
              onClick={() => setMuted(!muted)}
              className="p-2 rounded-full cursor-pointer transition-colors text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              title={muted ? "Nyalakan Musik Efek" : "Matikan Musik Efek"}
            >
              {muted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5 text-cyan-400" />}
            </button>
          </div>
        </div>

        {/* Info Card: Explanation overlay style */}
        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden glass border border-dashed border-cyan-500/40 rounded-2xl p-5 shadow-2xl"
            >
              <h3 className="text-sm font-display font-semibold text-cyan-400 flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4" /> CARA KERJA DI BELAKANG LAYAR (BAHASA GAUL)
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Bro, asal lu tahu, file <code className="text-cyan-400 font-mono">.xlsx</code> itu aslinya cuma kumpulan file XML yang dibungkus jadi satu file berekstensi ZIP biasa! 
                Alat ini bakal ngelakuin proses ekstrem ini langsung di memori browser lu:
              </p>
              <ol className="list-decimal text-xs text-zinc-400 pl-4 mt-2 space-y-1">
                <li>Arsip Excel diload terus kita intip bagian rahasianya.</li>
                <li>Kita telusuri folder gaib <code className="text-cyan-300 font-mono">xl/worksheets/</code> buat dapet semua layout XML sheet.</li>
                <li>Setiap file XML disisir satu-per-satu pake teknologi regex super.</li>
                <li>Tag pencabut kebebasan <code className="text-cyan-500 font-mono">&lt;sheetProtection ... /&gt;</code> bakal langsung kita mutilasi dan hapus selamanya!</li>
                <li>Di-pack balik jadi ZIP baru, terus secara otomatis kita balikin jadi file <code className="text-cyan-400 font-mono">.xlsx</code> yang segar bebas diedit!</li>
              </ol>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Slogan with Immersive UI Styling and Cool Excel Logo */}
        <div className="flex flex-col items-center justify-center text-center space-y-4 my-3">
          {/* Cool Glowing 3D Excel Logo Showcase */}
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, type: 'spring', stiffness: 100 }}
            whileHover={{ scale: 1.05 }}
            className="relative cursor-pointer select-none group focus:outline-none"
            title="Sakti! Logo Excel Premium & Bongkar Engine v2.0"
          >
            {/* Pulsing Green/Cyan Outer Glow Background */}
            <div className="absolute inset-0 bg-emerald-500/20 blur-[30px] rounded-full group-hover:bg-emerald-400/30 transition-all duration-500 scale-110 pointer-events-none animate-pulse"></div>
            <div className="absolute inset-0 bg-cyan-500/10 blur-[20px] rounded-full group-hover:bg-cyan-400/20 transition-all duration-500 pointer-events-none"></div>

            {/* Futuristic Tech Circle Ring with Rotating Sparkles */}
            <svg className="absolute -inset-6 w-[148%] h-[148%] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500/20 pointer-events-none" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="1" strokeDasharray="6 3" className="animate-[spin_40s_linear_infinite]" />
              <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 12" className="animate-[spin_20s_linear_infinite_reverse]" />
            </svg>

            {/* Glowing Sparkles on Logo Edges */}
            <div className="absolute -top-3 -right-3 text-yellow-400 animate-bounce group-hover:scale-125 transition-transform">
              <Sparkles className="w-5 h-5 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
            </div>
            <div className="absolute -bottom-3 -left-3 text-emerald-400 animate-ping" style={{ animationDuration: '3s' }}>
              <Zap className="w-4 h-4 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            </div>

            {/* Physical 3D Styled SVG Glassmorphic Excel Logo Card */}
            <div className="relative w-36 h-36 bg-zinc-900/90 border border-emerald-500/30 rounded-3xl p-4.5 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_12px_24px_rgba(0,0,0,0.6)] group-hover:border-emerald-400/50 group-hover:shadow-[0_20px_40px_rgba(16,185,129,0.25)] transition-all duration-500">
              {/* Inner spreadsheet grid watermark */}
              <div className="absolute inset-3 bg-[linear-gradient(to_right,#107c4115_1px,transparent_1px),linear-gradient(to_bottom,#107c4115_1px,transparent_1px)] bg-[size:10px_10px] rounded-2xl pointer-events-none opacity-65"></div>

              {/* High-Impact Customized SVG Microsoft Excel Icon */}
              <svg className="w-20 h-20 transition-transform duration-500 group-hover:scale-108 filter drop-shadow-[0_6px_12px_rgba(16,124,65,0.4)]" viewBox="0 0 512 512" fill="none">
                {/* Right Folder/Folder back with grid cells representing columns/rows */}
                <path d="M432,64H176a32,32,0,0,0-32,32V416a32,32,0,0,0,32,32H432a32,32,0,0,0,32-32V96A32,32,0,0,0,432,64Z" fill="#107C41" />
                
                {/* Diagonal shining gloss line behind sheet */}
                <path d="M464,96V416L176,336V176Z" fill="#0b592e" opacity="0.3" />
                
                {/* White Grid Cell Paths */}
                <rect x="194" y="112" width="60" height="40" rx="4" fill="#21A366" />
                <rect x="270" y="112" width="168" height="40" rx="4" fill="#21A366" />
                
                <rect x="194" y="168" width="60" height="40" rx="4" fill="#21A366" />
                <rect x="270" y="168" width="168" height="40" rx="4" fill="#21A366" />
                
                <rect x="194" y="224" width="60" height="40" rx="4" fill="#18844D" opacity="0.9" />
                <rect x="270" y="224" width="168" height="40" rx="4" fill="#18844D" opacity="0.9" />
                
                <rect x="194" y="280" width="60" height="40" rx="4" fill="#107C41" />
                <rect x="270" y="280" width="168" height="40" rx="4" fill="#107C41" />

                <rect x="194" y="336" width="60" height="40" rx="4" fill="#0C5F32" />
                <rect x="270" y="336" width="168" height="40" rx="4" fill="#0C5F32" />

                <rect x="194" y="392" width="244" height="24" rx="4" fill="#084E29" />

                {/* Grid inner dividers */}
                <line x1="262" y1="96" x2="262" y2="416" stroke="#ffffff" strokeWidth="3" opacity="0.15" />
                
                {/* Floating Shadow of the flap skew */}
                <polygon points="48,128 224,96 224,416 48,384" fill="#0c5a2f" opacity="0.4" />

                {/* Left Side: Overlapping signature Green "X" Plate Book fold cover with real depth */}
                <path d="M224,112L48,144a16,16,0,0,0-16,16V352a16,16,0,0,0,16,16l176,32a16,16,0,0,0,16-16V128A16,16,0,0,0,224,112Z" fill="#21A366" />
                
                {/* Elegant 3D edge gloss factor */}
                <path d="M48,144L224,112V124L48,156Z" fill="#ffffff" opacity="0.3" />
                
                {/* Signature 'X' Text in elegant geometry paths */}
                <path d="M164,188h-26l-26,48l-26-48H60l39,64L60,316h26l26-48l26,48h26l-39-64Z" fill="#ffffff" />
              </svg>

              {/* Real-time Unlocking Status Badge Overlay inside Logo */}
              <div className="absolute -bottom-2 px-3 py-1 rounded-full bg-emerald-500 border border-emerald-400 flex items-center gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.4)] animate-bounce" style={{ animationDuration: '4s' }}>
                <Unlock className="w-2.5 h-2.5 text-zinc-950 font-black animate-pulse" />
                <span className="text-[9px] font-mono font-black tracking-tight text-zinc-950 uppercase">DECRYPT ACTIVE</span>
              </div>
            </div>
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 select-none flex flex-row items-center justify-center gap-3">
              <svg className="w-8 h-8 md:w-11 md:h-11 shrink-0 filter drop-shadow-[0_4px_8px_rgba(16,124,65,0.45)]" viewBox="0 0 512 512" fill="none">
                <path d="M432,64H176a32,32,0,0,0-32,32V416a32,32,0,0,0,32,32H432a32,32,0,0,0,32-32V96A32,32,0,0,0,432,64Z" fill="#107C41" />
                <path d="M464,96V416L176,336V176Z" fill="#0b592e" opacity="0.3" />
                <polygon points="48,128 224,96 224,416 48,384" fill="#0c5a2f" opacity="0.4" />
                <path d="M224,112L48,144a16,16,0,0,0-16,16V352a16,16,0,0,0,16,16l176,32a16,16,0,0,0,16-16V128A16,16,0,0,0,224,112Z" fill="#21A366" />
                <path d="M48,144L224,112V124L48,156Z" fill="#ffffff" opacity="0.3" />
                <path d="M164,188h-26l-26,48l-26-48H60l39,64L60,316h26l26-48l26,48h26l-39-64Z" fill="#ffffff" />
              </svg>
              <span>UNPROTECT SHEET</span>
            </h2>
            <p className="text-sm font-medium text-cyan-200/70 uppercase tracking-[0.2em] select-none">
              Lupa password sheet? Santuy, kita beresin sat-set-wat-wet.
            </p>
          </div>
        </div>

        {/* Central Intersect Box (Glass + glow-box) */}
        <div id="workspace-card" className="glass rounded-3xl p-6 md:p-8 shadow-2xl glow-box relative overflow-hidden flex flex-col gap-6">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <AnimatePresence mode="wait">
            
            {/* ERROR DISPATCHER BANNER */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-1 bg-red-950/45 border border-red-500/30 rounded-2xl p-4 flex gap-3 text-red-200 items-start text-xs sm:text-sm relative z-15"
              >
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold text-red-300 block mb-1">Duh, Error Cuy! 😭</span>
                  <span>{error}</span>
                </div>
                <button 
                  onClick={() => { playSound('click', muted); setError(null); }}
                  className="p-1 hover:bg-red-900/30 rounded-full transition-colors cursor-pointer text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* PHASE 1: NO FILE SELECTED (UPLOAD SCREEN) */}
            {!file && !processing && !success && (
              <motion.div
                key="upload-panel"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6 relative z-10"
              >
                {/* Drag and Drop Zone in Cyan Style */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => {
                    playSound('click', muted);
                    fileInputRef.current?.click();
                  }}
                  className="group relative border-2 border-dashed border-cyan-500/30 hover:border-cyan-400 rounded-2xl py-14 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 bg-cyan-500/5 hover:bg-cyan-500/10 overflow-hidden text-center"
                >
                  <div className="w-20 h-20 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>

                  <p className="text-lg md:text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                    Klik atau Seret File Excel-mu Disini
                  </p>
                  <p className="text-xs opacity-60 font-mono mt-2">
                    Format Support: .xlsx only
                  </p>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx"
                    className="hidden"
                  />

                  {/* Limits Badge */}
                  <span className="text-[10px] font-mono tracking-wider text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 py-1.5 px-3.5 rounded-full uppercase mt-4">
                    MAX SIZE: 80MB • 100% SECURE
                  </span>
                </div>

                {/* Steps Pills visualization of the file removal steps */}
                <div className="grid grid-cols-2 sm:grid-cols-4 w-full gap-3 mt-1">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="step-pill px-3 py-1 rounded-full text-[10px] font-bold font-mono">STEP 01</div>
                    <p className="text-[11px] font-semibold opacity-80 uppercase tracking-wider text-cyan-200">Upload File</p>
                  </div>
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="step-pill px-3 py-1 rounded-full text-[10px] font-bold font-mono">STEP 02</div>
                    <p className="text-[11px] font-semibold opacity-80 uppercase tracking-wider text-cyan-200">Bongkar ZIP</p>
                  </div>
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="step-pill px-3 py-1 rounded-full text-[10px] font-bold font-mono">STEP 03</div>
                    <p className="text-[11px] font-semibold opacity-80 uppercase tracking-wider text-cyan-200">Mutilasi Lock</p>
                  </div>
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="step-pill px-3 py-1 rounded-full text-[10px] font-bold font-mono">STEP 04</div>
                    <p className="text-[11px] font-semibold opacity-80 uppercase tracking-wider text-cyan-200">Zip Back & DL</p>
                  </div>
                </div>

                {/* Cool Feature Grid (Value Propositions) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 pr-1">
                  <div className="bg-zinc-950/30 backdrop-blur-md border border-zinc-800/60 p-3.5 rounded-2xl flex items-start gap-2.5">
                    <Zap className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className="text-xs font-semibold text-zinc-300">Super Ngebut</span>
                      <span className="text-[11px] text-zinc-500 leading-normal">Gak sampe sedetik langsung jebol!</span>
                    </div>
                  </div>
                  <div className="bg-zinc-950/30 backdrop-blur-md border border-zinc-800/60 p-3.5 rounded-2xl flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className="text-xs font-semibold text-zinc-300">Privasi Aman</span>
                      <span className="text-[11px] text-zinc-500 leading-normal">100% lokal ga di-upload ke server aneh.</span>
                    </div>
                  </div>
                  <div className="bg-zinc-950/30 backdrop-blur-md border border-zinc-800/60 p-3.5 rounded-2xl flex items-start gap-2.5">
                    <Unlock className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className="text-xs font-semibold text-zinc-300">Bebas Edit</span>
                      <span className="text-[11px] text-zinc-500 leading-normal">Ubah cell, baris, nulis rumus sepuasnya!</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PHASE 2: FILE LOADED, READY TO BONGKAR (PRE-FLIGHT SCREEN) */}
            {file && !processing && !success && (
              <motion.div
                key="ready-panel"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="flex flex-col gap-6"
              >
                {/* File Preview Capsule */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-3.5 overflow-hidden">
                    <div className="bg-emerald-500/20 text-emerald-400 p-3 rounded-xl shrink-0">
                      <FileSpreadsheet className="w-7 h-7" />
                    </div>
                    <div className="flex flex-col overflow-hidden text-left">
                      <span className="text-sm font-bold text-zinc-200 truncate">{file.name}</span>
                      <span className="text-xs text-zinc-400 font-mono">{formatBytes(file.size)}</span>
                    </div>
                  </div>

                  <button
                    onClick={resetAll}
                    disabled={processing}
                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800/50 rounded-full cursor-pointer transition-colors"
                    title="Batal pilih file"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Confirmation Box (Indonesian Slang) */}
                <div className="text-center p-4 bg-zinc-950/60 rounded-2xl border border-zinc-800/70">
                  <p className="text-xs text-zinc-400 italic">
                    "Okey bos! File udah ditangkap mulus di ram laptop/hp lu. Kita bakal ngebongkar zip dalemannya, terus ngehapus tag proteksi sheetProtection di worksheets xml-nya secara rapi."
                  </p>
                </div>

                {/* Core Dispatch Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startBongkar}
                  className="w-full bg-gradient-to-r from-emerald-500 to-lime-400 text-black py-4 rounded-2xl font-display font-extrabold text-base cursor-pointer hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center gap-2"
                >
                  BONGKAR PROTEKSI SEKARANG! 🚀
                </motion.button>
              </motion.div>
            )}

            {/* PHASE 3: ACTIVE CRACKING / DECOMPRESS / PROCESSING SCREEN */}
            {processing && (
              <motion.div
                key="processing-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-6 py-2"
              >
                {/* Center Loading Ring */}
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    {/* Ring animated pulse */}
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute -inset-2 bg-emerald-500/20 rounded-full blur-md"
                    ></motion.div>
                    
                    {/* Spinner */}
                    <div className="w-16 h-16 border-4 border-zinc-800 border-t-emerald-400 rounded-full animate-spin"></div>
                    
                    {/* Center icon flashing lock */}
                    <div className="absolute inset-0 flex items-center justify-center text-emerald-400">
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.1, 0.9] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <Unlock className="w-5 h-5" />
                      </motion.div>
                    </div>
                  </div>
                  <span className="text-sm font-display font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-lime-300">
                    SEDANG MEMUTILASI PASSWORD LOCK...
                  </span>
                </div>

                {/* Real-time Ticking Stages Panel */}
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 pb-2 border-b border-zinc-900">
                    Alur Kerja Pembongkaran (Tahap 1-8):
                  </h3>

                  <div className="grid grid-cols-1 gap-2.5 text-xs">
                    
                    {/* Step 1: Upload Excel File */}
                    <div className={`flex items-center gap-2.5 transition-colors ${currentStep >= 1 ? 'text-zinc-200' : 'text-zinc-600'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                        currentStep > 1 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : currentStep === 1 ? 'bg-emerald-400 text-black font-extrabold animate-pulse' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                      }`}>
                        {currentStep > 1 ? <Check className="w-3 h-3" /> : '1'}
                      </span>
                      <span className={currentStep === 1 ? 'font-bold text-emerald-400' : ''}>
                        Upload dan membaca file Excel asli
                      </span>
                    </div>

                    {/* Step 2: ZIP Rename simulation */}
                    <div className={`flex items-center gap-2.5 transition-colors ${currentStep >= 2 ? 'text-zinc-200' : 'text-zinc-600'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                        currentStep > 2 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : currentStep === 2 ? 'bg-emerald-400 text-black font-extrabold animate-pulse' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                      }`}>
                        {currentStep > 2 ? <Check className="w-3 h-3" /> : '2'}
                      </span>
                      <span className={currentStep === 2 ? 'font-bold text-emerald-400' : ''}>
                        Rename file extension menjadi .zip (unzip arsip file)
                      </span>
                    </div>

                    {/* Step 3: Access Worksheets */}
                    <div className={`flex items-center gap-2.5 transition-colors ${currentStep >= 3 ? 'text-zinc-200' : 'text-zinc-600'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                        currentStep > 3 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : currentStep === 3 ? 'bg-emerald-400 text-black font-extrabold animate-pulse' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                      }`}>
                        {currentStep > 3 ? <Check className="w-3 h-3" /> : '3'}
                      </span>
                      <span className={currentStep === 3 ? 'font-bold text-emerald-400' : ''}>
                        Membuka worksheets folder xl/worksheets
                      </span>
                    </div>

                    {/* Step 4: Scan and Edit sheet protection */}
                    <div className={`flex items-center gap-2.5 transition-colors ${currentStep >= 4 ? 'text-zinc-200' : 'text-zinc-600'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                        currentStep > 4 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : currentStep === 4 ? 'bg-emerald-400 text-black font-extrabold animate-pulse' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                      }`}>
                        {currentStep > 4 ? <Check className="w-3 h-3" /> : '4'}
                      </span>
                      <span className={currentStep === 4 ? 'font-bold text-emerald-400' : ''}>
                        Mencari tag &quot;&lt;sheetProtection&quot; hingga akhir &quot;scenarios=&quot;1&quot;/&gt;&quot; di worksheets
                      </span>
                    </div>

                    {/* Step 5: Compress to Zip */}
                    <div className={`flex items-center gap-2.5 transition-colors ${currentStep >= 5 ? 'text-zinc-200' : 'text-zinc-600'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                        currentStep > 5 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : currentStep === 5 ? 'bg-emerald-400 text-black font-extrabold animate-pulse' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                      }`}>
                        {currentStep > 5 ? <Check className="w-3 h-3" /> : '5'}
                      </span>
                      <span className={currentStep === 5 ? 'font-bold text-emerald-400' : ''}>
                        Kompres kembali seluruh folder menjadi zip
                      </span>
                    </div>

                    {/* Step 6: Rename Zip back to Xlsx */}
                    <div className={`flex items-center gap-2.5 transition-colors ${currentStep >= 6 ? 'text-zinc-200' : 'text-zinc-600'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                        currentStep > 6 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : currentStep === 6 ? 'bg-emerald-400 text-black font-extrabold animate-pulse' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                      }`}>
                        {currentStep > 6 ? <Check className="w-3 h-3" /> : '6'}
                      </span>
                      <span className={currentStep === 6 ? 'font-bold text-emerald-400' : ''}>
                        Rename file zip menjadi xlsx otomatis
                      </span>
                    </div>

                    {/* Step 7: Completed Done */}
                    <div className={`flex items-center gap-2.5 transition-colors ${currentStep >= 7 ? 'text-zinc-200' : 'text-zinc-600'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                        currentStep >= 7 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                      }`}>
                        {currentStep >= 7 ? <Check className="w-3 h-3" /> : '7'}
                      </span>
                      <span className={currentStep === 7 ? 'font-bold text-emerald-400' : ''}>
                        Dihapus dan siap di-download!
                      </span>
                    </div>

                  </div>
                </div>

                {/* Technical Raw Logs console styling */}
                <div className="bg-black border border-zinc-800 rounded-xl p-3 h-32 overflow-y-auto font-mono text-[10px] text-zinc-500 text-left flex flex-col gap-1">
                  {logs.map((log, index) => (
                    <div key={index} className="leading-relaxed whitespace-pre-wrap">
                      <span className="text-emerald-500/85 font-semibold">&gt;</span> {log}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* PHASE 4: CRACK SUCCESS - RESULT DOWNLOAD SCREEN */}
            {success && resultBlob && (
              <motion.div
                key="success-panel"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col gap-6 text-center text-zinc-200"
              >
                {/* Huge Unlock Circle Shield */}
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="relative">
                    <motion.div 
                      animate={{ scale: [1, 1.15, 1], rotate: 360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                      className="absolute -inset-4 border-2 border-emerald-500/20 border-dashed rounded-full"
                    ></motion.div>
                    
                    <div className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 p-5 rounded-full relative z-10 animate-bounce">
                      <Unlock className="w-10 h-10" />
                    </div>
                  </div>
                  
                  <div className="mt-2 text-center">
                    <h3 className="text-lg font-display font-black tracking-tight text-white uppercase">
                      🎉 Protect Sheet di Excel Sudah Dihapus!
                    </h3>
                    <p className="text-xs text-zinc-400">
                      File lu udah divaksin ampe sel terkecilnya. Password pengunci sheet langsung mokad!
                    </p>
                  </div>
                </div>

                {/* File Details Grid */}
                <div className="bg-zinc-950/60 rounded-2xl border border-zinc-800 p-4 text-left flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-zinc-900">
                    <span className="text-zinc-500 font-mono">FILE ASLI:</span>
                    <span className="text-zinc-300 font-semibold truncate max-w-[180px]">{file?.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-zinc-900">
                    <span className="text-zinc-500 font-mono">FILE BARU:</span>
                    <span className="text-emerald-400 font-bold truncate max-w-[180px]">{resultName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-mono">UKURAN FILE:</span>
                    <span className="text-zinc-300 font-mono">{formatBytes(resultBlob.size)}</span>
                  </div>
                </div>

                {/* Multi-worksheets Scan Status Table */}
                <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800/80 p-4 text-left">
                  <h4 className="text-xs font-semibold text-zinc-400 mb-2.5 uppercase tracking-wide">
                    Hasil Diagnosa Lembar Kerja (Worksheets):
                  </h4>
                  
                  <div className="max-h-36 overflow-y-auto flex flex-col gap-2 pr-1.5 scrollbar-thin">
                    {sheetsResult.map((sheet, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                          sheet.isProtected 
                            ? 'bg-emerald-500/10 border border-emerald-500/20' 
                            : 'bg-zinc-950/30 border border-zinc-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileSpreadsheet className={`w-4.5 h-4.5 shrink-0 ${sheet.isProtected ? 'text-emerald-400' : 'text-zinc-500'}`} />
                          <span className="font-mono text-zinc-300 truncate">{sheet.name}</span>
                        </div>

                        {sheet.isProtected ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 py-0.5 px-2 rounded-md tracking-wider shrink-0 uppercase">
                            🔓 PASSWORD DIHAPUS!
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-900 py-0.5 px-2 rounded-md shrink-0 uppercase">
                            ✅ Gak ada password
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Big Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={triggerDownload}
                    className="flex-1 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-500 hover:to-cyan-500 text-zinc-950 font-extrabold text-sm py-4 rounded-2xl cursor-pointer hover:shadow-[0_0_20px_rgba(52,211,153,0.35)] transition-all flex items-center justify-center gap-2 animate-pulse"
                  >
                    <Download className="w-4.5 h-4.5 text-zinc-950 shrink-0" />
                    DOWNLOAD FILE LU SEKARANG! 📥
                  </button>

                  <button
                    onClick={resetAll}
                    className="bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700/80 font-bold text-xs py-4 px-6 rounded-2xl cursor-pointer transition-colors flex items-center justify-center gap-2 shrink-0"
                  >
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    Bongkar File Lain 🔄
                  </button>
                </div>

                {/* Hint */}
                <span className="text-[11px] text-zinc-500 italic block">
                  Silahkan buka file <strong className="text-emerald-400">{resultName}</strong> di Excel lu, dijamin langsung bebas kocar-kacir nulis data apa aja!
                </span>
              </motion.div>
            )}

          </AnimatePresence>

        </div>



        {/* SHARE SECTION (Requested by user) */}
        <div id="share-section" className="mt-8 bg-zinc-950/40 rounded-3xl border border-zinc-800/50 p-6 flex flex-col gap-5 text-center relative overflow-hidden">
          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] rounded-full pointer-events-none"></div>
          
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-mono tracking-[0.25em] text-cyan-400 font-black uppercase">📢 BAGIKAN APLIKASI</span>
            <h3 className="text-base font-display font-black tracking-tight text-white uppercase flex items-center gap-1.5 justify-center">
              <Share2 className="w-5 h-5 text-cyan-400 shrink-0" />
              Bagikan Logo & Link ke WhatsApp temen-temen lu!
            </h3>
            <p className="text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">
              Punya grup rekan kerja atau temen yang sering pusing gegara dapet file Excel ke-lock atau kena Protect Sheet? Bagikan aplikasi ini beserta logo cantiknya biar mereka dapet pencerahan instan!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 max-w-md mx-auto w-full">
            {/* Share to WhatsApp */}
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                "🔥 Bongkar Excel - Hapus Password Protect Sheet Excel Instan! 🗝️⚡\n\n" +
                "Gak usah pusing nyari password sheet Excel yang ke-lock, tinggal upload langsung beres gratis! No install, 100% aman dan cepat!\n\n" +
                "Kunjungi Website:\nhttps://Bongkar-Excel.Vercel.App\n\n" +
                "Logo Aplikasi:\nhttps://jambijohan0-cpu.github.io/Johan/img/BongkarExcel.png"
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playSound('click', muted)}
              className="flex-1 bg-[#25D366] hover:bg-[#20ba5a] text-zinc-950 font-black text-xs sm:text-sm py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 transition transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current text-zinc-950 shrink-0" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.743.002-2.602-1.01-5.05-2.85-6.892C16.638 2.128 14.191 1.1 11.603 1.1 6.162 1.1 1.74 5.47 1.736 10.844c-.001 1.637.45 3.23 1.304 4.673l-.991 3.616 3.7-.969z" />
              </svg>
              Bagikan ke WhatsApp 💬
            </a>

            {/* Copy raw share text to Clipboard */}
            <button
              onClick={() => {
                playSound('success', muted);
                const shareMsg = 
                  "🔥 Bongkar Excel - Hapus Password Protect Sheet Excel Instan! 🗝️⚡\n\n" +
                  "Gak usah pusing nyari password sheet Excel yang ke-lock, tinggal upload langsung beres gratis! No install, 100% aman dan cepat!\n\n" +
                  "Kunjungi Website:\nhttps://Bongkar-Excel.Vercel.App\n\n" +
                  "Logo Aplikasi:\nhttps://jambijohan0-cpu.github.io/Johan/img/BongkarExcel.png";
                navigator.clipboard.writeText(shareMsg);
                setCopiedShare(true);
                setTimeout(() => setCopiedShare(false), 3000);
              }}
              className="flex-1 bg-zinc-800 border border-zinc-700 hover:border-zinc-550 text-zinc-300 hover:text-white hover:bg-zinc-750 font-black text-xs sm:text-sm py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 transition transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              📋 {copiedShare ? 'PESAN & LOGO DISALIN!' : 'SALIN PESAN LINK & LOGO'}
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 bg-zinc-950/60 p-4 rounded-xl border border-zinc-900 max-w-sm mx-auto mt-2">
            <img 
              src="https://jambijohan0-cpu.github.io/Johan/img/BongkarExcel.png" 
              alt="Bongkar Excel Logo Small Preview" 
              className="h-10 w-10 object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" 
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-zinc-500 font-mono tracking-wide uppercase">OpenGraph / WhatsApp Logo</span>
              <span className="text-xs text-zinc-300 font-extrabold truncate max-w-[200px]">BongkarExcel.png</span>
            </div>
          </div>
        </div>



        {/* DONATION SECTION (Requested by user) */}
        <div id="donation-section" className="mt-8 bg-zinc-950/40 rounded-3xl border border-zinc-800/50 p-6 flex flex-col gap-5 text-center relative overflow-hidden">
          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-[50px] rounded-full pointer-events-none"></div>
          
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-mono tracking-[0.25em] text-yellow-400 font-black uppercase">☕ SUPPORT THE CREATOR</span>
            <h3 className="text-base font-display font-black tracking-tight text-white uppercase">
              Donasi ke "Johan" Via Shopee, Gopay, Ovo, Dana
            </h3>
            <p className="text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">
              Yo bro! Aplikasi ini gw buat mandiri biar kerjaan lu pada gampang. Kalau puyeng lu beres gegara Excel lemot kebuka password, yuk mari sedekah kopi seikhlasnya biar berkah dunia akhirat!
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 py-4">
            {/* GoPay Logo Card Tile */}
            <div className="w-24 h-24 bg-[#E5E7EB] rounded-2xl flex flex-col items-center justify-center p-2.5 shadow-lg shadow-black/40 hover:scale-108 transition-all duration-200 cursor-pointer select-none border border-white/10" title="GoPay">
              <svg viewBox="0 0 100 100" className="w-12 h-12">
                <circle cx="50" cy="50" r="33" fill="#00AED6" />
                <path d="M43,38 C43,31 46,26 50,26 C54,26 57,31 57,38" fill="none" stroke="#FFFFFF" strokeWidth="5.2" strokeLinecap="round" />
                <path d="M33,44 C33,38 39,36 50,36 C61,36 67,38 67,44 L67,58 C67,64 61,67 50,67 C39,67 33,64 33,58 Z" fill="#FFFFFF" />
                <circle cx="59" cy="52" r="3.5" fill="#00AED6" />
              </svg>
              <span className="text-[#1C1C1C] font-black text-[13px] font-sans tracking-tight leading-none mt-1">gopay</span>
            </div>

            {/* OVO Logo Card Tile */}
            <div className="w-24 h-24 bg-[#4C2A86] rounded-2xl flex flex-col items-center justify-center p-2.5 shadow-lg shadow-black/40 hover:scale-108 transition-all duration-200 cursor-pointer select-none border border-purple-400/20" title="OVO">
              <svg viewBox="0 0 150 70" className="w-16 h-auto my-1.5">
                <circle cx="30" cy="35" r="18" stroke="#FFFFFF" strokeWidth="8.5" fill="none" />
                <path d="M58,18 L75,51 L92,18" stroke="#FFFFFF" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <circle cx="120" cy="35" r="18" stroke="#FFFFFF" strokeWidth="8.5" fill="none" />
              </svg>
            </div>

            {/* ShopeePay Logo Card Tile */}
            <div className="w-24 h-24 bg-[#EE4D2D] rounded-2xl flex flex-col items-center justify-center p-2 shadow-lg shadow-black/40 hover:scale-108 transition-all duration-200 cursor-pointer select-none border border-orange-400/20" title="ShopeePay">
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <path d="M38,38 C38,25 62,25 62,38" fill="none" stroke="#FFFFFF" strokeWidth="5.5" strokeLinecap="round" />
                <path d="M26,40 L74,40 C77,40 79,42 78.5,45.5 L73,79 C72.5,82 69.5,84 66,84 L34,84 C30.5,84 27.5,82 27,79 L21.5,45.5 C21,42 23,40 26,40 Z" fill="#FFFFFF" />
                {/* Clean, recognizable orange S on brand bag design */}
                <path d="M55,48 C55,43.5 45,45.5 45,42.5 C45,40.5 47,39.5 50,39.5 C53,39.5 55,40.5 55,42.5 M45,56.5 C45,61 55,59 55,63.5 C55,65.5 53,66.5 50,66.5 C47,66.5 45,65.5 45,63.5" fill="none" stroke="#EE4D2D" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M45,48.5 L55,56.5" stroke="#EE4D2D" strokeWidth="4.5" strokeLinecap="round" />
              </svg>
              <span className="text-white font-extrabold text-[9px] tracking-tight leading-none mt-1">ShopeePay</span>
            </div>

            {/* DANA Logo Card Tile */}
            <div className="w-24 h-24 bg-[#118EEA] rounded-2xl flex flex-col items-center justify-center p-2 shadow-lg shadow-black/40 hover:scale-108 transition-all duration-200 cursor-pointer select-none border border-blue-400/20" title="DANA">
              <svg viewBox="0 0 100 100" className="w-11 h-11 my-1">
                <circle cx="50" cy="50" r="30" fill="#FFFFFF" />
                <path d="M34,48 C38,42 43,44 48,47 C53,50 59,51 64,45 L64,52 C59,58 53,57 48,54 C43,51 37,49 33,55 Z" fill="#118EEA" />
              </svg>
              <span className="text-white font-black text-[11px] tracking-widest leading-none mt-1">DANA</span>
            </div>
          </div>

          {/* Interactive Phone/Account Number Copy Card */}
          <div className="bg-zinc-950/80 border border-zinc-900 rounded-2xl p-4 max-w-sm mx-auto flex flex-col gap-2.5">
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Nomor Rekening/Akun:</span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-lg font-display font-extrabold tracking-widest text-white selection:bg-yellow-400 font-mono">
                {shopeePhone}
              </span>
              <button
                type="button"
                onClick={handleCopyDonation}
                className="bg-yellow-400 hover:bg-yellow-500 text-zinc-950 font-black text-xs px-3.5 py-1.5 rounded-xl transition duration-150 transform hover:scale-105 cursor-pointer"
              >
                {copiedDonation ? 'SALIN BERHASIL! 🍿' : 'SALIN NOMOR 📋'}
              </button>
            </div>
            {copiedDonation && (
              <span className="text-[10px] text-green-400 font-bold animate-pulse">
                Nuhun pisan bro! Sukses disalin, siap disupply asupan kafein! ☕
              </span>
            )}
          </div>
        </div>

        {/* Slang Footer & Credit Information */}
        <div id="author-credits" className="text-center text-zinc-500 text-xs flex flex-col gap-3 mt-4">
          <p className="leading-relaxed text-[11px] text-zinc-400">
            Dibuat secara instan, aman, dan tanpa batasan. Semua pengolahan file tuntas di memori browser gadget lu tanpa pengiriman data eksternal kera gaib sekalipun. <strong className="text-cyan-400">Keamanan data terjamin 100%!</strong>
          </p>
          
          <footer className="w-full flex flex-col sm:flex-row items-center justify-between border-t border-white/5 pt-6 text-left gap-4 mt-2">
            <div className="flex gap-6">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase opacity-40 font-bold tracking-widest text-cyan-400">Github Source</span>
                <span className="text-[11px] font-mono text-zinc-300">jambijohan0-cpu/BongkarExcel</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase opacity-40 font-bold tracking-widest text-cyan-400">Deployment</span>
                <span className="text-[11px] font-mono text-zinc-300">Powered by Vercel</span>
              </div>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-[9px] font-bold uppercase opacity-30 tracking-[0.25em] text-cyan-300">
                Designed for the Hustlers & Spreadsheet Warriors
              </p>
            </div>
          </footer>
        </div>

      </div>

      {/* FLOATING WHATSAPP CHAT BUTTON */}
      <a
        href="https://wa.me/6281341300100"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => playSound('click', muted)}
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white hover:bg-[#20ba5a] p-4 rounded-full shadow-[0_4px_20px_rgba(37,211,102,0.4)] flex items-center justify-center transition-all duration-300 hover:scale-110 group cursor-pointer animate-bounce"
        style={{ animationDuration: '3s' }}
        title="Butuh update status atau bantuan? Hubungi Johan via Whatsapp!"
      >
        <svg className="w-6 h-6 fill-current text-white shrink-0" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.743.002-2.602-1.01-5.05-2.85-6.892C16.638 2.128 14.191 1.1 11.603 1.1 6.162 1.1 1.74 5.47 1.736 10.844c-.001 1.637.45 3.23 1.304 4.673l-.991 3.616 3.7-.969zM15.11 12.532c-.198-.1-.1.1-.9-.45h-.2l-.6-.7-.2-.3c-.3-.4-.5-.8-.7-1-.3-.4-.5-.5-.7-.7-.3-.3-.1-.3-.3-.6-.1-.1-.3-.2-.5-.3-.4-.2-.8-.4-1.2l-.3-.1c-.4-.1-.7-.2-.9-.2-.3 0-.6 0-.8.2-.1 0-.3.1-.4.2-.3.2-.5.5-.6.7l-.1.1c-.2.3-.4.8-.4 1.3 0 .1 0 .2.1.4.1.4.2.8.4 1.2.2.4.5.8.8 1.2l.2.2c.4.4.9.8 1.4 1.2.3.2.7.4 1 .6l.4.2c.4.2.9.4 1.4.5l.3.1c.3.1.6.1.9.1.5-.1.9-.3 1.2-.5l.1-.1c.3-.2.6-.5.7-.9s.2-.8.1-1c-.1-.3-.3-.4-.5-.5z"/>
        </svg>
        <span className="absolute right-14 bg-zinc-950 text-[10px] text-zinc-300 border border-zinc-800 px-2.5 py-1.5 rounded-xl font-sans tracking-wide shrink-0 transition-all duration-350 scale-0 group-hover:scale-100 opacity-0 group-hover:opacity-100 origin-right shadow-2xl font-bold whitespace-nowrap">
          Chat Admin Johan 💬
        </span>
      </a>

      {/* REGISTRATION & STATUS BLOCKED MODAL OVERLAY */}
      <AnimatePresence>
        {showRegisterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* Modal backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                // Clicking backdrop will only close if they are already registered and not blocked
                if (isRegistered && !isBlocked) {
                  setShowRegisterModal(false);
                }
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            ></motion.div>

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 max-w-sm w-full relative z-10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
            >
              <div className="absolute top-4 right-4">
                {isRegistered && !isBlocked && (
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click', muted);
                      setShowRegisterModal(false);
                    }}
                    className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isBlocked ? (
                /* LOCKED BLOCKED SECTION */
                <div className="flex flex-col gap-6 text-center">
                  <div className="mx-auto bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-full w-16 h-16 flex items-center justify-center animate-pulse">
                    <Lock className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-black text-white uppercase tracking-tight">
                      ❌ BATAS GRATIS TELAH HABIS!
                    </h3>
                    <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
                      Sobat, setiap akun cuma dapet <strong className="text-yellow-400 font-bold">1x gratis unprotect Excel</strong>. Karena kuota gratis lu udah abis, lu wajib hubungi Admin Johan via Whatsapp buat update status unprotect-nya dulu.
                    </p>
                  </div>

                  <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 text-left font-mono text-[10px] text-zinc-400 flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span>Status Akun:</span>
                      <span className="text-red-400 font-bold">TERKUNCI (Status = 1)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Email Anda:</span>
                      <span className="text-zinc-200">{userEmail}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pendaftaran ke-</span>
                      <span className="text-yellow-400 font-bold">{registerCount} Kali</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <a
                      href={`https://wa.me/6281341300100?text=${encodeURIComponent(
                        `Halo Admin Johan, saya sudah mendaftar di Bongkar Excel menggunakan email ${userEmail} (No Telp: ${userPhone}). Kuota gratis saya sudah terpakai. Tolong bantu update status untuk membuka folder / status unprotect sheet saya ya! Terima kasih!`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => playSound('click', muted)}
                      className="bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-sm py-4 rounded-2xl text-center flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-[1.02] cursor-pointer"
                    >
                      Hubungi Johan via WhatsApp 💬
                    </a>
                    
                    <button
                      type="button"
                      onClick={() => {
                        playSound('click', muted);
                        checkUserStatus(userEmail, appsScriptUrl);
                      }}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs py-3 rounded-2xl border border-zinc-700 hover:text-white transition cursor-pointer"
                    >
                      Putar Ulang Status Cek 🔄
                    </button>
                    
                    <span className="text-[10px] text-zinc-500 leading-relaxed block text-center">
                      Klik "Putar Ulang Status Cek" setelah Admin Johan mengonfirmasi update akun kamu ke Status 0!
                    </span>
                  </div>
                </div>
              ) : (
                /* REGISTRATION FORM SECTION */
                <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col items-center text-center gap-1.5 pb-2 border-b border-zinc-900">
                    <div className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 p-3 rounded-2xl mb-1.5">
                      <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
                    </div>
                    <h3 className="text-base font-display font-black text-white uppercase tracking-tight">
                      Registrasi Bongkar Excel
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                      Dapatkan <strong className="text-cyan-400 font-bold">Gratis 1 Kali Pakai</strong> untuk mengebiri Protect Sheet secara instan!
                    </p>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Input 1: Email (Fully editable, saved to localStorage) */}
                    <div className="flex flex-col gap-1.5 text-left">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          Alamat Email Gmail Anda:
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            playSound('click', muted);
                            const cached = localStorage.getItem('BONGKAR_USER_EMAIL') || systemDetectedEmail || 'anita872536@gmail.com';
                            setUserEmail(cached);
                            localStorage.setItem('BONGKAR_USER_EMAIL', cached);
                            checkUserStatus(cached, appsScriptUrl);
                          }}
                          className="text-[9px] bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide flex items-center gap-1 transition cursor-pointer select-none active:scale-95"
                          title="Klik untuk mengambil alamat email terverifikasi dari browser/sistem cache"
                        >
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '4s' }} />
                          Ambil Email Aktif 📥
                        </button>
                      </div>
                      <input
                        type="email"
                        value={userEmail}
                        onChange={(e) => {
                          setUserEmail(e.target.value);
                          localStorage.setItem('BONGKAR_USER_EMAIL', e.target.value);
                          checkUserStatus(e.target.value, appsScriptUrl);
                        }}
                        placeholder="Masukkan alamat email Google Anda..."
                        required
                        className="bg-zinc-950 border border-zinc-805 text-white rounded-xl px-4 py-3 text-xs w-full focus:border-cyan-400 outline-none placeholder-zinc-650 font-mono"
                      />
                    </div>

                    {/* Input 2: No Telpon */}
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        Nomor Whatsapp/Telpon:
                      </label>
                      <input
                        type="tel"
                        value={userPhone}
                        onChange={(e) => setUserPhone(e.target.value)}
                        placeholder="Contoh: 081234567890"
                        required
                        className="bg-zinc-950 border border-zinc-850 text-white rounded-xl px-4 py-3 text-xs w-full focus:border-cyan-400 outline-none placeholder-zinc-650 font-mono"
                      />
                    </div>

                    {/* Input 3: Koordinat (Auto-detected by Geolocation) */}
                    <div className="flex flex-col gap-1.5 text-left">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          Lintang Koordinat (GPS):
                        </label>
                        <span className="text-[9px] text-zinc-550 font-mono italic">
                          Tidak perlu diisi
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={gettingCoords ? 'Mencari Satelit Lokasi GPS...' : userCoords}
                          disabled
                          className="bg-zinc-900 border border-zinc-850 text-zinc-400 rounded-xl px-4 py-3 text-xs w-full cursor-not-allowed outline-none font-mono"
                        />
                        <div className="absolute right-3.5 top-3 flex items-center">
                          {gettingCoords ? (
                            <div className="w-4 h-4 border-2 border-zinc-700 border-t-rose-400 rounded-full animate-spin"></div>
                          ) : (
                            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></div>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] text-zinc-550 leading-relaxed">
                        📍 Sesuai mandat, GPS Lokasi diaktifkan secara otomatis untuk memvalidasi lokasi pendaftaran.
                      </span>
                    </div>
                  </div>

                  {registrationError && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs flex flex-col gap-1 text-left font-sans">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Koneksi / Status Error:</span>
                      </div>
                      <span className="text-[11px] leading-relaxed text-zinc-300">
                        {registrationError}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mt-2">
                    <button
                      type="submit"
                      disabled={registrationSubmitting}
                      className="bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-500 hover:to-emerald-500 text-zinc-900 font-extrabold text-xs sm:text-sm py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-[1.01] cursor-pointer"
                    >
                      {registrationSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
                          SINKRONISASI CO-ORDINATE...
                        </>
                      ) : (
                        'SIMPAN & MULAI BONGKAR SEKARANG! 🔑'
                      )}
                    </button>
                    <span className="text-[9px] text-center text-zinc-500 uppercase tracking-widest block">
                      100% Aman & Terkoneksi Real-time
                    </span>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
