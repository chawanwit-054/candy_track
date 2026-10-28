function initReports() {
    const courseSelect = document.getElementById('report-course-filter');
    const sessionSelect = document.getElementById('report-session-filter');
    if (!courseSelect || !sessionSelect) return;

    courseSelect.innerHTML = '<option value="ALL">-- ทุกรายวิชา --</option>';
    DB_COURSES.forEach(c => courseSelect.innerHTML += `<option value="${c.id}">${c.id} - ${c.name}</option>`);

    courseSelect.onchange = () => {
        const courseId = courseSelect.value;
        sessionSelect.innerHTML = '<option value="ALL">-- ทุกครั้ง --</option>';
        if (courseId !== 'ALL') {
            const sessions = DB_SESSIONS.filter(s => s.courseId === courseId);
            sessions.forEach(s => sessionSelect.innerHTML += `<option value="${s.sessionNo}">ครั้งที่ ${s.sessionNo}</option>`);
        }
        renderReportTable();
    };

    sessionSelect.onchange = renderReportTable;
    renderReportTable();
}

function renderReportTable() {
    const courseFilter = document.getElementById('report-course-filter').value;
    const sessionFilter = document.getElementById('report-session-filter').value;

    let filtered = DB_ATTENDANCE;
    if (courseFilter !== 'ALL') filtered = filtered.filter(a => a.courseId === courseFilter);
    if (sessionFilter !== 'ALL') filtered = filtered.filter(a => a.sessionNo == sessionFilter);

    document.getElementById('report-count-text').innerText = `พบ ${filtered.length} รายการ`;
    const tbody = document.getElementById('report-table-body');
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-400">ไม่พบข้อมูลการเช็คชื่อ</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.sort((a,b) => b.timestamp - a.timestamp).map(a => `
        <tr class="hover:bg-gray-50">
            <td class="p-3">${a.date} ${a.time}</td>
            <td class="p-3 font-bold">${a.sessionNo}</td>
            <td class="p-3">${a.courseId}</td>
            <td class="p-3 font-mono">${a.studentId}</td>
            <td class="p-3">${a.name}</td>
            <td class="p-3">${a.distance ? a.distance + 'm' : '-'}</td>
            <td class="p-3 text-center">
                <span class="px-2 py-1 rounded text-xs font-bold ${a.status === 'มาเรียน' ? 'bg-green-100 text-green-700' : a.status === 'มาสาย' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}">${a.status}</span>
            </td>
        </tr>
    `).join('');
}

function exportExcel() {
    const table = document.getElementById('report-table-area').querySelector('table');
    const wb = XLSX.utils.table_to_book(table, { sheet: "Attendance_Report" });
    XLSX.writeFile(wb, `Attendance_Report_${Date.now()}.xlsx`);
}

function exportPDF() {
    const element = document.getElementById('report-table-area');
    const opt = {
        margin: 0.5,
        filename: `Attendance_Report_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
}