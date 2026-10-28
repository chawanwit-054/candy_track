var projInterval, projTimerInterval, projLiveInterval;
var projCurrentCourse, projSessionNo, projLateTime;

function populateSessionCourseDropdown() {
    if (!document.getElementById('session-course-select')) return;
    const select = document.getElementById('session-course-select'); 
    select.innerHTML = '<option value="">-- กรุณาเลือกวิชา --</option>';
    if (typeof DB_COURSES !== 'undefined' && Array.isArray(DB_COURSES)) {
        DB_COURSES.forEach(c => select.innerHTML += `<option value="${c.id}">${c.id} - ${c.name}</option>`);
    }
    
    select.onchange = (e) => {
        const courseId = e.target.value; 
        const hintEl = document.getElementById('session-no-hint'); 
        const inputEl = document.getElementById('session-no-input');
        if (!courseId) { inputEl.value = ""; return; }
        
        const pastSessions = (typeof DB_SESSIONS !== 'undefined' ? DB_SESSIONS : [])
            .filter(s => String(s.courseId || '').trim().toLowerCase() === String(courseId).trim().toLowerCase())
            .sort((a, b) => parseInt(b.sessionNo, 10) - parseInt(a.sessionNo, 10));
            
        if (pastSessions.length > 0) { 
            const lastNo = parseInt(pastSessions[0].sessionNo, 10) || 1;
            inputEl.value = lastNo + 1; 
            inputEl.max = lastNo + 1; 
            if (hintEl) hintEl.innerHTML = `ล่าสุดคือ <b>ครั้งที่ ${lastNo}</b>`; 
        } else { 
            inputEl.value = 1; 
            inputEl.max = 1; 
            if (hintEl) hintEl.innerHTML = `เริ่มต้นที่ <b>ครั้งที่ 1</b>`; 
        }
    };
}

async function startProjectorSession() {
    const selectEl = document.getElementById('session-course-select');
    const inputEl = document.getElementById('session-no-input');
    const lateEl = document.getElementById('session-late-time');

    if (!selectEl || !inputEl || !lateEl) return;

    const courseId = selectEl.value;
    const sessionNo = parseInt(inputEl.value, 10);
    const lateTime = lateEl.value;
    
    if (!courseId || !sessionNo || !lateTime) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');

    Swal.fire({ title: 'กำลังเปิดระบบ...', didOpen: () => Swal.showLoading() });
    try {
        try {
            const res = await callAPI('startSession', { courseId, sessionNo, lateTime });
            if (res) {
                if (Array.isArray(res.sessions)) DB_SESSIONS = res.sessions;
                else if (res.data && Array.isArray(res.data.sessions)) DB_SESSIONS = res.data.sessions;
            }
        } catch (e) {
            console.warn("startSession API notice:", e);
            if (typeof DB_SESSIONS !== 'undefined') {
                if (!DB_SESSIONS.find(s => String(s.courseId || '').trim().toLowerCase() === String(courseId).trim().toLowerCase() && parseInt(s.sessionNo, 10) === sessionNo)) {
                    DB_SESSIONS.push({ courseId, sessionNo, lateTime, startTime: Date.now() });
                }
            }
        }

        projCurrentCourse = courseId; 
        projSessionNo = sessionNo; 
        projLateTime = lateTime;

        const course = (typeof DB_COURSES !== 'undefined' ? DB_COURSES : []).find(c => String(c.id || '').trim().toLowerCase() === String(courseId).trim().toLowerCase());
        const courseNameStr = course ? course.name : courseId;
        
        const nameEl = document.getElementById('proj-course-name');
        const infoEl = document.getElementById('proj-session-info');
        const overlayEl = document.getElementById('projector-overlay');

        if (nameEl) nameEl.innerText = `${courseNameStr} (${courseId})`;
        if (infoEl) infoEl.innerText = `ครั้งที่ ${sessionNo}`;
        if (overlayEl) overlayEl.classList.remove('hidden-view');

        if (projInterval) clearInterval(projInterval);
        projInterval = setInterval(() => { 
            const timeEl = document.getElementById('proj-time');
            if (timeEl) timeEl.innerText = new Date().toLocaleTimeString('th-TH'); 
        }, 1000);

        generateProjQR(); 
        startProjTimer(); 
        await updateProjLiveList(); 
        
        // ⚡ ดึงรายชื่อ Realtime ทุกๆ 3 วินาที
        if (projLiveInterval) clearInterval(projLiveInterval);
        projLiveInterval = setInterval(updateProjLiveList, 3000);

        Swal.close();
    } catch (err) { 
        Swal.fire('ผิดพลาด', err.message || 'ไม่สามารถเปิดระบบได้', 'error'); 
    }
}

function startProjTimer() {
    let seconds = 60;
    const bar = document.getElementById('proj-timer-bar');
    const text = document.getElementById('proj-timer-text');

    if (bar) bar.style.width = '100%';
    if (text) text.innerText = '60 วิ';

    if (projTimerInterval) clearInterval(projTimerInterval);
    projTimerInterval = setInterval(() => {
        seconds--;
        let width = (seconds / 60) * 100;
        if (bar) bar.style.width = width + '%';
        if (text) text.innerText = seconds + ' วิ';

        if (seconds <= 0) {
            generateProjQR();
            seconds = 60;
            if (bar) bar.style.width = '100%';
            updateProjLiveList();
        }
    }, 1000);
}

// 🛠️ ฟังก์ชันสร้าง QR Code กระชับ ป้องกันความยาวล้น
function generateProjQR() {
    const container = document.getElementById('proj-qr-container');
    if (!container) return;
    container.innerHTML = '';

    let baseUrl = window.location.href.split('#')[0];
    baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/'));

    const checkinUrl = `${baseUrl}/scan_checkin.html?c=${encodeURIComponent(projCurrentCourse)}&s=${projSessionNo}&t=${Date.now()}`;

    if (typeof QRCode !== 'undefined') {
        new QRCode(container, {
            text: checkinUrl,
            width: 350,
            height: 350,
            colorDark: "#BE185D",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });
    }
}

// 🛠️ ฟังก์ชันดึงรายชื่อ Realtime รองรับโครงสร้าง JSON ตอบกลับทุกรูปแบบ ตัดช่องว่าง และแปลงชนิดข้อมูล
async function updateProjLiveList() {
    try {
        const res = await callAPI('getAttendanceLive', { courseId: projCurrentCourse, sessionNo: projSessionNo });
        if (res) {
            if (Array.isArray(res.attendance)) {
                DB_ATTENDANCE = res.attendance;
            } else if (res.data && Array.isArray(res.data.attendance)) {
                DB_ATTENDANCE = res.data.attendance;
            } else if (res.data && Array.isArray(res.data)) {
                DB_ATTENDANCE = res.data;
            } else if (Array.isArray(res)) {
                DB_ATTENDANCE = res;
            }
        }
    } catch (e) { 
        console.warn("Live fetch warning:", e);
    }
    
    const attList = (typeof DB_ATTENDANCE !== 'undefined' && Array.isArray(DB_ATTENDANCE)) ? DB_ATTENDANCE : [];

    const sessionData = attList.filter(a => {
        if (!a) return false;
        const cMatch = String(a.courseId || '').trim().toLowerCase() === String(projCurrentCourse || '').trim().toLowerCase();
        const sMatch = parseInt(a.sessionNo, 10) === parseInt(projSessionNo, 10);
        const statusClean = String(a.status || '').trim();
        const statusMatch = (statusClean === 'มาเรียน' || statusClean === 'มาสาย');
        return cMatch && sMatch && statusMatch;
    });

    const countEl = document.getElementById('proj-live-count');
    if (countEl) countEl.innerText = sessionData.length;

    const tbody = document.getElementById('proj-live-list');
    if (!tbody) return;
    
    if (sessionData.length === 0) { 
        tbody.innerHTML = `<li class="text-center text-gray-400 py-10">ยังไม่มีผู้ลงชื่อ...</li>`; 
        return; 
    }
    
    tbody.innerHTML = sessionData.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)).map(a => {
        const stName = a.name || a.studentId || 'นักศึกษา';
        const stStatus = String(a.status || '').trim();
        const isNormal = stStatus === 'มาเรียน';
        const displayTime = a.time || '-';
        return `
        <li class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full ${isNormal ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'} flex items-center justify-center font-bold"><i class="fa-solid fa-check"></i></div>
                <div><p class="font-bold text-gray-800">${stName}</p><p class="text-xs text-gray-500">${a.studentId} • ${displayTime}</p></div>
            </div>
            <span class="${isNormal ? 'text-green-600' : 'text-yellow-600'} font-bold text-sm bg-gray-50 px-2 py-1 rounded">${stStatus}</span>
        </li>`;
    }).join('');
}

async function stopProjectorSession() {
    if (projLiveInterval) clearInterval(projLiveInterval);
    if (projTimerInterval) clearInterval(projTimerInterval); 
    if (projInterval) clearInterval(projInterval);

    const overlayEl = document.getElementById('projector-overlay');
    if (overlayEl) overlayEl.classList.add('hidden-view');

    Swal.fire({ title: 'กำลังปิดระบบและสรุปผล...', didOpen: () => Swal.showLoading() });

    const currCourse = String(projCurrentCourse || '').trim().toLowerCase();
    const currSess = parseInt(projSessionNo, 10);

    const enrollments = (typeof DB_ENROLLMENTS !== 'undefined' && Array.isArray(DB_ENROLLMENTS)) ? DB_ENROLLMENTS : [];
    const attendance = (typeof DB_ATTENDANCE !== 'undefined' && Array.isArray(DB_ATTENDANCE)) ? DB_ATTENDANCE : [];
    const students = (typeof DB_STUDENTS !== 'undefined' && Array.isArray(DB_STUDENTS)) ? DB_STUDENTS : [];

    const enrolled = enrollments.filter(e => String(e.courseId || '').trim().toLowerCase() === currCourse).map(e => String(e.studentId || '').trim());
    const attended = attendance.filter(a => String(a.courseId || '').trim().toLowerCase() === currCourse && parseInt(a.sessionNo, 10) === currSess).map(a => String(a.studentId || '').trim());

    enrolled.forEach(stdId => {
        if (!attended.includes(stdId)) {
            const s = students.find(x => String(x.id || '').trim() === stdId);
            if (s) {
                attendance.push({ 
                    id: 'A' + Date.now() + Math.floor(Math.random() * 1000), 
                    timestamp: Date.now(), 
                    date: new Date().toLocaleDateString('th-TH'), 
                    time: '-', 
                    sessionNo: projSessionNo, 
                    studentId: stdId, 
                    name: s.name, 
                    courseId: projCurrentCourse, 
                    distance: 0, 
                    status: 'ขาดเรียน' 
                });
            }
        }
    });

    try {
        const res = await callAPI('closeSession', { courseId: projCurrentCourse, sessionNo: projSessionNo });
        if (res) {
            if (Array.isArray(res.attendance)) DB_ATTENDANCE = res.attendance;
            else if (res.data && Array.isArray(res.data.attendance)) DB_ATTENDANCE = res.data.attendance;
        }
    } catch (err) { 
        console.warn("Sync error", err); 
    }

    projCurrentCourse = null; 
    if (typeof updateTeacherDashboard === 'function') updateTeacherDashboard();
    Swal.fire('ปิดระบบสำเร็จ', 'ระบบบันทึกขาดเรียนอัตโนมัติเรียบร้อย', 'success');
}