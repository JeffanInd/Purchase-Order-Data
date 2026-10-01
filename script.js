document.addEventListener("DOMContentLoaded", function () {
                function updateClock() {
                    const now = new Date();

                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    const seconds = String(now.getSeconds()).padStart(2, '0');

                    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                    const dayName = days[now.getDay()];
                    const date = now.getDate();
                    const month = months[now.getMonth()];
                    const year = now.getFullYear();

                    document.getElementById("clock-time").textContent =
                        `${hours}:${minutes}:${seconds}`;

                    document.getElementById("clock-date").textContent =
                        `${dayName}, ${date} ${month} ${year}`;
                }

                setInterval(updateClock, 1000);
                updateClock();
            });
            // ============================================================
            // FIREBASE CONFIGURATION
            // ============================================================
            // Ganti nilai di bawah dengan Firebase Web App config milik Anda.
            // Firebase Console -> Project settings -> Your apps -> Web app.
            const firebaseConfig = {
                apiKey: "AIzaSyAdjD2FiCU-uP5eo8JuKyP_Gc_QNGpAPK8",
                authDomain: "inspection-data-11f7d.firebaseapp.com",
                projectId: "inspection-data-11f7d",
                storageBucket: "inspection-data-11f7d.firebasestorage.app",
                messagingSenderId: "1082215196163",
                appId: "1:1082215196163:web:fdaa360881782ea3ad1036",
                measurementId: "G-KBV92YDP1K"
            };

            let db = null;
            let data = {};
            let firebaseReady = false;

            function setUploadStatus(message, isError = false) {
                const el = document.getElementById("uploadStatus");
                if (!el) return;
                el.textContent = message || "";
                el.style.color = isError ? "#b00020" : "#333";
            }

            function firebaseConfigIsReady() {
                return firebaseConfig.apiKey &&
                    !firebaseConfig.apiKey.startsWith("GANTI_") &&
                    firebaseConfig.projectId &&
                    !firebaseConfig.projectId.startsWith("GANTI_") &&
                    firebaseConfig.appId &&
                    !firebaseConfig.appId.startsWith("GANTI_");
            }

            function initFirebase() {
                if (!firebaseConfigIsReady()) {
                    console.warn("Firebase belum dikonfigurasi. Isi firebaseConfig terlebih dahulu.");
                    setUploadStatus("Firebase belum dikonfigurasi");
                    return false;
                }

                try {
                    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
                    db = firebase.firestore();
                    firebaseReady = true;
                    return true;
                } catch (error) {
                    console.error("Firebase initialization error:", error);
                    setUploadStatus("Firebase gagal diinisialisasi", true);
                    return false;
                }
            }

            // ============================================================
            // EXCEL -> FIRESTORE
            // Format Excel yang digunakan:
            // PO | Vendor | ECRD | Item | Qty | Description | Image
            // Header tidak sensitif huruf besar/kecil.
            // ============================================================
            function normalizeHeader(value) {
                return String(value ?? "")
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "");
            }

            function findExcelColumn(row, aliases) {
                const keys = Object.keys(row);
                const normalized = {};
                keys.forEach(k => normalized[normalizeHeader(k)] = k);

                for (const alias of aliases) {
                    const key = normalized[normalizeHeader(alias)];
                    if (key !== undefined) return key;
                }
                return null;
            }

            function excelDateToISO(value) {
                if (value === null || value === undefined || value === "") return "";

                if (value instanceof Date && !isNaN(value.getTime())) {
                    return value.toISOString().slice(0, 10);
                }

                if (typeof value === "number" && window.XLSX) {
                    const date = XLSX.SSF.parse_date_code(value);
                    if (date) {
                        return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
                    }
                }

                const text = String(value).trim();
                if (!text) return "";

                // yyyy-mm-dd
                if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
                    const [y, m, d] = text.split("-");
                    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                }

                const date = new Date(text);
                if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
                return text;
            }

            function parseExcelRows(rows) {
                const result = {};
                const errors = [];

                rows.forEach((row, index) => {
                    const excelRow = index + 2;

                    const poKey = findExcelColumn(row, ["PO", "PO Number", "Purchase Order", "PurchaseOrder"]);
                    const vendorKey = findExcelColumn(row, ["Vendor", "Supplier"]);
                    const ecrdKey = findExcelColumn(row, ["ECRD", "ECRD Date", "EcrdDate"]);
                    const itemKey = findExcelColumn(row, ["Item", "SKU", "Item Code", "ItemCode"]);
                    const qtyKey = findExcelColumn(row, ["Qty", "Quantity", "Qty PO", "QtyPO"]);
                    const descKey = findExcelColumn(row, ["Description", "Desc", "Item Description"]);
                    const imageKey = findExcelColumn(row, ["Image", "Image URL", "ImageURL", "Photo"]);

                    const po = poKey ? String(row[poKey] ?? "").trim() : "";
                    const vendor = vendorKey ? String(row[vendorKey] ?? "").trim() : "";
                    const item = itemKey ? String(row[itemKey] ?? "").trim() : "";

                    if (!po && !item && !vendor) return;

                    if (!po || !vendor || !item) {
                        errors.push(`Baris ${excelRow}: PO, Vendor, dan Item wajib diisi.`);
                        return;
                    }

                    let qty = qtyKey ? Number(row[qtyKey]) : 0;
                    if (isNaN(qty)) qty = 0;

                    if (!result[po]) {
                        result[po] = {
                            Vendor: vendor,
                            ecrd: excelDateToISO(ecrdKey ? row[ecrdKey] : ""),
                            items: []
                        };
                    }

                    // Jika PO yang sama muncul berkali-kali dengan ECRD/vendor kosong,
                    // gunakan nilai yang sudah ada.
                    if (!result[po].Vendor && vendor) result[po].Vendor = vendor;
                    if (!result[po].ecrd && ecrdKey) result[po].ecrd = excelDateToISO(row[ecrdKey]);

                    result[po].items.push({
                        item: item,
                        qty: qty,
                        desc: descKey ? String(row[descKey] ?? "") : "",
                        image: imageKey ? String(row[imageKey] ?? "").trim() : ""
                    });
                });

                return { data: result, errors };
            }

            async function savePODataToFirebase(poData) {
                if (!firebaseReady || !db) {
                    throw new Error("Firebase belum siap. Isi firebaseConfig terlebih dahulu.");
                }

                const batch = db.batch();
                const collectionRef = db.collection("purchaseOrders");

                Object.entries(poData).forEach(([po, poValue]) => {
                    const safeId = po.replace(/[\\/#?]/g, "_").trim();
                    const docRef = collectionRef.doc(safeId);
                    batch.set(docRef, {
                        po: po,
                        Vendor: poValue.Vendor || "",
                        ecrd: poValue.ecrd || "",
                        items: poValue.items || [],
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });

                await batch.commit();
            }

            async function loadPODataFromFirebase() {
                if (!firebaseReady || !db) return {};

                try {
                    const snapshot = await db.collection("purchaseOrders").get();
                    const firebaseData = {};

                    snapshot.forEach(doc => {
                        const d = doc.data() || {};
                        const po = String(d.po || doc.id).trim();
                        if (!po) return;

                        firebaseData[po] = {
                            Vendor: d.Vendor || d.vendor || "",
                            ecrd: d.ecrd || d.ECRD || "",
                            items: Array.isArray(d.items) ? d.items : []
                        };
                    });

                    return firebaseData;
                } catch (error) {
                    console.error("Gagal membaca Firebase:", error);
                    setUploadStatus("Gagal membaca data Firebase", true);
                    return {};
                }
            }

            async function uploadExcelToFirebase(file) {
                if (!firebaseReady) {
                    throw new Error("Firebase belum dikonfigurasi. Isi firebaseConfig terlebih dahulu.");
                }

                if (!file) return;

                setUploadStatus("Membaca Excel...");

                const buffer = await file.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
                const sheetName = workbook.SheetNames[0];

                if (!sheetName) throw new Error("Excel tidak memiliki worksheet.");

                const worksheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                if (!rows.length) throw new Error("Excel tidak memiliki data.");

                const parsed = parseExcelRows(rows);
                const poCount = Object.keys(parsed.data).length;

                if (!poCount) throw new Error("Tidak ada data PO yang valid ditemukan.");

                setUploadStatus(`Menyimpan ${poCount} PO ke Firebase...`);
                await savePODataToFirebase(parsed.data);

                data = await loadPODataFromFirebase();
                refreshPOSelectors();

                const itemCount = Object.values(parsed.data).reduce((total, po) => total + po.items.length, 0);
                let message = `Berhasil: ${poCount} PO / ${itemCount} item tersimpan.`;
                if (parsed.errors.length) message += ` ${parsed.errors.length} baris dilewati.`;
                setUploadStatus(message);

                if (parsed.errors.length) console.warn("Baris Excel yang dilewati:", parsed.errors);
            }

            function refreshPOSelectors() {
                const vendorSelect = document.getElementById("vendorSelect");
                const poSelect = document.getElementById("poSelect");
                const tbody = document.querySelector("#dataTable tbody");
                const poHeader = document.getElementById("poHeader");

                vendorSelect.innerHTML = '<option value="">-- Select Vendor --</option>';
                poSelect.innerHTML = '<option value="">-- Select PO --</option>';
                tbody.innerHTML = "";
                poHeader.style.display = "none";
                document.getElementById("dataTable").style.display = "none";

                [...new Set(Object.values(data).map(d => d.Vendor).filter(Boolean))]
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                    .forEach(v => {
                        const opt = document.createElement("option");
                        opt.value = v;
                        opt.textContent = v;
                        vendorSelect.appendChild(opt);
                    });
            }

            // ============================================================
            // INITIAL DATA LOAD
            // ============================================================
            async function initializePOData() {
                if (!initFirebase()) {
                    refreshPOSelectors();
                    return;
                }

                setUploadStatus("Memuat data PO dari Firebase...");
                data = await loadPODataFromFirebase();
                refreshPOSelectors();

                const count = Object.keys(data).length;
                setUploadStatus(count ? `${count} PO tersedia dari Firebase.` : "Belum ada data PO. Upload Excel.");
            }

            function backToApp1() {
                window.location.href = "https://jeffanind.github.io/Appl-System-Dashboard/";
            }

            function hitungAQL(qty) {
                if (qty <= 8) return 2;
                if (qty <= 15) return 3;
                if (qty <= 25) return 5;
                if (qty <= 50) return 8;
                if (qty <= 90) return 13;
                if (qty <= 150) return 20;
                if (qty <= 280) return 32;
                if (qty <= 500) return 50;
                return Math.ceil(qty * 0.2);
            }
            document.addEventListener("DOMContentLoaded", function () {
                const vendorSelect = document.getElementById("vendorSelect");
                const poSelect = document.getElementById("poSelect");
                const tbody = document.querySelector("#dataTable tbody");

                const poHeader = document.getElementById("poHeader");
                const headerVendor = document.getElementById("headerVendor");
                const headerPO = document.getElementById("headerPO");
                const headerECRD = document.getElementById("headerECRD");
                const printDate = document.getElementById("printDate");

                vendorSelect.addEventListener("change", function () {
                    poSelect.innerHTML = '<option value="">-- Select PO --</option>';
                    tbody.innerHTML = "";
                    poHeader.style.display = "none";
                    document.getElementById("dataTable").style.display = "none";

                    Object.keys(data).forEach(po => {
                        if (data[po].Vendor === this.value) {
                            const opt = document.createElement("option");
                            opt.value = po;
                            opt.textContent = po;
                            poSelect.appendChild(opt);
                        }
                    });
                });

                poSelect.addEventListener("change", function () {
                    tbody.innerHTML = "";
                    const po = this.value;
                    const dataTable = document.getElementById("dataTable");

                    // jika kembali ke Select
                    if (po === "") {
                        dataTable.style.display = "none";
                        poHeader.style.display = "none";
                        return;
                    }

                    dataTable.style.display = "table";

                    headerVendor.textContent = data[po].Vendor;
                    headerPO.textContent = po;

                    headerECRD.textContent =
                        new Date(data[po].ecrd).toLocaleDateString("en-US", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric"
                        });

                    const printDateElement = document.getElementById("printDate");
                    const printDate = new Date();
                    printDateElement.textContent = printDate.toLocaleDateString("en-US");

                    poHeader.style.display = "block";

                    data[po].items.forEach(item => {
                        const tr = document.createElement("tr");
                        const qtyAQL = hitungAQL(item.qty);
                        tr.innerHTML = `
    <td class="item">${item.item}</td>
    <td class="qty">${item.qty}</td>
    <td class="aql">${qtyAQL}</td>
    <td>${item.desc}</td>
    <td>
    <img src="${item.image}" style="cursor:pointer; max-width:100px;" onclick="toggleModal(this)">
   </td>
`;

                        tbody.appendChild(tr);
                    });
                });

                // Hapus PO terpilih dari Firestore
                const deletePOBtn = document.getElementById("deletePOBtn");
                poSelect.addEventListener("change", function () {
                    deletePOBtn.disabled = !this.value || !firebaseReady;
                });

                deletePOBtn.addEventListener("click", async function () {
                    const po = poSelect.value;
                    if (!po) {
                        alert("Pilih nomor PO yang ingin dihapus terlebih dahulu.");
                        return;
                    }
                    if (!firebaseReady || !db) {
                        alert("Firebase belum siap.");
                        return;
                    }
                    const yakin = confirm(`Hapus PO ${po} beserta seluruh itemnya dari Firebase?\n\nTindakan ini tidak dapat dibatalkan.`);
                    if (!yakin) return;

                    deletePOBtn.disabled = true;
                    deletePOBtn.textContent = "⏳ Menghapus...";
                    try {
                        const safeId = po.replace(/[\\/#?]/g, "_").trim();
                        await db.collection("purchaseOrders").doc(safeId).delete();
                        const selectedVendor = vendorSelect.value;
                        data = await loadPODataFromFirebase();
                        refreshPOSelectors();
                        vendorSelect.value = selectedVendor;
                        vendorSelect.dispatchEvent(new Event("change"));
                        setUploadStatus(`PO ${po} berhasil dihapus dari Firebase.`);
                        alert(`PO ${po} berhasil dihapus.`);
                    } catch (error) {
                        console.error("Gagal menghapus PO:", error);
                        setUploadStatus(error.message || "Gagal menghapus PO", true);
                        alert("Gagal menghapus PO: " + (error.message || "Terjadi kesalahan."));
                    } finally {
                        deletePOBtn.textContent = "🗑️ Hapus PO Terpilih";
                        deletePOBtn.disabled = !poSelect.value || !firebaseReady;
                    }
                });

                // Upload Excel -> Firebase
                const uploadBtn = document.getElementById("uploadExcelBtn");
                const excelInput = document.getElementById("excelFileInput");

                uploadBtn.addEventListener("click", function () {
                    if (!firebaseReady) {
                        alert("Firebase belum dikonfigurasi. Silakan isi firebaseConfig terlebih dahulu.");
                        return;
                    }
                    excelInput.click();
                });

                excelInput.addEventListener("change", async function () {
                    const file = this.files && this.files[0];
                    if (!file) return;

                    uploadBtn.disabled = true;
                    uploadBtn.textContent = "⏳ Uploading...";

                    try {
                        await uploadExcelToFirebase(file);
                        alert("Data PO berhasil di-upload ke Firebase.");
                    } catch (error) {
                        console.error(error);
                        setUploadStatus(error.message || "Upload gagal", true);
                        alert("Upload gagal: " + (error.message || "Terjadi kesalahan."));
                    } finally {
                        uploadBtn.disabled = false;
                        uploadBtn.textContent = "📤 Upload PO Excel";
                        excelInput.value = "";
                    }
                });

                initializePOData();
            });

            function toggleModal(img) {
                const modal = document.getElementById('imgModal');
                const modalImg = document.getElementById('modalImg');

                modal.style.display = "block";
                modalImg.src = img.src;
            }

            // Klik area gelap atau gambar modal → tutup
            document.getElementById('imgModal').onclick = function (e) {
                // Tutup jika klik modal sendiri atau klik gambar
                if (e.target.id === 'imgModal' || e.target.id === 'modalImg') {
                    this.style.display = "none";
                }
            }
            const prevBtn = document.getElementById("prevPO");
            const nextBtn = document.getElementById("nextPO");

            prevBtn.addEventListener("click", function () {

                let index = poSelect.selectedIndex;

                if (index > 1) {
                    poSelect.selectedIndex = index - 1;
                    poSelect.dispatchEvent(new Event("change"));
                }

            });

            nextBtn.addEventListener("click", function () {

                let index = poSelect.selectedIndex;

                if (index < poSelect.options.length - 1) {
                    poSelect.selectedIndex = index + 1;
                    poSelect.dispatchEvent(new Event("change"));
                }

            });
