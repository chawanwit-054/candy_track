let currentRollCallCourse = null, currentRollCallSession = 1;

function initManualAttendance() {
    if (!document.getElementById('rollcall-course-select')) return;
    const select = document.getElementById('rollcall-course-select'); 
    select.innerHTML = '<option value="">-- กรุณาเลือกวิชา --</option>';
    DB_COURSES.forEach(c => select.innerHTML += `<option value="${c.id}">${c.id} - ${c.name}</option>`);
    
    select.onchange = (e) => {
        const courseId = e.target.value; 
        const hintEl = document.getElementById('rollcall-session-hint'); 
        const sessionInput = document.getElementById('rollcall-session-no');
        document.getElementById('rollcall-table-container').classList.add('hidden');
        if (!courseId) { hintEl.classList.add('hidden'); return; }
        const pastSessions = DB_SESSIONS.filter(s => s.courseId === courseId);
        hintEl.classList.remove('hidden');
        if (pastSessions.length > 0) {
            pastSessions.sort((a, b) => b.sessionNo - a.sessionNo); 
            sessionInput.value = pastSessions[0].sessionNo + 1;
            hintEl.innerHTML = `<i class="fa-solid fa-circle-info mr-1"></i> ล่าสุดคือ <b>ครั้งที่ ${pastSessions[0].sessionNo}</b>`; 
            hintEl.className = "text-xs text-blue-700 mb-6 bg-blue-50 p-3 rounded-xl border border-blue-200 shadow-sm block";
        } else {
            sessionInput.value = 1; 
            hintEl.innerHTML = `<i class="fa-solid fa-star mr-1"></i> ยังไม่เคยมีการเช็คชื่อ เริ่มต้นที่ <b>ครั้งที่ 1</b>`; 
            hintEl.className = "text-xs text-green-700 mb-6 bg-green-50 p-3 rounded-xl border border-green-200 shadow-sm block";
        }
    };
}

function fetchRollCallList() {
    const courseId = document.getElementById('rollcall-course-select').value; 
    const sessionNo = parseInt(document.getElementById('rollcall-session-no').value);
    if (!courseId || !sessionNo) return Swal.fire('ข้อมูลไม่ครบ', '', 'warning');
    currentRollCallCourse = courseId; 
    currentRollCallSession = sessionNo;
    const enrolledIds = DB_ENROLLMENTS.filter(e => e.courseId === courseId).map(e => e.studentId);
    const students = DB_STUDENTS.filter(s => enrolledIds.includes(s.id));
    if (students.length === 0) return Swal.fire('ไม่มีข้อมูล', 'วิชานี้ยังไม่มีผู้เรียน', 'info');

    document.getElementById('rollcall-table-container').classList.remove('hidden');
    const tbody = document.getElementById('rollcall-table-body');
    const existingRecords = DB_ATTENDANCE.filter(a => a.courseId === courseId && a.sessionNo == sessionNo);

    tbody.innerHTML = students.map((s, idx) => {
        const record = existingRecords.find(a => a.studentId === s.id); 
        const st = record ? record.status : '';
        return `<tr class="hover:bg-gray-100/50 transition-colors">
                <td class="p-3 text-center text-gray-500 bg-white">${idx + 1}</td>
                <td class="p-3 font-mono font-bold text-gray-800 bg-white">${s.id}</td>
                <td class="p-3 bg-white font-medium">${s.name}</td>
                <td class="p-3 bg-gray-50/50">
                    <div class="flex flex-wrap gap-2 rollcall-options" data-id="${s.id}" data-name="${s.name}">
                        ${generateStatusRadio(s.id, 'มาเรียน', st)} 
                        ${generateStatusRadio(s.id, 'มาสาย', st)}
                        ${generateStatusRadio(s.id, 'ขาดเรียน', st)} 
                        ${generateStatusRadio(s.id, 'ลาป่วย', st)} 
                        ${generateStatusRadio(s.id, 'ลากิจ', st)}
                    </div>
                </td></tr>`;
    }).join('');
}

function generateStatusRadio(id, val, curr) {
    return `<label class="cursor-pointer">
        <input type="radio" name="st-${id}" value="${val}" class="peer sr-only" ${curr === val ? 'checked' : ''}>
        <span class="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-600 peer-checked:bg-candy-darkPink peer-checked:text-white peer-checked:border-candy-darkPink transition-all inline-block">${val}</span>
    </label>`;
}

function markAllRollCallPresent() {
    document.querySelectorAll('#rollcall-table-body input[value="มาเรียน"]').forEach(radio => radio.checked = true);
}

async function saveManualAttendance() {
    if (!currentRollCallCourse || !currentRollCallSession) return;
    const rows = document.querySelectorAll('.rollcall-options');
    const updates = [];
    rows.forEach(row => {
        const stdId = row.dataset.id;
        const name = row.dataset.name;
        const checkedRadio = row.querySelector('input[type="radio"]:checked');
        if (checkedRadio) {
            updates.push({
                id: 'A' + Date.now() + Math.floor(Math.random() * 1000),
                timestamp: Date.now(),
                date: new Date().toLocaleDateString('th-TH'),
                time: new Date().toLocaleTimeString('th-TH'),
                sessionNo: currentRollCallSession,
                studentId: stdId,
                name: name,
                courseId: currentRollCallCourse,
                distance: 0,
                status: checkedRadio.value
            });
        }
    });

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const res = await callAPI('saveManualAttendance', { courseId: currentRollCallCourse, sessionNo: currentRollCallSession, records: updates });
        if (res && res.attendance) DB_ATTENDANCE = res.attendance;
        Swal.fire({ icon: 'success', title: 'บันทึกการเช็คชื่อสำเร็จ', timer: 1500, showConfirmButton: false });
    } catch (err) {
        Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
    }
}