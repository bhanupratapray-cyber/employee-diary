const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_umeCVHwoIt7a3Qp6UkXxEXyidK9nO1oHIwTblN951XUIQbrbOEFv-smdiTZyP5o4/exec";

let currentUser = null;
let currentMonth = new Date();
let attendanceData = [];

document.addEventListener("DOMContentLoaded", () => {
    const userStr = sessionStorage.getItem("currentUser");
    if (userStr) {
        currentUser = JSON.parse(userStr);
        if (currentUser.role === 'admin') {
            showAdminDashboard();
        } else {
            showDashboard();
        }
    }
});

function showLoading(show) {
    const ls = document.getElementById("loading-screen");
    if (show) ls.classList.remove("hidden");
    else ls.classList.add("hidden");
}

async function login() {
    const mobile = document.getElementById("mobile-input").value.trim();
    if (!mobile) return;
    
    // Handle admin login
    if (mobile === 'admin') {
        const pwd = prompt("Enter Admin Password:");
        if (pwd === '2026') {
            currentUser = { id: 'admin', name: 'Administrator', role: 'admin' };
            sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
            showAdminDashboard();
            return;
        } else {
            alert("Incorrect Password!");
            return;
        }
    }
    
    showLoading(true);
    document.getElementById("login-error").classList.add("hidden");
    
    try {
        const res = await fetch(`${SCRIPT_URL}?action=get_roster`);
        const roster = await res.json();
        
        const user = roster.find(emp => String(emp.Contact_Number || emp.Contact) === String(mobile));
        
        if (user) {
            currentUser = {
                id: user.Employee_ID || user.id,
                name: user.Employee_Name || user.name,
                role: user.Role || user.role,
                mobile: mobile
            };
            sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
            showDashboard();
        } else {
            document.getElementById("login-error").classList.remove("hidden");
        }
    } catch (e) {
        alert("Network error. Please try again.");
    }
    showLoading(false);
}

function logout() {
    sessionStorage.removeItem("currentUser");
    document.getElementById("dashboard-screen").classList.add("hidden");
    const adminScreen = document.getElementById("admin-dashboard-screen");
    if (adminScreen) adminScreen.classList.add("hidden");
    document.getElementById("login-screen").classList.remove("hidden");
}

async function showDashboard() {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("dashboard-screen").classList.remove("hidden");
    
    document.getElementById("welcome-text").innerText = `Welcome, ${currentUser.name}`;
    document.getElementById("role-text").innerText = currentUser.role;
    
    await fetchAttendance();
    renderCalendar();
}

async function fetchAttendance() {
    showLoading(true);
    try {
        const res = await fetch(`${SCRIPT_URL}?action=get_attendance`);
        const rawData = await res.json();
        
        // Filter only this user's attendance
        attendanceData = rawData.filter(row => String(row.Employee_ID) === String(currentUser.id));
    } catch (e) {
        alert("Failed to sync latest attendance.");
    }
    showLoading(false);
}

function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    
    // Set Header
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById("month-display").innerText = `${monthNames[m]} ${y}`;
    
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    
    const grid = document.getElementById("calendar-days");
    grid.innerHTML = "";
    
    // Blank days before start
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "cal-day empty";
        grid.appendChild(empty);
    }
    
    let daysPresent = 0;
    let shiftsWorked = 0;
    
    for (let i = 1; i <= daysInMonth; i++) {
        // Format date string as YYYY-MM-DD
        const dStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        // Find if user worked this day
        // Could be multiple shifts on the same day
        const dayRecords = attendanceData.filter(r => {
            let rd = r.Date;
            if(rd && rd.includes('T')) rd = rd.split('T')[0];
            return rd === dStr;
        });
        
        const dayEl = document.createElement("div");
        dayEl.className = "cal-day";
        
        let html = `<div class="date-num">${i}</div>`;
        
        if (dayRecords.length > 0) {
            dayRecords.forEach(rec => {
                if (rec.Status === 'Present') {
                    dayEl.classList.add("present");
                    html += `<div class="shift-tag">${rec.Shift}</div>`;
                    shiftsWorked++;
                }
            });
            
            // If they have any present record this day, count as 1 day present
            if (dayRecords.some(r => r.Status === 'Present')) {
                daysPresent++;
            }
        }
        
        dayEl.innerHTML = html;
        grid.appendChild(dayEl);
    }
    
    document.getElementById("sum-present").innerText = daysPresent;
    document.getElementById("sum-shifts").innerText = shiftsWorked;
}

let allAttendanceData = [];
let rosterData = [];
let adminCurrentMonth = new Date();

async function showAdminDashboard() {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("dashboard-screen").classList.add("hidden");
    document.getElementById("admin-dashboard-screen").classList.remove("hidden");
    
    showLoading(true);
    try {
        const resR = await fetch(`${SCRIPT_URL}?action=get_roster`);
        rosterData = await resR.json();
        
        const resA = await fetch(`${SCRIPT_URL}?action=get_attendance`);
        allAttendanceData = await resA.json();
        
        renderAdminToday();
        populateAdminEmployeeSelect();
    } catch (e) {
        alert("Failed to load admin data.");
    }
    showLoading(false);
}

function renderAdminToday() {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = allAttendanceData.filter(r => {
        let d = r.Date;
        if(d && d.includes('T')) d = d.split('T')[0];
        return d === today && r.Status === 'Present';
    });
    
    if(todayRecords.length === 0) {
        document.getElementById('admin-today-summary').innerHTML = '<p style="color:#aaa;">No attendance records for today.</p>';
        return;
    }
    
    let roleGroups = {};
    todayRecords.forEach(r => {
        const emp = rosterData.find(e => String(e.Employee_ID || e.id) === String(r.Employee_ID));
        const role = emp ? (emp.Role || emp.role) : 'Unknown';
        const name = emp ? (emp.Employee_Name || emp.name) : 'Emp ID ' + r.Employee_ID;
        
        if (!roleGroups[role]) roleGroups[role] = new Set();
        roleGroups[role].add(name);
    });
    
    let html = '';
    for (let role in roleGroups) {
        html += `<div style="margin-bottom: 10px; text-align:left;">
            <div style="font-weight:bold; color: var(--primary);">${role} (${roleGroups[role].size} Present)</div>
            <div style="font-size:14px; color:#555;">${Array.from(roleGroups[role]).join(', ')}</div>
        </div>`;
    }
    document.getElementById('admin-today-summary').innerHTML = html;
}

function populateAdminEmployeeSelect() {
    const select = document.getElementById('admin-emp-select');
    let html = '<option value="">Select Employee...</option>';
    rosterData.forEach(e => {
        const id = e.Employee_ID || e.id;
        const name = e.Employee_Name || e.name;
        html += `<option value="${id}">${name} (${id})</option>`;
    });
    select.innerHTML = html;
}

function changeAdminMonth(delta) {
    adminCurrentMonth.setMonth(adminCurrentMonth.getMonth() + delta);
    renderAdminCalendar();
}

function renderAdminCalendar() {
    const empId = document.getElementById('admin-emp-select').value;
    const wrapper = document.getElementById('admin-calendar-wrapper');
    
    if(!empId) {
        wrapper.classList.add('hidden');
        return;
    }
    wrapper.classList.remove('hidden');
    
    const y = adminCurrentMonth.getFullYear();
    const m = adminCurrentMonth.getMonth();
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById("admin-month-display").innerText = `${monthNames[m]} ${y}`;
    
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    
    const grid = document.getElementById("admin-calendar-days");
    grid.innerHTML = "";
    
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "cal-day empty";
        grid.appendChild(empty);
    }
    
    const empAttendance = allAttendanceData.filter(r => String(r.Employee_ID) === String(empId));
    
    for (let i = 1; i <= daysInMonth; i++) {
        const dStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        const dayRecords = empAttendance.filter(r => {
            let rd = r.Date;
            if(rd && rd.includes('T')) rd = rd.split('T')[0];
            return rd === dStr;
        });
        
        const dayEl = document.createElement("div");
        dayEl.className = "cal-day";
        
        let html = `<div class="date-num">${i}</div>`;
        
        if (dayRecords.length > 0) {
            dayRecords.forEach(rec => {
                if (rec.Status === 'Present') {
                    dayEl.classList.add("present");
                    html += `<div class="shift-tag">${rec.Shift}</div>`;
                }
            });
        }
        
        dayEl.innerHTML = html;
        grid.appendChild(dayEl);
    }
}
