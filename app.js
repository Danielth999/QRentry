(() => {
  const STORAGE_KEY = "qrentry.mockup.v2";
  const seed = JSON.parse(document.getElementById("seed-data").textContent);
  const app = document.getElementById("app");
  const state = loadState();
  let activeView = "home";
  let toastTimer;

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return { ...seed, currentUserId: null };
      return { ...seed, ...JSON.parse(saved) };
    } catch (error) {
      console.error("Could not load QRentry data from LocalStorage.", error);
      return { ...seed, currentUserId: null, storageError: true };
    }
  }

  function persist() {
    const snapshot = { ...state };
    delete snapshot.storageError;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.error("Could not save QRentry data to LocalStorage.", error);
      toast("บันทึกข้อมูลไม่สำเร็จ พื้นที่ LocalStorage อาจเต็ม", true);
    }
  }

  const currentUser = () => state.users.find((user) => user.id === state.currentUserId) || null;
  const isManager = () => ["admin", "staff"].includes(currentUser()?.role);
  const fullName = (user) => `${user.firstName} ${user.lastName}`.trim();
  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const initials = (user) => `${user?.firstName?.[0] || "Q"}${user?.lastName?.[0] || "R"}`;
  const imageOrInitials = (user, large = false) => user?.avatar
    ? `<span class="avatar ${large ? "profile-avatar" : ""}"><img src="${user.avatar}" alt=""></span>`
    : `<span class="avatar ${large ? "profile-avatar" : ""}">${escapeHtml(initials(user))}</span>`;

  function toast(message, error = false) {
    document.querySelector(".toast")?.remove();
    const element = document.createElement("div");
    element.className = `toast${error ? " error" : ""}`;
    element.setAttribute("role", "status");
    element.textContent = message;
    document.body.append(element);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.remove(), 3400);
  }

  function logAction(action, detail = "") {
    const user = currentUser();
    state.auditLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      userId: user?.id || "guest",
      userName: user ? fullName(user) : "ผู้เยี่ยมชม",
      action,
      detail,
      timestamp: new Date().toISOString()
    });
    state.auditLogs = state.auditLogs.slice(0, 250);
    persist();
  }

  const roleTitle = (role) => ({ admin: "ผู้ดูแลระบบ", staff: "เจ้าหน้าที่กิจกรรม", student: "นักศึกษา" })[role] || "ผู้ใช้งาน";
  const formatDate = (date) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));
  };
  const formatDateTime = (date) => date ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)) : "-";
  const isPast = (event) => new Date(`${event.date}T${event.time || "23:59"}`) < new Date();
  const joined = (event, user = currentUser()) => Boolean(user?.activityIds?.includes(event.id));

  const roleViews = {
    admin: [
      ["overview", "▦", "ภาพรวม"],
      ["students", "♙", "จัดการนักศึกษา"],
      ["activities", "◷", "กิจกรรม"],
      ["news", "▤", "ข่าวสาร"],
      ["login-history", "◴", "ประวัติเข้าสู่ระบบ"],
      ["audit-logs", "≋", "ประวัติการใช้งาน"],
      ["settings", "⚙", "ตั้งค่าระบบ"]
    ],
    staff: [
      ["overview", "▦", "ภาพรวม"],
      ["activities", "◷", "จัดการกิจกรรม"],
      ["news", "▤", "จัดการข่าวสาร"],
      ["scanner", "▧", "สแกนเข้างาน"],
      ["audit-logs", "≋", "ประวัติการใช้งาน"]
    ],
    student: [
      ["home", "⌂", "หน้าหลัก"],
      ["all-activities", "◷", "กิจกรรมทั้งหมด"],
      ["my-activities", "♡", "กิจกรรมของฉัน"],
      ["news", "▤", "ข่าวสาร"],
      ["my-qr", "▦", "QR Code ของฉัน"],
      ["profile", "♙", "ข้อมูลส่วนตัว"]
    ]
  };

  function header(user) {
    return `<header class="topbar">
      <div style="display:flex;align-items:center">
        ${user ? '<button class="mobile-menu" data-action="toggle-menu" aria-label="เปิดเมนู">☰</button>' : ""}
        <button class="brand" data-view="${user ? (user.role === "student" ? "home" : "overview") : "home"}" aria-label="QRentry หน้าหลัก">
          <span class="brand-mark">QR</span><span class="brand-copy"><strong>QRentry</strong><small>กิจกรรมนักศึกษา · RMUTTO</small></span>
        </button>
      </div>
      <div class="top-actions">
        ${user ? `<span class="user-chip">${imageOrInitials(user)}<span>${escapeHtml(fullName(user))}<small style="display:block;color:#8a9690;font-size:10px;font-weight:400;margin-top:2px">${roleTitle(user.role)}</small></span></span>
          <button class="plain-button" data-action="logout">ออกจากระบบ</button>`
          : `<button class="nav-link" data-view="login">เข้าสู่ระบบ</button><button class="button small" data-view="register">ลงทะเบียนนักศึกษา</button>`}
      </div>
    </header>`;
  }

  function publicFooter() {
    return `<footer class="footer">มหาวิทยาลัยเทคโนโลยีราชมงคลตะวันออก · QRentry Student Activities</footer>`;
  }

  function eventCard(event, index = 0, mode = "public") {
    const user = currentUser();
    const isJoined = joined(event);
    const full = Boolean(event.capacity && event.attendees >= event.capacity);
    const action = !user ? `<button class="button small secondary" data-view="login">เข้าสู่ระบบเพื่อเข้าร่วม</button>`
      : user.role === "student" ? `<button class="button small ${isJoined ? "secondary" : ""}" data-action="join-event" data-id="${event.id}" ${isJoined || isPast(event) || full ? "disabled" : ""}>${isJoined ? "ลงทะเบียนแล้ว" : isPast(event) ? "ปิดรับสมัคร" : full ? "เต็มแล้ว" : "เข้าร่วมกิจกรรม"}</button>`
      : "";
    const imageStyle = event.image ? ` style="background-image:linear-gradient(#17392b22,#17392b22),url('${escapeHtml(event.image)}')"` : "";
    return `<article class="event-card">
      <div class="event-cover cover-${(index % 4) + 1}${event.image ? " has-image" : ""}"${imageStyle}><span class="cover-label">${escapeHtml(event.location || "กิจกรรมนักศึกษา")}</span></div>
      <div class="event-body">
        <div class="event-meta">${formatDate(event.date)}${event.time ? ` · ${escapeHtml(event.time)} น.` : ""}</div>
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.description)}</p>
        <div class="event-foot"><span>ผู้เข้าร่วม ${event.attendees || 0}/${event.capacity || "ไม่จำกัด"}</span>${action || `<span class="status-pill">${escapeHtml(event.status || "กำลังจะมาถึง")}</span>`}</div>
      </div>
    </article>`;
  }

  function newsCard(item) {
    return `<article class="news-card"><span class="news-tag">${escapeHtml(item.category || "ข่าวสาร")}</span><time>${formatDate(item.date)}</time><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`;
  }

  function guestHome() {
    return `<main class="landing page-width">
      <section class="hero">
        <div class="hero-copy"><span class="eyebrow">Campus life, all in one place</span><h1>ทุกกิจกรรมในรั้วมหาวิทยาลัย<br>เริ่มต้นที่นี่</h1>
          <p>ค้นหากิจกรรมที่ใช่ ติดตามข่าวสาร และเก็บทุกการเข้าร่วมไว้ใน QR Code ส่วนตัวของคุณ</p>
          <div class="hero-actions"><button class="button" data-view="register">เริ่มต้นลงทะเบียน <span aria-hidden="true">→</span></button><button class="button ghost" data-view="login">เข้าสู่ระบบ</button></div>
        </div>
        <div class="hero-graphic" aria-hidden="true"><div class="hero-orbit"><div class="hero-phone"><div class="hero-phone-logo"></div><div class="hero-phone-qr">${Array.from({ length: 49 }, () => "<i></i>").join("")}</div><div class="hero-phone-bar"></div></div></div></div>
      </section>
      <section class="section"><div class="section-heading"><div><h2>กิจกรรมที่กำลังจะมาถึง</h2><p>วางแผนล่วงหน้า แล้วมาใช้เวลาดี ๆ ไปด้วยกัน</p></div><button class="text-button" data-view="login">ดูทั้งหมด →</button></div>
        <div class="event-grid">${state.activities.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3).map(eventCard).join("")}</div>
      </section>
      <section class="section"><div class="section-heading"><div><h2>ข่าวสารล่าสุด</h2><p>อัปเดตเรื่องสำคัญจากมหาวิทยาลัย</p></div></div><div class="news-list">${state.news.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(newsCard).join("")}</div></section>
      ${publicFooter()}
    </main>`;
  }

  function loginPage() {
    return `<main class="auth-wrap"><section class="auth-card">
      <span class="brand-mark" style="margin-bottom:18px">QR</span><h1>ยินดีต้อนรับกลับมา</h1><p class="auth-subtitle">เข้าสู่ระบบเพื่อจัดการกิจกรรมและข่าวสารของคุณ</p>
      <form class="auth-form" id="login-form">
        <div class="field"><label for="login-email">อีเมลมหาวิทยาลัย</label><input id="login-email" name="email" type="email" placeholder="name@rmutto.ac.th" required autocomplete="username"></div>
        <div class="field"><label for="login-password">รหัสผ่าน</label><input id="login-password" name="password" type="password" placeholder="กรอกรหัสผ่าน" required autocomplete="current-password"></div>
        <button class="button full" type="submit">เข้าสู่ระบบ</button>
      </form>
      <p class="auth-footer">ยังไม่มีบัญชี? <button data-view="register">ลงทะเบียนนักศึกษา</button></p>
      <div class="demo-box"><strong>บัญชีทดลองสำหรับต้นแบบ</strong><br>Admin: admin@rmutto.ac.th / admin<br>เจ้าหน้าที่: staff@rmutto.ac.th / staff<br>นักศึกษา: student@rmutto.ac.th / student123</div>
    </section></main>`;
  }

  function registerPage() {
    const facultyOptions = state.faculties.map((item) => `<option>${escapeHtml(item)}</option>`).join("");
    const departmentOptions = state.departments.map((item) => `<option>${escapeHtml(item)}</option>`).join("");
    return `<main class="auth-wrap"><section class="auth-card register-card">
      <h1>ลงทะเบียนนักศึกษา</h1><p class="auth-subtitle">กรอกข้อมูลมหาวิทยาลัยเพื่อสร้างบัญชีและ QR Code ส่วนบุคคล</p>
      <div class="register-layout">
        <label class="upload-box" for="register-avatar"><span class="upload-glyph">＋</span><strong>เพิ่มรูปโปรไฟล์</strong><small>ไม่บังคับ</small><input type="file" id="register-avatar" accept="image/*"></label>
        <form class="form-grid register-grid" id="register-form">
          <div class="field"><label>อีเมลมหาวิทยาลัย <span class="required">*</span></label><input name="email" type="email" placeholder="name@rmutto.ac.th" required></div>
          <div class="field"><label>รหัสนักศึกษา <span class="required">*</span></label><input name="studentId" placeholder="เช่น 66520001" required></div>
          <div class="field full"><label>ชื่อ - นามสกุล <span class="required">*</span></label><input name="name" placeholder="ชื่อจริง และนามสกุล" required></div>
          <div class="field"><label>คณะ <span class="required">*</span></label><select name="faculty" required><option value="">เลือกคณะ</option>${facultyOptions}</select></div>
          <div class="field"><label>สาขา / วิชา <span class="required">*</span></label><select name="department" required><option value="">เลือกสาขา/วิชา</option>${departmentOptions}</select></div>
          <div class="field"><label>ชั้นปี <span class="required">*</span></label><select name="year" required><option value="">เลือกชั้นปี</option>${[1,2,3,4,5,6].map((year) => `<option value="${year}">ชั้นปีที่ ${year}</option>`).join("")}</select></div>
          <div class="field"><label>กำหนดรหัสผ่าน <span class="required">*</span></label><input name="password" type="password" minlength="6" placeholder="อย่างน้อย 6 ตัวอักษร" required></div>
          <div class="field full"><button class="button full" type="submit">ยืนยันลงทะเบียน / สร้าง QR Code</button></div>
        </form>
      </div>
      <p class="auth-footer">มีบัญชีอยู่แล้ว? <button data-view="login">เข้าสู่ระบบ</button></p>
    </section></main>`;
  }

  function sidebarItems(user, active) {
    return (roleViews[user.role] || roleViews.student).map(([view, icon, label]) => `<button class="side-link ${active === view ? "active" : ""}" data-view="${view}"><span class="side-icon">${icon}</span>${label}</button>`).join("");
  }

  function dashboardFrame(user, content, title = "", subtitle = "") {
    const views = roleViews[user.role] || roleViews.student;
    if (!views.some(([key]) => key === activeView)) activeView = views[0][0];
    return `${header(user)}<div class="workspace"><aside class="sidebar" id="sidebar"><div class="side-label">${roleTitle(user.role).toUpperCase()}</div>${sidebarItems(user, activeView)}<div class="side-spacer"></div><div class="sidebar-note">ข้อมูลตัวอย่างและการเปลี่ยนแปลงทั้งหมดจัดเก็บไว้ใน LocalStorage บนอุปกรณ์นี้</div></aside><button class="mobile-overlay" id="mobile-overlay" aria-label="ปิดเมนู"></button><main class="workspace-main">${title ? `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${pageActions(user)}</div>` : ""}${content}</main></div>`;
  }

  function pageActions(user) {
    if (user.role === "admin" && activeView === "students") return `<button class="button" data-action="new-student">＋ เพิ่มนักศึกษา</button>`;
    if (isManager() && activeView === "activities") return `<button class="button" data-action="new-activity">＋ สร้างกิจกรรม</button>`;
    if (isManager() && activeView === "news") return `<button class="button" data-action="new-news">＋ สร้างข่าวสาร</button>`;
    return "";
  }

  function kpi(label, value, icon, foot = "") {
    return `<article class="kpi"><div class="kpi-top"><span>${label}</span><span class="kpi-icon">${icon}</span></div><div class="kpi-value">${value}</div><div class="kpi-foot">${foot}</div></article>`;
  }

  function overviewView(user) {
    const students = state.users.filter((item) => item.role === "student").length;
    const upcoming = state.activities.filter((item) => !isPast(item)).length;
    const cards = user.role === "student"
      ? `<div class="kpi-grid">${kpi("กิจกรรมที่ลงทะเบียน", user.activityIds?.length || 0, "♡", "กิจกรรมทั้งหมดของคุณ")}${kpi("กิจกรรมที่กำลังจะมาถึง", upcoming, "◷", "เลือกกิจกรรมใหม่ได้เลย")}${kpi("ข่าวสารล่าสุด", state.news.length, "▤", "ติดตามข่าวจากมหาวิทยาลัย")}${kpi("ชั้นปี", user.year || "-", "♙", escapeHtml(user.faculty))}</div>`
      : `<div class="kpi-grid">${kpi("นักศึกษาทั้งหมด", students, "♙", "บัญชีนักศึกษาที่ลงทะเบียน")}${kpi("กิจกรรมที่เปิดอยู่", upcoming, "◷", "กิจกรรมที่กำลังเปิดรับ")}${kpi("ข่าวสารทั้งหมด", state.news.length, "▤", "ประกาศและข่าวประชาสัมพันธ์")}${kpi("การลงทะเบียนกิจกรรม", state.activities.reduce((sum, item) => sum + (item.attendees || 0), 0), "✓", "ยอดผู้ลงทะเบียนรวม")}</div>`;
    return `<div class="kpi-grid">${cards}</div>
      <section class="panel"><div class="panel-head"><div><h2>${user.role === "student" ? "กิจกรรมแนะนำ" : "กิจกรรมที่กำลังจะมาถึง"}</h2><p>อัปเดตล่าสุดจากระบบ QRentry</p></div><button class="text-button" data-view="${user.role === "student" ? "all-activities" : "activities"}">ดูทั้งหมด →</button></div><div class="activity-layout">${state.activities.filter((item) => !isPast(item)).slice(0,3).map(eventCard).join("") || '<div class="empty-state">ยังไม่มีกิจกรรมที่กำลังจะมาถึง</div>'}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>ข่าวสารล่าสุด</h2><p>ประกาศจากมหาวิทยาลัย</p></div><button class="text-button" data-view="news">ดูข่าวสาร →</button></div>${state.news.slice(0,3).map((item) => `<div class="news-row"><div class="news-date">${formatDate(item.date)}</div><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div>${user.role === "student" ? "" : `<span class="news-tag">${escapeHtml(item.category)}</span>`}</div>`).join("")}</section>`;
  }

  function studentsView() {
    const students = state.users.filter((user) => user.role === "student");
    return `<section class="panel"><div class="toolbar"><label class="search-box"><span>⌕</span><input id="student-search" placeholder="ค้นหาชื่อ หรือรหัสนักศึกษา"></label><select class="filter-select" id="student-faculty"><option value="">ทุกคณะ</option>${state.faculties.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select><select class="filter-select" id="student-year"><option value="">ทุกชั้นปี</option>${[1,2,3,4,5,6].map((year) => `<option value="${year}">ชั้นปี ${year}</option>`).join("")}</select></div>
      <div class="table-wrap"><table><thead><tr><th>นักศึกษา</th><th>รหัสนักศึกษา</th><th>คณะ / สาขา</th><th>ชั้นปี</th><th>กิจกรรม</th><th>จัดการ</th></tr></thead><tbody id="student-rows">${studentRows(students)}</tbody></table></div></section>`;
  }

  function studentRows(students) {
    if (!students.length) return `<tr><td colspan="6"><div class="empty-state"><strong>ไม่พบนักศึกษา</strong>ลองค้นหาด้วยคำอื่น หรือเพิ่มนักศึกษาใหม่</div></td></tr>`;
    return students.map((user) => `<tr data-student-row data-search="${escapeHtml(`${fullName(user)} ${user.studentId} ${user.email}`.toLowerCase())}" data-faculty="${escapeHtml(user.faculty)}" data-year="${user.year}">
      <td><div class="person-cell">${imageOrInitials(user)}<span>${escapeHtml(fullName(user))}<small>${escapeHtml(user.email)}</small></span></div></td>
      <td>${escapeHtml(user.studentId)}</td><td>${escapeHtml(user.faculty)}<small style="display:block;color:#929d97;margin-top:3px">${escapeHtml(user.department)}</small></td>
      <td>ปี ${escapeHtml(user.year)}</td><td>${user.activityIds?.length || 0} กิจกรรม</td>
      <td><div class="table-actions"><button class="icon-button" title="แก้ไข" data-action="edit-student" data-id="${user.id}">✎</button><button class="icon-button delete" title="ลบ" data-action="delete-student" data-id="${user.id}">×</button></div></td></tr>`).join("");
  }

  function activitiesView(user, view = "activities") {
    let activities = state.activities.slice().sort((a, b) => a.date.localeCompare(b.date));
    if (view === "my-activities") activities = activities.filter((event) => joined(event, user));
    if (view === "all-activities") activities = activities.filter((event) => !isPast(event));
    const manager = ["admin", "staff"].includes(user.role);
    return `<section class="panel"><div class="toolbar"><label class="search-box"><span>⌕</span><input id="activity-search" placeholder="ค้นหาชื่อกิจกรรม หรือสถานที่"></label><select class="filter-select" id="activity-filter"><option value="">ทุกกิจกรรม</option><option value="upcoming">กำลังจะมาถึง</option><option value="registered">ลงทะเบียนแล้ว</option></select></div>
      ${manager ? `<div class="table-wrap"><table><thead><tr><th>ชื่อกิจกรรม</th><th>วัน / เวลา</th><th>สถานที่</th><th>ผู้เข้าร่วม</th><th>จำนวนครั้ง</th><th>จัดการ</th></tr></thead><tbody id="activity-rows">${activityRows(activities)}</tbody></table></div>` :
      `<div class="activity-layout" id="activity-cards">${activities.map(eventCard).join("") || '<div class="empty-state"><strong>ยังไม่มีกิจกรรม</strong>กิจกรรมที่คุณลงทะเบียนจะแสดงที่นี่</div>'}</div>`}</section>`;
  }

  function activityRows(activities) {
    if (!activities.length) return `<tr><td colspan="6"><div class="empty-state">ยังไม่มีกิจกรรม</div></td></tr>`;
    return activities.map((event) => `<tr data-activity-row data-search="${escapeHtml(`${event.title} ${event.location}`.toLowerCase())}"><td><strong style="color:#293a32">${escapeHtml(event.title)}</strong><small style="display:block;color:#919c96;margin-top:4px">${escapeHtml(event.status || "")}</small></td><td>${formatDate(event.date)}<small style="display:block;color:#919c96;margin-top:4px">${escapeHtml(event.time)} น.</small></td><td>${escapeHtml(event.location || "-")}</td><td>${event.attendees || 0}/${event.capacity || "-"}</td><td>${event.requiredCount || 1} ครั้ง</td><td><div class="table-actions"><button class="icon-button" title="แก้ไข" data-action="edit-activity" data-id="${event.id}">✎</button><button class="icon-button delete" title="ลบ" data-action="delete-activity" data-id="${event.id}">×</button></div></td></tr>`).join("");
  }

  function newsView(user) {
    const manager = ["admin", "staff"].includes(user.role);
    return `<section class="panel">${manager ? "" : `<div class="panel-head"><div><h2>ข่าวสารและประกาศ</h2><p>ติดตามข้อมูลสำคัญจากมหาวิทยาลัย</p></div></div>`}
      ${state.news.slice().sort((a, b) => b.date.localeCompare(a.date)).map((item) => `<div class="news-row">${item.image ? `<img class="news-thumb" src="${escapeHtml(item.image)}" alt="">` : `<div class="news-date">${formatDate(item.date)}</div>`}<div><span class="news-tag">${escapeHtml(item.category || "ข่าวสาร")}</span><h3 style="margin-top:8px">${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div>${manager ? `<div class="table-actions"><button class="icon-button" data-action="edit-news" data-id="${item.id}" title="แก้ไข">✎</button><button class="icon-button delete" data-action="delete-news" data-id="${item.id}" title="ลบ">×</button></div>` : ""}</div>`).join("") || '<div class="empty-state">ยังไม่มีข่าวสาร</div>'}
    </section>`;
  }

  function profileView(user) {
    return `<section class="panel"><div class="profile-top">${imageOrInitials(user, true)}<div><h2>${escapeHtml(fullName(user))}</h2><p>${roleTitle(user.role)} · ${escapeHtml(user.studentId || "-")}</p></div></div>
      <div class="student-details"><div class="detail-item"><span>อีเมลมหาวิทยาลัย</span><strong>${escapeHtml(user.email)}</strong></div><div class="detail-item"><span>รหัสนักศึกษา</span><strong>${escapeHtml(user.studentId || "-")}</strong></div><div class="detail-item"><span>คณะ</span><strong>${escapeHtml(user.faculty || "-")}</strong></div><div class="detail-item"><span>สาขา / วิชา</span><strong>${escapeHtml(user.department || "-")}</strong></div><div class="detail-item"><span>ชั้นปี</span><strong>${user.year ? `ชั้นปีที่ ${escapeHtml(user.year)}` : "-"}</strong></div><div class="detail-item"><span>กิจกรรมที่ลงทะเบียน</span><strong>${user.activityIds?.length || 0} กิจกรรม</strong></div></div>
      <form id="profile-form" class="inline-form" style="margin-top:20px;max-width:none;align-items:center"><label class="button secondary small" for="profile-avatar">เปลี่ยนรูปโปรไฟล์</label><input id="profile-avatar" type="file" accept="image/*" style="display:none"><span class="field-hint">รูปภาพจะถูกเก็บไว้ใน LocalStorage ของอุปกรณ์นี้</span></form>
    </section>`;
  }

  function qrView(user) {
    const token = `QRE-${user.studentId}`;
    return `<section class="panel"><div class="qr-layout"><div class="qr-card"><div class="qr-frame">${qrSvg(token)}</div><strong>${escapeHtml(fullName(user))}</strong><p>รหัสนักศึกษา ${escapeHtml(user.studentId)}</p></div>
      <div class="qr-info"><span class="news-tag">PERSONAL QR CODE</span><h2>QR Code สำหรับยืนยันเข้าร่วมกิจกรรม</h2><p>แสดง QR Code นี้ให้เจ้าหน้าที่สแกนที่จุดลงทะเบียน เมื่อสแกนสำเร็จ ระบบจะบันทึกเวลาเข้าร่วมกิจกรรมไว้ในประวัติของคุณ</p><div class="detail-item"><span>รหัสยืนยันของคุณ</span><strong>${escapeHtml(token)}</strong></div><div class="notice-box">ต้นแบบนี้จำลองการแสดง QR และบันทึกผลการเช็กชื่อในเครื่อง การสแกนจริงสามารถเชื่อมต่อกับกล้องได้เมื่อพัฒนาระบบต่อ</div></div>
    </div></section>`;
  }

  function qrSvg(value) {
    const size = 29;
    let hash = 2166136261;
    for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    const reserved = Array.from({ length: size }, () => Array(size).fill(false));
    const cells = [];
    function finder(x, y) {
      for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
        const px = x + dx, py = y + dy;
        if (px < 0 || py < 0 || px >= size || py >= size) continue;
        reserved[py][px] = true;
        if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
          const edge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
          const center = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
          if (edge || center) cells.push(`<rect x="${px}" y="${py}" width="1" height="1"/>`);
        }
      }
    }
    finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (reserved[y][x]) continue;
      hash = (Math.imul(hash ^ (x * 31 + y * 17), 16777619) + 1013904223) >>> 0;
      if ((hash >>> 28) % 2 === 0) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="QR Code ส่วนบุคคล"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#183c31">${cells.join("")}</g></svg>`;
  }

  function scannerView() {
    return `<section class="panel"><div class="panel-head"><div><h2>สแกน QR Code เพื่อเช็กชื่อ</h2><p>กรอกรหัสนักศึกษาหรือรหัส QR ของสมาชิก เพื่อจำลองการลงทะเบียนเข้างาน</p></div></div>
      <form id="checkin-form" class="toolbar"><label class="search-box"><span>▧</span><input name="code" placeholder="เช่น 66520001 หรือ QRE-66520001" required></label><select name="activityId" class="filter-select" required><option value="">เลือกกิจกรรม</option>${state.activities.filter((event) => !isPast(event)).map((event) => `<option value="${event.id}">${escapeHtml(event.title)}</option>`).join("")}</select><button class="button" type="submit">ยืนยันการเข้าร่วม</button></form>
      <div class="notice-box">โหมดต้นแบบ: ใช้รหัสนักศึกษาจากข้อมูลตัวอย่างด้านล่างเพื่อจำลองการสแกน QR</div>
      <div class="panel-head" style="margin-top:24px"><div><h3>รายการเช็กชื่อวันนี้</h3></div></div>${checkinTable(state.checkins.slice(0, 8))}</section>`;
  }

  function checkinTable(checkins) {
    if (!checkins.length) return `<div class="empty-state"><strong>ยังไม่มีรายการเช็กชื่อ</strong>รายการที่บันทึกสำเร็จจะแสดงที่นี่</div>`;
    return `<div class="table-wrap"><table><thead><tr><th>นักศึกษา</th><th>กิจกรรม</th><th>เวลาเช็กชื่อ</th><th>สถานะ</th></tr></thead><tbody>${checkins.map((record) => {
      const user = state.users.find((item) => item.id === record.userId);
      const activity = state.activities.find((item) => item.id === record.activityId);
      return `<tr><td>${escapeHtml(user ? fullName(user) : "-")}<small style="display:block;color:#919c96;margin-top:4px">${escapeHtml(user?.studentId || "")}</small></td><td>${escapeHtml(activity?.title || "กิจกรรมที่ถูกลบ")}</td><td>${formatDateTime(record.timestamp)}</td><td><span class="status-pill">เข้าร่วมแล้ว</span></td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function logsView(kind) {
    const login = kind === "login-history";
    const rows = login ? state.loginHistory : state.auditLogs;
    return `<section class="panel"><div class="toolbar"><label class="search-box"><span>⌕</span><input id="log-search" placeholder="ค้นหาชื่อ หรือรหัสนักศึกษา"></label></div>
      <div class="table-wrap"><table><thead><tr>${login ? "<th>วัน / เวลา</th><th>ผู้ใช้งาน</th><th>รหัสนักศึกษา</th><th>อีเมล</th><th>สถานะ</th>" : "<th>วัน / เวลา</th><th>ผู้ใช้งาน</th><th>รายการ</th><th>รายละเอียด</th>"}</tr></thead><tbody>${rows.length ? rows.map((row) => {
      const user = state.users.find((item) => item.id === row.userId);
      return `<tr data-log-row data-search="${escapeHtml(`${row.userName} ${user?.studentId || ""} ${user?.email || ""} ${row.action || ""}`.toLowerCase())}"><td>${formatDateTime(row.timestamp)}</td><td>${escapeHtml(row.userName || fullName(user || {}))}</td>${login ? `<td>${escapeHtml(user?.studentId || "-")}</td><td>${escapeHtml(user?.email || "-")}</td><td><span class="status-pill">${escapeHtml(row.status || "สำเร็จ")}</span></td>` : `<td>${escapeHtml(row.action)}</td><td>${escapeHtml(row.detail || "-")}</td>`}</tr>`;
    }).join("") : `<tr><td colspan="5"><div class="empty-state"><strong>ยังไม่มีประวัติ</strong>เมื่อมีการใช้งานระบบ รายการจะถูกบันทึกไว้ที่นี่</div></td></tr>`}</tbody></table></div></section>`;
  }

  function settingsView() {
    return `<section class="panel"><div class="panel-head"><div><h2>จัดการคณะ</h2><p>ตัวเลือกคณะที่ใช้ในแบบฟอร์มลงทะเบียนและข้อมูลนักศึกษา</p></div></div><div class="settings-list">${state.faculties.map((item, index) => `<span class="setting-chip">${escapeHtml(item)}<button data-action="remove-setting" data-kind="faculties" data-index="${index}" aria-label="ลบคณะ">×</button></span>`).join("")}</div><form class="inline-form" id="faculty-form"><input name="value" placeholder="เพิ่มชื่อคณะ" required><button class="button small" type="submit">เพิ่มคณะ</button></form></section>
      <section class="panel"><div class="panel-head"><div><h2>จัดการสาขา / วิชา</h2><p>ตัวเลือกสาขาที่ใช้ในแบบฟอร์มลงทะเบียนและข้อมูลนักศึกษา</p></div></div><div class="settings-list">${state.departments.map((item, index) => `<span class="setting-chip">${escapeHtml(item)}<button data-action="remove-setting" data-kind="departments" data-index="${index}" aria-label="ลบสาขา">×</button></span>`).join("")}</div><form class="inline-form" id="department-form"><input name="value" placeholder="เพิ่มชื่อสาขา / วิชา" required><button class="button small" type="submit">เพิ่มสาขา</button></form></section>
      <section class="panel"><div class="panel-head"><div><h2>ข้อมูลต้นแบบ</h2><p>ข้อมูลทั้งหมดเก็บใน LocalStorage เท่านั้น ไม่มีการเชื่อมต่อฐานข้อมูล</p></div></div><button class="button danger small" data-action="reset-data">คืนค่าข้อมูลตัวอย่าง</button></section>`;
  }

  function pageData(user) {
    const data = {
      overview: ["ภาพรวม", `สวัสดี ${fullName(user)} ยินดีต้อนรับสู่ QRentry`, overviewView(user)],
      students: ["ข้อมูลนักศึกษา", "ค้นหา เพิ่ม และแก้ไขข้อมูลนักศึกษา", studentsView()],
      activities: ["จัดการกิจกรรม", "สร้างกิจกรรม กำหนดวัน เวลา และจำนวนผู้เข้าร่วม", activitiesView(user)],
      "all-activities": ["กิจกรรมทั้งหมด", "เลือกกิจกรรมที่สนใจและลงทะเบียนได้ในที่เดียว", activitiesView(user, "all-activities")],
      "my-activities": ["กิจกรรมของฉัน", "ติดตามกิจกรรมที่คุณลงทะเบียนไว้", activitiesView(user, "my-activities")],
      news: ["ข่าวสารและประกาศ", "ติดตามข่าวประชาสัมพันธ์จากมหาวิทยาลัย", newsView(user)],
      profile: ["ข้อมูลส่วนตัว", "ตรวจสอบข้อมูลบัญชีและเปลี่ยนรูปโปรไฟล์", profileView(user)],
      "my-qr": ["QR Code ของฉัน", "แสดง QR Code เพื่อยืนยันการเข้าร่วมกิจกรรม", qrView(user)],
      scanner: ["ลงทะเบียนเข้างาน", "ยืนยันการเข้าร่วมกิจกรรมด้วย QR Code ส่วนบุคคล", scannerView()],
      "login-history": ["ประวัติเข้าสู่ระบบ", "ตรวจสอบประวัติการเข้าสู่ระบบของผู้ใช้งาน", logsView("login-history")],
      "audit-logs": ["ประวัติการใช้งานระบบ", "รายการกิจกรรมที่ผู้ใช้งานทำภายในระบบ", logsView("audit-logs")],
      settings: ["ตั้งค่าระบบ", "จัดการคณะและสาขาที่ใช้ในระบบลงทะเบียน", settingsView()],
      home: ["หน้าหลัก", "กิจกรรมและข่าวสารล่าสุดจากมหาวิทยาลัย", overviewView(user)]
    };
    return data[activeView] || data.overview;
  }

  function render() {
    const user = currentUser();
    if (!user && !["login", "register"].includes(activeView)) {
      activeView = "home";
      app.innerHTML = `${header(null)}${guestHome()}`;
    } else if (activeView === "login" && !user) {
      app.innerHTML = `${header(null)}${loginPage()}${publicFooter()}`;
    } else if (activeView === "register" && !user) {
      app.innerHTML = `${header(null)}${registerPage()}${publicFooter()}`;
    } else if (user) {
      if (activeView === "home" && user.role !== "student") activeView = "overview";
      if (user.role === "student" && ["students", "scanner", "login-history", "audit-logs", "settings"].includes(activeView)) activeView = "home";
      if (user.role === "staff" && ["students", "login-history", "settings"].includes(activeView)) activeView = "overview";
      const [title, subtitle, content] = pageData(user);
      app.innerHTML = dashboardFrame(user, content, title, subtitle);
    }
    if (state.storageError) {
      state.storageError = false;
      toast("อ่านข้อมูลเดิมไม่สำเร็จ เริ่มต้นด้วยข้อมูลตัวอย่างแทน", true);
    }
  }

  function navigate(view) {
    activeView = view;
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("mobile-overlay")?.classList.remove("show");
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openModal(title, subtitle, body, formId, submitLabel = "บันทึกข้อมูล") {
    document.querySelector(".modal-backdrop")?.remove();
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="close-button" data-action="close-modal" aria-label="ปิด">×</button></div><form id="${formId}">${body}<div class="modal-footer"><button type="button" class="button ghost" data-action="close-modal">ยกเลิก</button><button type="submit" class="button">${submitLabel}</button></div></form></section>`;
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) backdrop.remove(); });
    document.body.append(backdrop);
    backdrop.querySelector("input, select, textarea")?.focus();
  }

  function openActivityForm(event) {
    const data = event || {};
    const input = (name, label, value = "", type = "text", required = true) => `<div class="field"><label>${label}${required ? ' <span class="required">*</span>' : ""}</label><input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""}></div>`;
    const body = `<input type="hidden" name="id" value="${escapeHtml(data.id || "")}"><div class="form-grid">
      <div class="field full"><label>ชื่อกิจกรรม <span class="required">*</span></label><input name="title" value="${escapeHtml(data.title || "")}" required></div>
      ${input("date", "วันที่จัดกิจกรรม", data.date || "", "date")}${input("time", "เวลา", data.time || "", "time")}
      ${input("requiredCount", "จำนวนครั้งที่ต้องเข้าร่วม", data.requiredCount ?? 1, "number")}${input("capacity", "จำนวนรับคน", data.capacity ?? "", "number", false)}
      ${input("location", "สถานที่", data.location || "")}
      <div class="field"><label>รูปภาพกิจกรรม</label><input name="image" type="file" accept="image/*"><span class="field-hint">${data.image ? "มีรูปภาพเดิมแล้ว เลือกไฟล์ใหม่เพื่อเปลี่ยน" : "เลือกไฟล์ภาพ (ไม่บังคับ)"}</span></div>
      <div class="field full"><label>รายละเอียดกิจกรรม <span class="required">*</span></label><textarea name="description" required>${escapeHtml(data.description || "")}</textarea></div>
      <div class="field full"><label>รายละเอียดส่งแจ้งเตือน</label><textarea name="reminder" placeholder="ข้อมูลที่ผู้เข้าร่วมควรทราบ">${escapeHtml(data.reminder || "")}</textarea></div>
    </div>`;
    openModal(data.id ? "แก้ไขกิจกรรม" : "สร้างกิจกรรม", "กำหนดรายละเอียดและข้อมูลการลงทะเบียน", body, "activity-form", data.id ? "บันทึกการแก้ไข" : "ยืนยันสร้างกิจกรรม");
  }

  function openNewsForm(item) {
    const data = item || {};
    const body = `<input type="hidden" name="id" value="${escapeHtml(data.id || "")}"><div class="form-grid">
      <div class="field full"><label>หัวข้อข่าวสาร <span class="required">*</span></label><input name="title" value="${escapeHtml(data.title || "")}" required></div>
      <div class="field"><label>วันที่ประกาศ <span class="required">*</span></label><input name="date" type="date" value="${escapeHtml(data.date || new Date().toISOString().slice(0,10))}" required></div>
      <div class="field"><label>หมวดหมู่</label><select name="category">${["ข่าวสาร","ประกาศ","กิจกรรม"].map((item) => `<option ${data.category === item ? "selected" : ""}>${item}</option>`).join("")}</select></div>
      <div class="field full"><label>รายละเอียดข่าวสาร <span class="required">*</span></label><textarea name="body" required>${escapeHtml(data.body || "")}</textarea></div>
      <div class="field full"><label>รูปภาพข่าวสาร</label><input name="image" type="file" accept="image/*"><span class="field-hint">${data.image ? "มีรูปภาพเดิมแล้ว เลือกไฟล์ใหม่เพื่อเปลี่ยน" : "เลือกไฟล์ภาพ (ไม่บังคับ)"}</span></div>
    </div>`;
    openModal(data.id ? "แก้ไขข่าวสาร" : "สร้างข่าวสาร", "เผยแพร่ประกาศและข่าวประชาสัมพันธ์", body, "news-form", data.id ? "บันทึกการแก้ไข" : "เผยแพร่ข่าวสาร");
  }

  function openStudentForm(user) {
    const data = user || {};
    const options = (values, selected, empty) => `<option value="">${empty}</option>${values.map((value) => `<option ${selected === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}`;
    const body = `<input type="hidden" name="id" value="${escapeHtml(data.id || "")}"><div class="form-grid">
      <div class="field"><label>อีเมลมหาวิทยาลัย <span class="required">*</span></label><input name="email" type="email" value="${escapeHtml(data.email || "")}" required></div>
      <div class="field"><label>รหัสนักศึกษา <span class="required">*</span></label><input name="studentId" value="${escapeHtml(data.studentId || "")}" required></div>
      <div class="field full"><label>ชื่อ - นามสกุล <span class="required">*</span></label><input name="name" value="${escapeHtml(data.id ? fullName(data) : "")}" required></div>
      <div class="field"><label>คณะ <span class="required">*</span></label><select name="faculty" required>${options(state.faculties, data.faculty, "เลือกคณะ")}</select></div>
      <div class="field"><label>สาขา / วิชา <span class="required">*</span></label><select name="department" required>${options(state.departments, data.department, "เลือกสาขา / วิชา")}</select></div>
      <div class="field"><label>ชั้นปี <span class="required">*</span></label><select name="year" required>${options([1,2,3,4,5,6].map(String), String(data.year || ""), "เลือกชั้นปี")}</select></div>
      <div class="field"><label>รหัสผ่าน ${data.id ? "(เว้นว่างหากไม่เปลี่ยน)" : '<span class="required">*</span>'}</label><input name="password" type="password" minlength="6" ${data.id ? "" : "required"}></div>
      <div class="field full"><label>รูปโปรไฟล์</label><input name="avatar" type="file" accept="image/*"><span class="field-hint">${data.avatar ? "มีรูปโปรไฟล์เดิมแล้ว เลือกไฟล์ใหม่เพื่อเปลี่ยน" : "เลือกไฟล์ภาพ (ไม่บังคับ)"}</span></div>
    </div>`;
    openModal(data.id ? "แก้ไขข้อมูลนักศึกษา" : "เพิ่มนักศึกษา", "ข้อมูลนักศึกษาจะถูกบันทึกไว้ใน LocalStorage", body, "student-form");
  }

  async function readImage(file) {
    if (!file) return "";
    if (!file.type.startsWith("image/")) throw new Error("กรุณาเลือกไฟล์รูปภาพ");
    if (file.size > 900 * 1024) throw new Error("รูปภาพต้องมีขนาดไม่เกิน 900 KB เพื่อไม่ให้ LocalStorage เต็ม");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("อ่านไฟล์รูปภาพไม่สำเร็จ"));
      reader.readAsDataURL(file);
    });
  }

  function validCampusEmail(email) {
    return /^[^\s@]+@rmutto(?:\.ac\.th)?$/i.test(email.trim());
  }

  function hasDuplicateStudent(email, studentId, excludingId = "") {
    return state.users.some((user) => user.role === "student" && user.id !== excludingId &&
      (user.email.toLowerCase() === email.toLowerCase() || user.studentId.toLowerCase() === studentId.toLowerCase()));
  }

  function filterRows() {
    const search = document.getElementById("student-search");
    if (search) {
      const query = search.value.trim().toLowerCase();
      const faculty = document.getElementById("student-faculty")?.value || "";
      const year = document.getElementById("student-year")?.value || "";
      document.querySelectorAll("[data-student-row]").forEach((row) => {
        row.hidden = !(row.dataset.search.includes(query) && (!faculty || row.dataset.faculty === faculty) && (!year || row.dataset.year === year));
      });
    }
    const activitySearch = document.getElementById("activity-search");
    if (activitySearch) {
      const query = activitySearch.value.trim().toLowerCase();
      const status = document.getElementById("activity-filter")?.value || "";
      document.querySelectorAll("[data-activity-row]").forEach((row) => { row.hidden = !row.dataset.search.includes(query); });
      document.querySelectorAll("#activity-cards .event-card").forEach((card) => {
        const joinedText = card.querySelector("button")?.textContent.includes("ลงทะเบียนแล้ว");
        const cardText = card.textContent.toLowerCase();
        card.hidden = !cardText.includes(query) || (status === "upcoming" && cardText.includes("ปิดรับสมัคร")) || (status === "registered" && !joinedText);
      });
    }
    const logSearch = document.getElementById("log-search");
    if (logSearch) {
      const query = logSearch.value.trim().toLowerCase();
      document.querySelectorAll("[data-log-row]").forEach((row) => { row.hidden = !row.dataset.search.includes(query); });
    }
  }

  document.addEventListener("click", async (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) { navigate(viewButton.dataset.view); return; }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === "toggle-menu") {
      document.getElementById("sidebar")?.classList.toggle("open");
      document.getElementById("mobile-overlay")?.classList.toggle("show");
    } else if (action === "logout") {
      logAction("ออกจากระบบ");
      state.currentUserId = null;
      activeView = "home";
      persist();
      render();
      toast("ออกจากระบบเรียบร้อยแล้ว");
    } else if (action === "close-modal") {
      document.querySelector(".modal-backdrop")?.remove();
    } else if (action === "new-activity") openActivityForm();
    else if (action === "edit-activity") openActivityForm(state.activities.find((item) => item.id === id));
    else if (action === "delete-activity") {
      const item = state.activities.find((activity) => activity.id === id);
      if (item && window.confirm(`ลบกิจกรรม “${item.title}” หรือไม่?`)) {
        state.activities = state.activities.filter((activity) => activity.id !== id);
        logAction("ลบกิจกรรม", item.title); persist(); render(); toast("ลบกิจกรรมแล้ว");
      }
    } else if (action === "new-news") openNewsForm();
    else if (action === "edit-news") openNewsForm(state.news.find((item) => item.id === id));
    else if (action === "delete-news") {
      const item = state.news.find((news) => news.id === id);
      if (item && window.confirm(`ลบข่าวสาร “${item.title}” หรือไม่?`)) {
        state.news = state.news.filter((news) => news.id !== id);
        logAction("ลบข่าวสาร", item.title); persist(); render(); toast("ลบข่าวสารแล้ว");
      }
    } else if (action === "new-student") openStudentForm();
    else if (action === "edit-student") openStudentForm(state.users.find((user) => user.id === id));
    else if (action === "delete-student") {
      const item = state.users.find((user) => user.id === id);
      if (item && window.confirm(`ลบนักศึกษา ${fullName(item)} หรือไม่?`)) {
        state.users = state.users.filter((user) => user.id !== id);
        logAction("ลบนักศึกษา", `${fullName(item)} (${item.studentId})`); persist(); render(); toast("ลบนักศึกษาแล้ว");
      }
    } else if (action === "join-event") {
      const user = currentUser();
      const item = state.activities.find((activity) => activity.id === id);
      if (!user || !item || joined(item, user) || (item.capacity && item.attendees >= item.capacity)) return;
      user.activityIds = [...(user.activityIds || []), id];
      item.attendees = (item.attendees || 0) + 1;
      logAction("ลงทะเบียนกิจกรรม", item.title); persist(); render(); toast("ลงทะเบียนกิจกรรมเรียบร้อยแล้ว");
    } else if (action === "remove-setting") {
      const values = state[button.dataset.kind];
      const index = Number(button.dataset.index);
      if (!Array.isArray(values) || !values[index]) return;
      if (window.confirm(`ลบ “${values[index]}” ออกจากรายการหรือไม่?`)) {
        values.splice(index, 1); logAction("แก้ไขการตั้งค่าระบบ", "ลบรายการตัวเลือก"); persist(); render(); toast("ลบรายการแล้ว");
      }
    } else if (action === "reset-data") {
      if (window.confirm("คืนค่าข้อมูลตัวอย่างทั้งหมดหรือไม่? การเปลี่ยนแปลงในเครื่องนี้จะหายไป")) {
        localStorage.removeItem(STORAGE_KEY);
        Object.keys(state).forEach((key) => delete state[key]);
        Object.assign(state, JSON.parse(JSON.stringify(seed)), { currentUserId: "u-admin" });
        activeView = "overview"; persist(); render(); toast("คืนค่าข้อมูลตัวอย่างแล้ว");
      }
    }
  });

  document.addEventListener("input", (event) => {
    if (["student-search", "activity-search", "log-search"].includes(event.target.id)) filterRows();
  });
  document.addEventListener("change", async (event) => {
    if (["student-faculty", "student-year", "activity-filter"].includes(event.target.id)) filterRows();
    if (["profile-avatar", "register-avatar"].includes(event.target.id)) {
      try {
        const image = await readImage(event.target.files?.[0]);
        if (!image) return;
        if (event.target.id === "profile-avatar") {
          const user = currentUser();
          if (!user) return;
          user.avatar = image; logAction("เปลี่ยนรูปโปรไฟล์"); persist(); render(); toast("เปลี่ยนรูปโปรไฟล์แล้ว");
        } else {
          const label = event.target.closest(".upload-box");
          label.querySelector(".upload-glyph").textContent = "✓";
          label.querySelector("strong").textContent = "เลือกภาพแล้ว";
          label.dataset.image = image;
        }
      } catch (error) { toast(error.message, true); }
    }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    const formId = form.getAttribute("id");
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      if (formId === "login-form") {
        const user = state.users.find((item) => item.email.toLowerCase() === values.email.trim().toLowerCase() && item.password === values.password);
        const record = { id: `login-${Date.now()}`, userId: user?.id || "unknown", userName: user ? fullName(user) : values.email, timestamp: new Date().toISOString(), status: user ? "สำเร็จ" : "ไม่สำเร็จ" };
        state.loginHistory.unshift(record); state.loginHistory = state.loginHistory.slice(0, 250);
        if (!user) { persist(); toast("อีเมลหรือรหัสผ่านไม่ถูกต้อง", true); return; }
        state.currentUserId = user.id;
        logAction("เข้าสู่ระบบ");
        activeView = user.role === "student" ? "home" : "overview";
        persist(); render(); toast(`ยินดีต้อนรับ ${user.firstName}`);
      } else if (formId === "register-form") {
        const email = values.email.trim();
        const studentId = values.studentId.trim();
        if (!validCampusEmail(email)) { toast("กรุณาใช้อีเมลมหาวิทยาลัยที่ลงท้ายด้วย @rmutto หรือ @rmutto.ac.th", true); return; }
        if (hasDuplicateStudent(email, studentId)) { toast("อีเมลหรือรหัสนักศึกษานี้ถูกใช้งานแล้ว", true); return; }
        const [firstName, ...lastParts] = values.name.trim().split(/\s+/);
        if (!lastParts.length) { toast("กรุณากรอกชื่อจริงและนามสกุล", true); return; }
        const avatar = document.querySelector(".upload-box")?.dataset.image || "";
        const user = { id: `u-${Date.now()}`, role: "student", email, password: values.password, studentId, firstName, lastName: lastParts.join(" "), faculty: values.faculty, department: values.department, year: values.year, avatar, activityIds: [] };
        state.users.push(user); state.currentUserId = user.id;
        state.loginHistory.unshift({ id: `login-${Date.now()}`, userId: user.id, userName: fullName(user), timestamp: new Date().toISOString(), status: "สำเร็จ" });
        logAction("ลงทะเบียนบัญชี", `สร้างบัญชีนักศึกษา ${studentId}`);
        activeView = "home"; persist(); render(); toast("ลงทะเบียนสำเร็จ QR Code ส่วนตัวพร้อมใช้งานแล้ว");
      } else if (formId === "activity-form") {
        const file = form.elements.image.files?.[0];
        const existing = state.activities.find((item) => item.id === values.id);
        const image = file ? await readImage(file) : existing?.image || "";
        if (values.capacity && Number(values.capacity) < (existing?.attendees || 0)) { toast("จำนวนรับคนต้องไม่ต่ำกว่ายอดผู้ลงทะเบียนแล้ว", true); return; }
        const item = {
          ...existing,
          id: existing?.id || `ev-${Date.now()}`,
          title: values.title.trim(), date: values.date, time: values.time,
          requiredCount: Math.max(1, Number(values.requiredCount) || 1),
          capacity: values.capacity ? Math.max(1, Number(values.capacity)) : null,
          location: values.location.trim(), description: values.description.trim(),
          reminder: values.reminder.trim(), image, attendees: existing?.attendees || 0,
          status: "เปิดรับสมัคร"
        };
        if (existing) state.activities = state.activities.map((activity) => activity.id === existing.id ? item : activity);
        else state.activities.unshift(item);
        logAction(existing ? "แก้ไขกิจกรรม" : "สร้างกิจกรรม", item.title);
        persist(); document.querySelector(".modal-backdrop")?.remove(); render(); toast(existing ? "บันทึกการแก้ไขกิจกรรมแล้ว" : "สร้างกิจกรรมเรียบร้อยแล้ว");
      } else if (formId === "news-form") {
        const file = form.elements.image.files?.[0];
        const existing = state.news.find((item) => item.id === values.id);
        const image = file ? await readImage(file) : existing?.image || "";
        const item = { ...existing, id: existing?.id || `news-${Date.now()}`, title: values.title.trim(), date: values.date, category: values.category, body: values.body.trim(), image };
        if (existing) state.news = state.news.map((news) => news.id === existing.id ? item : news);
        else state.news.unshift(item);
        logAction(existing ? "แก้ไขข่าวสาร" : "สร้างข่าวสาร", item.title);
        persist(); document.querySelector(".modal-backdrop")?.remove(); render(); toast(existing ? "บันทึกการแก้ไขข่าวสารแล้ว" : "เผยแพร่ข่าวสารแล้ว");
      } else if (formId === "student-form") {
        const email = values.email.trim();
        const studentId = values.studentId.trim();
        const existing = state.users.find((user) => user.id === values.id);
        if (!validCampusEmail(email)) { toast("กรุณาใช้อีเมลมหาวิทยาลัยที่ลงท้ายด้วย @rmutto หรือ @rmutto.ac.th", true); return; }
        if (hasDuplicateStudent(email, studentId, existing?.id)) { toast("อีเมลหรือรหัสนักศึกษานี้ถูกใช้งานแล้ว", true); return; }
        const [firstName, ...lastParts] = values.name.trim().split(/\s+/);
        if (!lastParts.length) { toast("กรุณากรอกชื่อจริงและนามสกุล", true); return; }
        const avatar = values.avatar instanceof File && values.avatar.size ? await readImage(values.avatar) : existing?.avatar || "";
        const student = { ...existing, id: existing?.id || `u-${Date.now()}`, role: "student", email, studentId, firstName, lastName: lastParts.join(" "), faculty: values.faculty, department: values.department, year: values.year, activityIds: existing?.activityIds || [], avatar, password: values.password || existing?.password || "student123" };
        if (existing) state.users = state.users.map((user) => user.id === existing.id ? student : user);
        else state.users.push(student);
        logAction(existing ? "แก้ไขข้อมูลนักศึกษา" : "เพิ่มนักศึกษา", `${fullName(student)} (${student.studentId})`);
        persist(); document.querySelector(".modal-backdrop")?.remove(); render(); toast(existing ? "บันทึกข้อมูลนักศึกษาแล้ว" : "เพิ่มนักศึกษาแล้ว");
      } else if (formId === "checkin-form") {
        const code = values.code.trim().replace(/^QRE-/i, "");
        const student = state.users.find((user) => user.role === "student" && user.studentId.toLowerCase() === code.toLowerCase());
        const eventItem = state.activities.find((item) => item.id === values.activityId);
        if (!student || !eventItem) { toast("ไม่พบรหัสนักศึกษาหรือกิจกรรมที่เลือก", true); return; }
        const attendanceCount = state.checkins.filter((record) => record.userId === student.id && record.activityId === eventItem.id).length;
        if (attendanceCount >= (eventItem.requiredCount || 1)) { toast("นักศึกษาคนนี้เข้าร่วมครบจำนวนครั้งที่กำหนดแล้ว", true); return; }
        const wasRegistered = student.activityIds?.includes(eventItem.id) || false;
        if (!wasRegistered && eventItem.capacity && eventItem.attendees >= eventItem.capacity) { toast("กิจกรรมนี้มีผู้เข้าร่วมครบจำนวนแล้ว", true); return; }
        state.checkins.unshift({ id: `checkin-${Date.now()}`, userId: student.id, activityId: eventItem.id, timestamp: new Date().toISOString() });
        student.activityIds = [...new Set([...(student.activityIds || []), eventItem.id])];
        if (!wasRegistered) eventItem.attendees = (eventItem.attendees || 0) + 1;
        logAction("เช็กชื่อเข้าร่วมกิจกรรม", `${fullName(student)} · ${eventItem.title}`);
        persist(); render(); toast(`เช็กชื่อ ${fullName(student)} สำเร็จ`);
      } else if (formId === "faculty-form" || formId === "department-form") {
        const key = formId === "faculty-form" ? "faculties" : "departments";
        const value = values.value.trim();
        if (state[key].some((item) => item.toLowerCase() === value.toLowerCase())) { toast("รายการนี้มีอยู่แล้ว", true); return; }
        state[key].push(value); logAction("แก้ไขการตั้งค่าระบบ", `เพิ่ม${key === "faculties" ? "คณะ" : "สาขา"} ${value}`);
        persist(); render(); toast("เพิ่มรายการแล้ว");
      }
    } catch (error) {
      console.error("Form submission failed.", error);
      toast(error.message || "บันทึกข้อมูลไม่สำเร็จ", true);
    }
  });

  if (state.currentUserId && !currentUser()) {
    state.currentUserId = null;
    persist();
  }
  render();
})();
