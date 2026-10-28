function renderStudentTable() {
    if (!document.getElementById('student-table-body')) return;
    const tbody = document.getElementById('student-table-body');
    tbody.innerHTML = DB_STUDENTS.map(s => `<tr class="hover:bg-gray-50">
            <td class="p-4 font-bold text-gray-800">${s.id}</td><td class="p-4 text-gray-600">${s.name}</td><td class="p-4 text-sm text-gray-500">${s.email}</td>
            <td class="p-4 text-center">
                <button onclick="editStudent('${s.id}')" class="text-blue-500 bg-blue-50 p-2 rounded-lg mr-1"><i class="fa-solid fa-edit"></i></button>
                <button onclick="deleteStudent('${s.id}')" class="text-red-500 bg-red-50 p-2 rounded-lg"><i class="fa-solid fa-trash"></i></button>
            </td></tr>`).join('');
}

function openStudentModal(mode = 'add', id = '') {
    document.getElementById('modal-student').classList.remove('hidden-view');
    const form = document.getElementById('form-student'); form.reset();
    document.getElementById('student-mode').value = mode; 
    document.getElementById('modal-student-title').innerText = mode === 'add' ? 'เพิ่มนักศึกษา' : 'แก้ไขข้อมูล';
    document.getElementById('student-id').readOnly = mode === 'edit';
    if (mode === 'edit') {
        const s = DB_STUDENTS.find(x => x.id === id);
        document.getElementById('student-id').value = s.id; 
        document.getElementById('student-name').value = s.name; 
        document.getElementById('student-email').value = s.email;
    }
}

async function saveStudent(e) {
    e.preventDefault();
    const mode = document.getElementById('student-mode').value;
    const student = { id: document.getElementById('student-id').value, name: document.getElementById('student-name').value, email: document.getElementById('student-email').value };
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        if (mode === 'add') {
            if (DB_STUDENTS.find(s => s.id === student.id)) throw new Error("รหัสนี้มีอยู่แล้ว");
            DB_STUDENTS.push(student);
        } else {
            const idx = DB_STUDENTS.findIndex(s => s.id === student.id); DB_STUDENTS[idx] = student;
        }
        try { await callAPI('saveStudent', { mode, student }); } catch (err) { }
        closeModal('modal-student'); 
        renderStudentTable(); 
        updateTeacherDashboard();
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
    } catch (err) { Swal.fire('ผิดพลาด', err.message, 'error'); }
}

function editStudent(id) { openStudentModal('edit', id); }

function deleteStudent(id) {
    Swal.fire({ title: 'ลบนักศึกษา?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
        .then(async (res) => {
            if (res.isConfirmed) {
                Swal.fire({ title: 'กำลังลบ...', didOpen: () => Swal.showLoading() });
                DB_STUDENTS = DB_STUDENTS.filter(s => s.id !== id); 
                DB_ENROLLMENTS = DB_ENROLLMENTS.filter(e => e.studentId !== id);
                try { await callAPI('deleteStudent', { id }); } catch (err) { }
                renderStudentTable(); 
                updateTeacherDashboard(); 
                Swal.close();
            }
        });
}

let currentManageCourse = null;

function manageCourseEnrollment(courseId) {
    currentManageCourse = courseId;
    document.getElementById('modal-enrollment').classList.remove('hidden-view');
    const course = DB_COURSES.find(c => c.id === courseId);
    document.getElementById('enroll-modal-title').innerText = `ผู้เรียน: ${course.name} (${course.id})`;
    renderEnrollmentTable();
}

function renderEnrollmentTable() {
    const enrolled = DB_ENROLLMENTS.filter(e => e.courseId === currentManageCourse).map(e => e.studentId);
    document.getElementById('enroll-table-body').innerHTML = enrolled.map(stdId => {
        const s = DB_STUDENTS.find(x => x.id === stdId);
        return s ? `<tr><td class="p-3 text-sm font-mono">${s.id}</td><td class="p-3 text-sm">${s.name}</td><td class="p-3 text-center"><button onclick="removeEnrollment('${s.id}')" class="text-red-500"><i class="fa-solid fa-trash"></i></button></td></tr>` : '';
    }).join('');
    const select = document.getElementById('enroll-add-select'); 
    select.innerHTML = '<option value="">-- เลือกนักศึกษาที่ต้องการเพิ่ม --</option>';
    DB_STUDENTS.filter(s => !enrolled.includes(s.id)).forEach(s => select.innerHTML += `<option value="${s.id}">${s.id} - ${s.name}</option>`);
}

async function addEnrollment() {
    const stdId = document.getElementById('enroll-add-select').value; if (!stdId) return;
    Swal.fire({ title: 'กำลังเพิ่ม...', didOpen: () => Swal.showLoading() });
    try {
        DB_ENROLLMENTS.push({ studentId: stdId, courseId: currentManageCourse });
        try { await callAPI('addEnrollment', { studentId: stdId, courseId: currentManageCourse }); } catch (e) { }
        renderEnrollmentTable(); 
        renderCourseTable(); 
        Swal.close();
    } catch (err) { Swal.fire('ผิดพลาด', err.message, 'error'); }
}

async function removeEnrollment(stdId) {
    Swal.fire({ title: 'กำลังนำออก...', didOpen: () => Swal.showLoading() });
    try {
        DB_ENROLLMENTS = DB_ENROLLMENTS.filter(e => !(e.studentId === stdId && e.courseId === currentManageCourse));
        try { await callAPI('removeEnrollment', { studentId: stdId, courseId: currentManageCourse }); } catch (e) { }
        renderEnrollmentTable(); 
        renderCourseTable(); 
        Swal.close();
    } catch (err) { Swal.fire('ผิดพลาด', err.message, 'error'); }
}