function switchStudentTab(tabId) {
    document.querySelectorAll('.s-nav-btn').forEach(btn => {
        if (btn.dataset.target === tabId && !btn.classList.contains('bg-candy-darkPink')) {
            btn.classList.add('text-candy-textPink'); btn.classList.remove('text-gray-400');
        } else if (!btn.classList.contains('bg-candy-darkPink')) {
            btn.classList.remove('text-candy-textPink'); btn.classList.add('text-gray-400');
        }
    });
    document.querySelectorAll('.s-tab-content').forEach(c => { c.classList.add('hidden'); c.classList.remove('flex'); });

    const target = document.getElementById(tabId);
    if (tabId === 's-scan') { target.classList.remove('hidden'); target.classList.add('flex'); }
    else { target.classList.remove('hidden'); stopScanner(); }

    if (tabId === 's-home') renderStudentCourses();
    if (tabId === 's-history') renderStudentHistory();
}

function renderStudentCourses() {
    const myCourses = DB_ENROLLMENTS.filter(e => e.studentId === currentUserInfo.id).map(e => e.courseId);
    document.getElementById('s-course-count').innerText = `${myCourses.length} วิชา`;
    const list = document.getElementById('student-course-list');
    if (myCourses.length === 0) { 
        list.innerHTML = `<div class="bg-white p-6 rounded-2xl shadow-sm text-center text-gray-400">ยังไม่มีวิชาเรียน กรุณากดปุ่มด้านล่างเพื่อค้นหา</div>`; 
        return; 
    }
    list.innerHTML = myCourses.map(id => {
        const c = DB_COURSES.find(x => x.id === id); if (!c) return '';
        return `<div class="bg-white rounded-3xl p-5 shadow-sm border-l-4 border-candy-darkPink relative overflow-hidden">
                <div class="absolute top-0 right-0 w-16 h-16 bg-candy-pink/20 rounded-bl-full"></div>
                <h3 class="font-bold text-gray-800 text-lg">${c.name}</h3><p class="text-xs text-gray-500 font-mono mt-1">${c.id}</p>
                <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
                    <span class="bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold text-xs"><i class="fa-solid fa-check mr-1"></i> ลงทะเบียนแล้ว</span>
                </div>
            </div>`;
    }).join('');
}

function openStudentJoinModal() {
    document.getElementById('modal-join-course').classList.remove('hidden-view');
    const myCourses = DB_ENROLLMENTS.filter(e => e.studentId === currentUserInfo.id).map(e => e.courseId);
    const select = document.getElementById('join-course-select'); 
    select.innerHTML = '<option value="">-- เลือกรายวิชา --</option>';
    DB_COURSES.filter(c => !myCourses.includes(c.id)).forEach(c => select.innerHTML += `<option value="${c.id}">${c.id} - ${c.name}</option>`);
}

async function studentJoinCourse() {
    const courseId = document.getElementById('join-course-select').value; 
    if (!courseId) return Swal.fire('ผิดพลาด', 'กรุณาเลือกวิชา', 'warning');
    Swal.fire({ title: 'กำลังลงทะเบียน...', didOpen: () => Swal.showLoading() });
    DB_ENROLLMENTS.push({ studentId: currentUserInfo.id, courseId });
    try { await callAPI('addEnrollment', { studentId: currentUserInfo.id, courseId }); } catch (e) { }
    closeModal('modal-join-course'); 
    renderStudentCourses(); 
    Swal.fire({ icon: 'success', title: 'ลงทะเบียนสำเร็จ', showConfirmButton: false, timer: 1500 });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3, φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180, Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let currentStudentGPS = { lat: 0, lng: 0 }; 
let html5QrcodeScanner = null;

function requestGPSAndScan() {
    Swal.fire({ title: 'กำลังตรวจสอบพิกัด...', didOpen: () => Swal.showLoading() });
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                currentStudentGPS = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                document.getElementById('gps-indicator').className = "w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xl shadow-inner";
                document.getElementById('gps-status-text').innerText = "พร้อมใช้งาน (แม่นยำ: " + pos.coords.accuracy.toFixed(0) + "m)";
                Swal.close(); 
                startScannerEngine();
            }, 
            (err) => { Swal.fire('ข้อผิดพลาด', 'ต้องอนุญาตให้เข้าถึง GPS ก่อน', 'error'); }, 
            { enableHighAccuracy: true, timeout: 5000 }
        );
    }
}

function startScannerEngine() {
    document.getElementById('start-scan-btn').classList.add('hidden'); 
    document.getElementById('stop-scan-btn').classList.remove('hidden'); 
    document.getElementById('scanner-overlay').classList.remove('hidden');
    html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess)
        .catch(err => { Swal.fire('กล้องขัดข้อง', 'ไม่สามารถเปิดกล้องได้', 'error'); stopScanner(); });
}

function stopScanner() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) { html5QrcodeScanner.stop().catch(e => { }); }
    document.getElementById('start-scan-btn').classList.remove('hidden'); 
    document.getElementById('stop-scan-btn').classList.add('hidden'); 
    document.getElementById('scanner-overlay').classList.add('hidden');
}

async function onScanSuccess(decodedText) {
    stopScanner(); 
    Swal.fire({ title: 'กำลังประมวลผล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const res = await callAPI('submitAttendance', { token: decodedText, lat: currentStudentGPS.lat, lng: currentStudentGPS.lng, studentId: currentUserInfo.id });
        DB_ATTENDANCE = res.attendance;
        Swal.fire({ icon: 'success', title: `เช็คชื่อสำเร็จ (${res.status})`, text: `ระยะห่าง ${res.distance}m`, confirmButtonColor: res.status === 'มาสาย' ? '#EAB308' : '#34D399' })
            .then(() => { switchStudentTab('s-history'); });
    } catch (err) { Swal.fire('ผิดพลาด', err.message, 'error'); }
}

function renderStudentHistory() {
    const list = document.getElementById('student-history-list');
    const myHistory = DB_ATTENDANCE.filter(a => a.studentId === currentUserInfo.id).sort((a, b) => b.timestamp - a.timestamp);
    if (myHistory.length === 0) { list.innerHTML = `<li class="text-center text-gray-400 py-4">ไม่มีประวัติการเข้าเรียน</li>`; return; }
    list.innerHTML = myHistory.map(a => {
        let colorClass = a.status === 'มาเรียน' ? 'bg-green-400 text-green-600' : a.status === 'มาสาย' ? 'bg-yellow-400 text-yellow-600' : a.status === 'ขาดเรียน' ? 'bg-red-400 text-red-600' : 'bg-blue-400 text-blue-600';
        return `<li class="relative pl-8">
            <div class="absolute w-5 h-5 ${colorClass.split(' ')[0]} rounded-full left-[-10px] top-1 border-4 border-white shadow-md"></div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-gray-800">${a.courseId} (ครั้งที่ ${a.sessionNo})</span>
                    <span class="${colorClass.split(' ')[1]} font-bold text-sm bg-gray-50 px-2 py-1 rounded-lg">${a.status}</span>
                </div>
                <div class="text-xs text-gray-500 mt-2 flex justify-between items-center border-t border-dashed pt-2">
                    <span><i class="fa-regular fa-clock mr-1"></i> ${a.date}, ${a.time}</span>
                </div>
            </div></li>`;
    }).join('');
}