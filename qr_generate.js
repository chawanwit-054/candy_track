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
        const pastSessions = DB_SESSIONS.filter(s => s.courseId === courseId).sort((a, b) => b.sessionNo - a.sessionNo);
        if (pastSessions.length > 0) { 
            inputEl.value = pastSessions[0].sessionNo + 1; 
            inputEl.max = pastSessions[0].sessionNo + 1; 
            hintEl.innerHTML = `ล่าสุดคือ <b>ครั้งที่ ${pastSessions[0].sessionNo}</b>`; 
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
            if (res.sessions) DB_SESSIONS = res.sessions;
        } catch (e) {
            if (!DB_SESSIONS.find(s => s.courseId === courseId && s.sessionNo === sessionNo)) DB_SESSIONS.push({ courseId, sessionNo, lateTime, startTime: Date.now() });
        }
        projCurrentCourse = courseId; 
        projSessionNo = sessionNo; 
        projLateTime = lateTime;
        const course = DB_COURSES.find(c => c.id === courseId);
        document.getElementById('proj-course-name').innerText = `${course.name} (${course.id})`;
        document.getElementById('proj-session-info').innerText = `ครั้งที่ ${sessionNo}`;
        document.getElementById('projector-overlay').classList.remove('hidden-view');

        projInterval = setInterval(() => { document.getElementById('proj-time').innerText = new Date().toLocaleTimeString('th-TH'); }, 1000);
        generateProjQR(); 
        startProjTimer(); 
        updateProjLiveList(); 
        
        // ⚡ เพิ่มระบบดึงรายชื่อ Realtime ทุกๆ 3 วินาที
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

function generateProjQR() {
    const container = document.getElementById('proj-qr-container');
    container.innerHTML = '';

    const course = DB_COURSES.find(c => c.id === projCurrentCourse);
    const courseName = course ? course.name : projCurrentCourse;

    let baseUrl = window.location.href.split('#')[0];
    baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/'));

    const checkinUrl = `${baseUrl}/scan_checkin.html?c=${encodeURIComponent(projCurrentCourse)}&cn=${encodeURIComponent(courseName)}&s=${projSessionNo}&t=${Date.now()}`;

    new QRCode(container, {
        text: checkinUrl,
        width: 350,
        height: 350,
        colorDark: "#BE185D",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

async function updateProjLiveList() {
    try {
        const res = await callAPI('getAttendanceLive', { courseId: projCurrentCourse, sessionNo: projSessionNo });
        if (res.attendance) DB_ATTENDANCE = res.attendance;
    } catch (e) { }
    const sessionData = DB_ATTENDANCE.filter(a => a.courseId === projCurrentCourse && parseInt(a.sessionNo) === projSessionNo && (a.status === 'มาเรียน' || a.status === 'มาสาย'));
    document.getElementById('proj-live-count').innerText = sessionData.length;
    const tbody = document.getElementById('proj-live-list');
    if (sessionData.length === 0) { tbody.innerHTML = `<li class="text-center text-gray-400 py-10">ยังไม่มีผู้ลงชื่อ...</li>`; return; }
    tbody.innerHTML = sessionData.sort((a, b) => b.timestamp - a.timestamp).map(a => `
        <li class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full ${a.status === 'มาเรียน' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'} flex items-center justify-center font-bold"><i class="fa-solid fa-check"></i></div>
                <div><p class="font-bold text-gray-800">${a.name}</p><p class="text-xs text-gray-500">${a.studentId} • ${a.time}</p></div>
            </div>
            <span class="${a.status === 'มาเรียน' ? 'text-green-600' : 'text-yellow-600'} font-bold text-sm bg-gray-50 px-2 py-1 rounded">${a.status}</span>
        </li>`).join('');
}

async function stopProjectorSession() {
    if (projLiveInterval) clearInterval(projLiveInterval);
    if (projTimerInterval) clearInterval(projTimerInterval); 
    if (projInterval) clearInterval(projInterval);
    document.getElementById('projector-overlay').classList.add('hidden-view');
    Swal.fire({ title: 'กำลังปิดระบบและสรุปผล...', didOpen: () => Swal.showLoading() });

    const enrolled = DB_ENROLLMENTS.filter(e => e.courseId === projCurrentCourse).map(e => e.studentId);
    const attended = DB_ATTENDANCE.filter(a => a.courseId === projCurrentCourse && a.sessionNo === projSessionNo).map(a => a.studentId);

    enrolled.forEach(stdId => {
        if (!attended.includes(stdId)) {
            const s = DB_STUDENTS.find(x => x.id === stdId);
            if (s) DB_ATTENDANCE.push({ id: 'A' + Date.now() + Math.floor(Math.random() * 1000), timestamp: Date.now(), date: new Date().toLocaleDateString('th-TH'), time: '-', sessionNo: projSessionNo, studentId: stdId, name: s.name, courseId: projCurrentCourse, distance: 0, status: 'ขาดเรียน' });
        }
    });
    try {
        const res = await callAPI('closeSession', { courseId: projCurrentCourse, sessionNo: projSessionNo });
        if (res.attendance) DB_ATTENDANCE = res.attendance;
    } catch (err) { console.warn("Sync error", err); }

    projCurrentCourse = null; 
    if(typeof updateTeacherDashboard === 'function') updateTeacherDashboard();
    Swal.fire('ปิดระบบสำเร็จ', 'ระบบบันทึกขาดเรียนอัตโนมัติเรียบร้อย', 'success');
}