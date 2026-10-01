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

                    return false;
                }

                try {
                    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
                    db = firebase.firestore();
                    firebaseReady = true;
                    return true;
                } catch (error) {
                    console.error("Firebase initialization error:", error);

                    return false;
                }
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

                    return {};
                }
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
                    .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}))
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

                data = await loadPODataFromFirebase();
                refreshPOSelectors();

                const count = Object.keys(data).length;

            }
            function backToGallery() {
                window.location.href = "https://jeffanind.github.io/Gallery-Item-Product/";
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
