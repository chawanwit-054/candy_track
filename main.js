const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6Us1RWIER765S-pOIRCYLTQIqmJngzjiRzUDgAtxR835NZz7iaHA_knOe56JFKIb6/exec';

// State Management Global Variables
let DB_COURSES = [], DB_STUDENTS = [], DB_ENROLLMENTS = [], DB_SESSIONS = [], DB_ATTENDANCE = [];
let currentUserInfo = null;

// INIT LOGIC
document.addEventListener('DOMContentLoaded', () => {
    const storedData = sessionStorage.getItem('candy_data');
    if (!storedData) {
        window.location.href = 'login.html';
        return;
    }

    const data = JSON.parse(storedData);
    currentUserInfo = data.user;
    DB_COURSES = data.courses || [];
    DB_STUDENTS = data.students || [];
    DB_ENROLLMENTS = data.enrollments || [];
    DB_SESSIONS = data.sessions || [];
    DB_ATTENDANCE = data.attendance || [];

    if (currentUserInfo.role === 'teacher') {
        document.getElementById('t-user-name').innerText = currentUserInfo.name;
        document.getElementById('t-user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserInfo.name)}&background=FBCFE8&color=BE185D`;
        switchView('teacher-view');
        switchTeacherTab('t-dashboard');
    } else {
        document.getElementById('s-user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserInfo.name)}&background=E9D5FF&color=7E22CE`;
        switchView('student-view');
        switchStudentTab('s-home');
    }

    // Sidebar Event Listeners
    const toggleSidebar = document.getElementById('toggle-sidebar');
    if (toggleSidebar) {
        toggleSidebar.addEventListener('click', () => {
            const sidebar = document.getElementById('teacher-sidebar');
            sidebar.classList.toggle('w-64'); 
            sidebar.classList.toggle('w-20');
            document.querySelectorAll('.menu-text').forEach(el => el.classList.toggle('hidden'));
        });
    }

    const mobileToggle = document.getElementById('mobile-sidebar-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            document.getElementById('teacher-sidebar').classList.toggle('hidden-view');
            document.getElementById('teacher-sidebar').classList.add('absolute', 'h-full');
        });
    }
});

// LOGOUT
function logout() {
    Swal.fire({
        title: 'ออกจากระบบ?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#F472B6', cancelButtonColor: '#d33',
        confirmButtonText: 'ออกจากระบบ', cancelButtonText: 'ยกเลิก'
    }).then((res) => {
        if (res.isConfirmed) {
            sessionStorage.removeItem('candy_data');
            window.location.href = 'login.html';
        }
    });
}

// Global API Function
async function callAPI(action, payload = {}) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: action, payload: payload })
        });
        const result = await response.json();
        if (result.status === 'success') return result.data;
        else throw new Error(result.message);
    } catch (error) { console.error("API Error:", error); throw error; }
}

// Global Profile Management
function openProfileModal() {
    if (!currentUserInfo) return;
    document.getElementById('modal-profile').classList.remove('hidden-view');
    document.getElementById('profile-email').value = currentUserInfo.email;
    document.getElementById('profile-name').value = currentUserInfo.name;
    document.getElementById('profile-password').value = '';
}

async function saveProfile(e) {
    e.preventDefault();
    const newName = document.getElementById('profile-name').value;
    const newPassword = document.getElementById('profile-password').value;
    Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await callAPI('updateProfile', { id: currentUserInfo.id, name: newName, password: newPassword });
        currentUserInfo.name = newName;
        if (currentUserInfo.role === 'teacher') {
            document.getElementById('t-user-name').innerText = newName;
            document.getElementById('t-user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=FBCFE8&color=BE185D`;
        } else {
            document.getElementById('s-user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=E9D5FF&color=7E22CE`;
        }
        const sessionData = JSON.parse(sessionStorage.getItem('candy_data'));
        sessionData.user.name = newName;
        sessionStorage.setItem('candy_data', JSON.stringify(sessionData));
        closeModal('modal-profile');
        Swal.fire({ icon: 'success', title: 'อัปเดตข้อมูลสำเร็จ', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
    } catch (err) { Swal.fire('เกิดข้อผิดพลาด', err.message, 'error'); }
}

function switchView(viewId) {
    ['teacher-view', 'student-view'].forEach(v => document.getElementById(v).classList.add('hidden-view'));
    document.getElementById(viewId).classList.remove('hidden-view');
}

function closeModal(id) { document.getElementById(id).classList.add('hidden-view'); }

// ================== AJAX TAB LOADER ==================
const tabFiles = {
    't-dashboard': 'dashboard.html', 't-courses': 'subject.html', 't-students': 'student.html',
    't-attendance': 'qr_generate.html', 't-manual-attendance': 'student_check.html', 't-reports': 'report.html'
};
const loadedTabs = {};

async function switchTeacherTab(tabId) {
    document.querySelectorAll('.t-nav-btn').forEach(btn => {
        if (btn.dataset.target === tabId) {
            btn.classList.add('bg-candy-purple', 'text-candy-textPurple'); btn.classList.remove('text-gray-600');
            document.getElementById('t-page-title').innerText = btn.querySelector('.menu-text').innerText;
        } else {
            btn.classList.remove('bg-candy-purple', 'text-candy-textPurple'); btn.classList.add('text-gray-600');
        }
    });
    document.querySelectorAll('.t-tab-content').forEach(c => c.classList.add('hidden'));

    if (!loadedTabs[tabId]) {
        Swal.fire({ title: 'กำลังโหลด...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const response = await fetch(tabFiles[tabId]);
            if (!response.ok) throw new Error('ไม่พบไฟล์ ' + tabFiles[tabId]);
            const html = await response.text();
            const wrapper = document.createElement('div');
            wrapper.id = tabId; wrapper.className = 't-tab-content w-full h-full';
            wrapper.innerHTML = html;
            document.getElementById('teacher-content-area').appendChild(wrapper);

            // Execute Inline Scripts in sub-html if any
            const scripts = wrapper.querySelectorAll('script');
            scripts.forEach(script => {
                const newScript = document.createElement('script');
                newScript.textContent = script.innerHTML;
                document.body.appendChild(newScript);
                newScript.remove();
            });

            loadedTabs[tabId] = true; 
            Swal.close();
        } catch (error) {
            Swal.fire('ข้อผิดพลาด', error.message + '\n\n(หากรันไฟล์ index.html ตรงๆ ให้รันผ่าน Local Server)', 'error');
            return;
        }
    } else {
        document.getElementById(tabId).classList.remove('hidden');
    }

    // Call Module Initializer Functions
    if (tabId === 't-dashboard' && typeof updateTeacherDashboard === 'function') updateTeacherDashboard();
    if (tabId === 't-courses' && typeof renderCourseTable === 'function') renderCourseTable();
    if (tabId === 't-students' && typeof renderStudentTable === 'function') renderStudentTable();
    if (tabId === 't-attendance' && typeof populateSessionCourseDropdown === 'function') populateSessionCourseDropdown();
    if (tabId === 't-manual-attendance' && typeof initManualAttendance === 'function') initManualAttendance();
    if (tabId === 't-reports' && typeof initReports === 'function') initReports();
    if (window.innerWidth < 768) document.getElementById('teacher-sidebar').classList.add('hidden-view');
}