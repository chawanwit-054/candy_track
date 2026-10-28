function updateTeacherDashboard() {
    if (!document.getElementById('dash-courses')) return;
    document.getElementById('dash-courses').innerText = DB_COURSES.length;
    document.getElementById('dash-students').innerText = DB_STUDENTS.length;
    document.getElementById('dash-classes').innerText = DB_SESSIONS.length;
    document.querySelectorAll('.bar-animate').forEach(el => { 
        el.style.animation = 'none'; 
        el.offsetHeight; 
        el.style.animation = null; 
    });
}