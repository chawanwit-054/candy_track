var projInterval, projTimerInterval, projLiveInterval;
var projCurrentCourse, projSessionNo, projLateTime;

function populateSessionCourseDropdown() {
    if (!document.getElementById('session-course-select')) return;
    const select = document.getElementById('session-course-select'); 
    select.innerHTML = '<option value="">-- กรุณาเลือกวิชา --</option>';
    DB_COURSES.forEach(c => select.innerHTML += `<option value="${c.id}">${c.id} - ${c.name}</option>`);
    
    select.onchange = (e) => {
        const courseId = e.target.value; 
        const hintEl = document.getElementById('session-no-hint'); 
        const inputEl = document.getElementById('session-no-input');
        if (!courseId) { inputEl.value = ""; return; }
        const pastSessions = DB_SESSIONS.filter(s => String(s.courseId).trim() === String(courseId).trim()).sort((a, b) => parseInt(b.sessionNo) - parseInt(a.sessionNo));
        if (pastSessions.length > 0) { 
            const lastNo = parseInt(pastSessions[0].sessionNo) || 1;
            inputEl.value = lastNo + 1; 
            inputEl.max = lastNo + 1; 
            hintEl.innerHTML = `ล่าสุดคือ <b>ครั้งที่ ${lastNo}</b>`; 
        } else { 
            inputEl.value = 1; 
            inputEl.max = 1; 
            hintEl.innerHTML = `เริ่มต้นที่ <b>ครั้งที่ 1</b>`; 
        }
    };
}

async function startProjectorSession() {
    const courseId = document.getElementById('session-course-select').value;
    const sessionNo = parseInt(document.getElementById('session-no-input').value);
    const lateTime = document.getElementById('session-late-time').value;
    if (!courseId || !sessionNo || !lateTime) return Swal.fire('ข้อมูลไม่ครบ', '', 'warning');

    Swal.fire({ title: 'กำลังเปิดระบบ...', didOpen: () => Swal.showLoading() });
    try {
        try {
            const res = await callAPI('startSession', { courseId, sessionNo, lateTime });
            if (res && res.sessions) DB_SESSIONS = res.sessions;
        } catch (e) {
            if (!DB_SESSIONS.find(s => String(s.courseId).trim() === String(courseId).trim() && parseInt(s.sessionNo) === sessionNo)) {
                DB_SESSIONS.push({ courseId, sessionNo, lateTime, startTime: Date.now() });
            }
        }
        projCurrentCourse = courseId; 
        projSessionNo = sessionNo; 
        projLateTime = lateTime;
        const course = DB_COURSES.find(c => String(c.id).trim() === String(courseId).trim());
        const courseNameStr = course ? course.name : courseId;
        document.getElementById('proj-course-name').innerText = `${courseNameStr} (${courseId})`;
        document.getElementById('proj-session-info').innerText = `ครั้งที่ ${sessionNo}`;
        document.getElementById('projector-overlay').classList.remove('hidden-view');

        projInterval = setInterval(() => { document.getElementById('proj-time').innerText = new Date().toLocaleTimeString('th-TH'); }, 1000);
        generateProjQR(); 
        startProjTimer(); 
        updateProjLiveList(); 
        
        // ⚡ ดึงรายชื่อ Realtime ทุกๆ 3 วินาที
        if (projLiveInterval) clearInterval(projLiveInterval);
        projLiveInterval = setInterval(updateProjLiveList, 3000);

        Swal.close();
    } catch (err) { Swal.fire('ผิดพลาด', err.message, 'error'); }
}

function startProjTimer() {
    let seconds = 60;
    const bar = document.getElementById('proj-timer-bar');
    const text = document.getElementById('proj-timer-text');

    bar.style.width = '100%';
    text.innerText = '60 วิ';

    if (projTimerInterval) clearInterval(projTimerInterval);
    projTimerInterval = setInterval(() => {
        seconds--;
        let width = (seconds / 60) * 100;
        bar.style.width = width + '%';
        text.innerText = seconds + ' วิ';

        if (seconds <= 0) {
            generateProjQR();
            seconds = 60;
            bar.style.width = '100%';
            updateProjLiveList();
        }
    }, 1000);
}

// 🛠️ ฟังก์ชันสร้าง QR Code กระชับ ป้องกันความยาวล้น
function generateProjQR() {
    const container = document.getElementById('proj-qr-container');
    container.innerHTML = '';

    let baseUrl = window.location.href.split('#')[0];
    baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/'));

    const checkinUrl = `${baseUrl}/scan_checkin.html?c=${encodeURIComponent(projCurrentCourse)}&s=${projSessionNo}&t=${Date.now()}`;

    new QRCode(container, {
        text: checkinUrl,
        width: 350,
        height: 350,
        colorDark: "#BE185D",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.L
    });
}

// 🛠️ ฟังก์ชันดึงรายชื่อ Realtime ปรับปรุงการตรวจสอบข้อความ ตัดช่องว่าง และแปลงชนิดข้อมูล
async function updateProjLiveList() {
    try {
        const res = await callAPI('getAttendanceLive', { courseId: projCurrentCourse, sessionNo: projSessionNo });
        if (res && res.attendance) DB_ATTENDANCE = res.attendance;
    } catch (e) { 
        console.warn("Live fetch warning:", e);
    }
    
    const sessionData = DB_ATTENDANCE.filter(a => {
        if (!a) return false;
        const cMatch = String(a.courseId || '').trim().toLowerCase() === String(projCurrentCourse || '').trim().toLowerCase();
        const sMatch = parseInt(a.sessionNo, 10) === parseInt(projSessionNo, 10);
        const statusClean = String(a.status || '').trim();
        const statusMatch = (statusClean === 'มาเรียน' || statusClean === 'มาสาย');
        return cMatch && sMatch && statusMatch;
    });

    document.getElementById('proj-live-count').innerText = sessionData.length;
    const tbody = document.getElementById('proj-live-list');
    
    if (sessionData.length === 0) { 
        tbody.innerHTML = `<li class="text-center text-gray-400 py-10">ยังไม่มีผู้ลงชื่อ...</li>`; 
        return; 
    }
    
    tbody.innerHTML = sessionData.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)).map(a => {
        const stName = a.name || a.studentId || 'นักศึกษา';
        const stStatus = String(a.status || '').trim();
        const isNormal = stStatus === 'มาเรียน';
        return `
        <li class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full ${isNormal ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'} flex items-center justify-center font-bold"><i class="fa-solid fa-check"></i></div>
                <div><p class="font-bold text-gray-800">${stName}</p><p class="text-xs text-gray-500">${a.studentId} • ${a.time || '-'}</p></div>
            </div>
            <span class="${isNormal ? 'text-green-600' : 'text-yellow-600'} font-bold text-sm bg-gray-50 px-2 py-1 rounded">${stStatus}</span>
        </li>`;
    }).join('');
}

async function stopProjectorSession() {
    if (projLiveInterval) clearInterval(projLiveInterval);
    if (projTimerInterval) clearInterval(projTimerInterval); 
    if (projInterval) clearInterval(projInterval);
    document.getElementById('projector-overlay').classList.add('hidden-view');
    Swal.fire({ title: 'กำลังปิดระบบและสรุปผล...', didOpen: () => Swal.showLoading() });

    const currCourse = String(projCurrentCourse || '').trim().toLowerCase();
    const currSess = parseInt(projSessionNo, 10);

    const enrolled = DB_ENROLLMENTS.filter(e => String(e.courseId || '').trim().toLowerCase() === currCourse).map(e => String(e.studentId).trim());
    const attended = DB_ATTENDANCE.filter(a => String(a.courseId || '').trim().toLowerCase() === currCourse && parseInt(a.sessionNo, 10) === currSess).map(a => String(a.studentId).trim());

    enrolled.forEach(stdId => {
        if (!attended.includes(stdId)) {
            const s = DB_STUDENTS.find(x => String(x.id).trim() === stdId);
            if (s) DB_ATTENDANCE.push({ id: 'A' + Date.now() + Math.floor(Math.random() * 1000), timestamp: Date.now(), date: new Date().toLocaleDateString('th-TH'), time: '-', sessionNo: projSessionNo, studentId: stdId, name: s.name, courseId: projCurrentCourse, distance: 0, status: 'ขาดเรียน' });
        }
    });
    try {
        const res = await callAPI('closeSession', { courseId: projCurrentCourse, sessionNo: projSessionNo });
        if (res && res.attendance) DB_ATTENDANCE = res.attendance;
    } catch (err) { console.warn("Sync error", err); }

    projCurrentCourse = null; 
    if(typeof updateTeacherDashboard === 'function') updateTeacherDashboard();
    Swal.fire('ปิดระบบสำเร็จ', 'ระบบบันทึกขาดเรียนอัตโนมัติเรียบร้อย', 'success');
}