const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_umeCVHwoIt7a3Qp6UkXxEXyidK9nO1oHIwTblN951XUIQbrbOEFv-smdiTZyP5o4/exec";

let currentUser = null;
let currentMonth = new Date();
let attendanceData = [];

document.addEventListener("DOMContentLoaded", () => {
    const userStr = sessionStorage.getItem("currentUser");
    if (userStr) {
        currentUser = JSON.parse(userStr);
        showDashboard();
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

