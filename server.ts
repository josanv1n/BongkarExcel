import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

// Simple persistent storage for local mock in case Google Sheets is not configured yet
const MOCK_DB_FILE = path.join(process.cwd(), "mock_register_db.json");

// Permanent Google Sheets Apps Script Web App URL with environment variable overrides
const DEFAULT_APPS_SCRIPT_URL = process.env.Web_App_Url || 
                               process.env.WEB_APP_URL || 
                               process.env.GOOGLE_APPS_SCRIPT_URL || 
                               "https://script.google.com/macros/s/AKfycbxkoffyqznnMZkt-1KC3hj5MQ4SCw9p21m_JAN_XKoerC84mK20A_p-UphlxEZ5SXPQ/exec";


interface RegisterRow {
  email: string;
  telpon: string;
  koordinat: string;
  timestamp: string;
  status: number;
}

function readMockDb(): RegisterRow[] {
  try {
    if (fs.existsSync(MOCK_DB_FILE)) {
      const data = fs.readFileSync(MOCK_DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading mock DB:", err);
  }
  return [
    {
      email: "Johan@gmail.com",
      telpon: "81341300100",
      koordinat: "📍 Buka Google Maps",
      timestamp: "6/9/2026 12:49:38",
      status: 1
    }
  ];
}

function writeMockDb(data: RegisterRow[]) {
  try {
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing mock DB:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: User Email Auto-detect
  // We can automatically detect user email from environment/headers or fall back to empty string
  app.get("/api/user-email", (req, res) => {
    // Check if running in standard authenticated system (like behind Google Cloud IAP or Google AI Studio preview info)
    const emailHeader = req.headers["x-goog-authenticated-user-email"] || 
                        req.headers["x-forwarded-user-email"] || 
                        process.env.USER_EMAIL;
    
    let emailStr = "";
    if (typeof emailHeader === "string") {
      emailStr = emailHeader.replace("accounts.google.com:", "");
    }
    
    // Fallback to the active user's actual email of this current run environment if available
    if (!emailStr) {
      emailStr = "";
    }

    res.json({ email: emailStr, defaultAppsScriptUrl: DEFAULT_APPS_SCRIPT_URL });
  });

  // API Route: Check Status
  app.post("/api/check-status", async (req, res) => {
    const { email } = req.body;
    const rawScriptUrl = req.body.scriptUrl;
    const scriptUrl = (rawScriptUrl && rawScriptUrl.trim()) || DEFAULT_APPS_SCRIPT_URL;

    if (!email) {
      return res.status(400).json({ status: "error", message: "Email is required" });
    }

    // Try real Google Apps Script IF provided
    if (scriptUrl && scriptUrl.startsWith("http")) {
      try {
        console.log(`Proxying status check to Google Apps Script: ${scriptUrl}`);
        const response = await fetch(`${scriptUrl}?email=${encodeURIComponent(email)}`, {
          method: "GET",
          headers: { "Accept": "application/json" }
        });
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          return res.json(json);
        } catch {
          return res.json({ status: "success", registered: false, count: 0 });
        }
      } catch (err: any) {
        console.error("Apps Script URL connection failed, falling back to mock database:", err.message);
      }
    }

    // Fallback to Local Mock Database simulation (fully compliant with specifications)
    const db = readMockDb();
    const userRows = db.filter(r => r.email.toLowerCase() === email.toLowerCase());
    const count = userRows.length;

    if (count > 0) {
      // Find the last register status
      const latestUser = userRows[userRows.length - 1];
      return res.json({
        status: "success",
        registered: true,
        count: count,
        user: {
          email: latestUser.email,
          telpon: latestUser.telpon,
          koordinat: latestUser.koordinat,
          timestamp: latestUser.timestamp,
          status: latestUser.status
        }
      });
    } else {
      return res.json({
        status: "success",
        registered: false,
        count: 0
      });
    }
  });

  // API Route: Register / Simpan
  app.post("/api/register", async (req, res) => {
    const { email, telpon, koordinat } = req.body;
    const rawScriptUrl = req.body.scriptUrl;
    const scriptUrl = (rawScriptUrl && rawScriptUrl.trim()) || DEFAULT_APPS_SCRIPT_URL;

    if (!email || !telpon) {
      return res.status(400).json({ status: "error", message: "Email dan No Telpon wajib diisi!" });
    }

    const timestamp = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const formattedCoords = koordinat || '=HYPERLINK("http://maps.google.com/?q=-1.59327,103.62144", "📍 Buka Google Maps")';

    // Try real Google Apps Script IF provided
    if (scriptUrl && scriptUrl.startsWith("http")) {
      try {
        console.log(`Proxying registration to Google Apps Script: ${scriptUrl}`);
        const response = await fetch(scriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, telpon, koordinat: formattedCoords })
        });
        const json = await response.json();
        return res.json(json);
      } catch (err: any) {
        console.error("Apps Script registration proxy failed, falling back to mock database:", err.message);
      }
    }

    // Fallback to Local Mock Database simulation (strictly saving format matching user specs)
    const db = readMockDb();
    const userRows = db.filter(r => r.email.toLowerCase() === email.toLowerCase());
    const count = userRows.length;

    // Check if already used the single free limit!
    if (count >= 1) {
      // Add record to register log sheets simulation anyway with status = 1 (as requested "Kolom Status diberi angka 1")
      const newRow: RegisterRow = {
        email,
        telpon,
        koordinat: formattedCoords,
        timestamp,
        status: 1
      };
      db.push(newRow);
      writeMockDb(db);

      // Blocked because count >= 1
      return res.json({
        status: "blocked",
        message: "Anda Harus Meminta Admin untuk Mengupdate Agar bisa di gunakan",
        email: email,
        telpon: telpon,
        koordinat: formattedCoords,
        count: count + 1
      });
    } else {
      // First registration
      const newRow: RegisterRow = {
        email,
        telpon,
        koordinat: formattedCoords,
        timestamp,
        status: 1
      };
      db.push(newRow);
      writeMockDb(db);

      return res.json({
        status: "success",
        message: "Registrasi Berhasil!",
        email: email,
        telpon: telpon,
        koordinat: formattedCoords,
        count: 1
      });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server launched on http://localhost:${PORT}`);
  });
}

startServer();
