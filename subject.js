function renderCourseTable() {
    if (!document.getElementById('course-table-body')) return;
    const tbody = document.getElementById('course-table-body');
    tbody.innerHTML = DB_COURSES.map(c => {
        const enrolled = DB_ENROLLMENTS.filter(e => e.courseId === c.id).length;
        return `<tr class="hover:bg-gray-50 transition-colors">
            <td class="p-4 font-bold text-gray-800">${c.id}</td><td class="p-4 text-gray-600">${c.name}</td>
            <td class="p-4 text-center"><button onclick="manageCourseEnrollment('${c.id}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-lg text-sm font-bold"><i class="fa-solid fa-users mr-1"></i> ${enrolled}</button></td>
            <td class="p-4 text-xs font-mono text-gray-500">${parseFloat(c.lat).toFixed(5)}, <br>${parseFloat(c.lng).toFixed(5)}</td>
            <td class="p-4 text-center"><span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">เปิด</span></td>
            <td class="p-4 text-center">
                <button onclick="editCourse('${c.id}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-lg mr-1"><i class="fa-solid fa-edit"></i></button>
                <button onclick="deleteCourse('${c.id}')" class="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg"><i class="fa-solid fa-trash"></i></button>
            </td></tr>`;
    }).join('');
}

function openCourseModal(mode = 'add', id = '') {
    document.getElementById('modal-course').classList.remove('hidden-view');
    const form = document.getElementById('form-course'); form.reset();
    document.getElementById('course-mode').value = mode; 
    document.getElementById('modal-course-title').innerText = mode === 'add' ? 'เพิ่มวิชาใหม่' : 'แก้ไขรายวิชา';
    if (mode === 'edit') {
        const c = DB_COURSES.find(c => c.id === id); 
        document.getElementById('course-old-id').value = c.id;
        const parts = c.id.split('-Sec'); 
        document.getElementById('course-id').value = parts[0]; 
        document.getElementById('course-sec').value = parts[1] || '';
        document.getElementById('course-name').value = c.name; 
        document.getElementById('course-lat').value = c.lat; 
        document.getElementById('course-lng').value = c.lng;
    }
}

function getCurrentTeacherGPS() {
    Swal.fire({ title: 'กำลังค้นหาพิกัด...', didOpen: () => Swal.showLoading() });
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                document.getElementById('course-lat').value = pos.coords.latitude; 
                document.getElementById('course-lng').value = pos.coords.longitude;
                Swal.fire({ icon: 'success', title: 'ดึงพิกัดสำเร็จ', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
            },
            (err) => Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเข้าถึง Location ได้', 'error'), 
            { enableHighAccuracy: true }
        );
    }
}

async function saveCourse(e) {
    e.preventDefault();
    const mode = document.getElementById('course-mode').value;
    const newId = document.getElementById('course-id').value + '-Sec' + document.getElementById('course-sec').value;
    const name = document.getElementById('course-name').value;
    const lat = parseFloat(document.getElementById('course-lat').value);
    const lng = parseFloat(document.getElementById('course-lng').value);
    
    if (isNaN(lat) || isNaN(lng)) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาดึงพิกัด GPS ก่อน', 'warning');
    const oldId = mode === 'edit' ? document.getElementById('course-old-id').value : null;

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        if (mode === 'add') {
            if (DB_COURSES.find(c => c.id === newId)) throw new Error("รหัสและ Sec นี้มีอยู่แล้ว");
            DB_COURSES.push({ id: newId, name, lat, lng, active: true });
        } else {
            const idx = DB_COURSES.findIndex(c => c.id === oldId); 
            DB_COURSES[idx] = { ...DB_COURSES[idx], id: newId, name, lat, lng };
            if (oldId !== newId) DB_ENROLLMENTS.forEach(en => { if (en.courseId === oldId) en.courseId = newId; });
        }
        try { await callAPI('saveCourse', { mode, oldId, course: { id: newId, name, sec: document.getElementById('course-sec').value, lat, lng, active: true } }); } catch (err) { }
        closeModal('modal-course'); 
        renderCourseTable(); 
        updateTeacherDashboard();
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
    } catch (err) { Swal.fire('เกิดข้อผิดพลาด', err.message, 'error'); }
}

function editCourse(id) { openCourseModal('edit', id); }

function deleteCourse(id) {
    Swal.fire({ title: 'ยืนยันการลบ', text: `คุณต้องการลบวิชา ${id}?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
        .then(async (res) => {
            if (res.isConfirmed) {
                Swal.fire({ title: 'กำลังลบ...', didOpen: () => Swal.showLoading() });
                try {
                    DB_COURSES = DB_COURSES.filter(c => c.id !== id); 
                    DB_ENROLLMENTS = DB_ENROLLMENTS.filter(e => e.courseId !== id);
                    try { await callAPI('deleteCourse', { id }); } catch (err) { }
                    renderCourseTable(); 
                    updateTeacherDashboard(); 
                    Swal.close();
                } catch (err) { Swal.fire('ผิดพลาด', err.message, 'error'); }
            }
        });
}