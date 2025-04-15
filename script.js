/******************************************
 * 1) استيراد مكتبات Firebase
 ******************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js";
import { getDatabase, ref, set, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

/******************************************
 * 2) تهيئة Firebase
 ******************************************/
const firebaseConfig = {
  apiKey: "AIzaSyAJ0-sORcqWQKzg9WNi8P_quqD-ME_J5-c",
  authDomain: "meetingroombookings-d9610.firebaseapp.com",
  databaseURL: "https://meetingroombookings-d9610-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "meetingroombookings-d9610",
  storageBucket: "meetingroombookings-d9610.firebasestorage.app",
  messagingSenderId: "824651712573",
  appId: "1:824651712573:web:8191671d8a96ca12638254",
  measurementId: "G-M03PZVMB10"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

/******************************************
 * 3) إعدادات عامة للجدول والحجوزات
 ******************************************/
const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const times = generateTimes12(8, 22); // من 8 صباحاً إلى 10 مساءً

// مصفوفة الحجوزات: bookings[dayIndex][timeIndex] = null أو كائن يحتوي على بيانات الحجز
let bookings = [];

/******************************************
 * 4) دالة normalizeBookings: تحويل البيانات المُسترجعة إلى مصفوفة ثنائية الأبعاد بالشكل المطلوب
 ******************************************/
function normalizeBookings(data) {
  let normalized = [];
  for (let i = 0; i < days.length; i++) {
    // إذا لم توجد بيانات لهذا اليوم، نستخدم كائن فارغ
    let dayData = (data && data[i]) ? data[i] : {};
    let arr = [];
    for (let j = 0; j < times.length; j++) {
      // إذا كانت القيمة موجودة، نستخدمها، وإلا نضع null
      arr[j] = (dayData[j] !== undefined) ? dayData[j] : null;
    }
    normalized[i] = arr;
  }
  return normalized;
}

/******************************************
 * 5) دالة توليد الأوقات (كل نصف ساعة) بصيغة 12 ساعة
 ******************************************/
function generateTimes12(start24, end24) {
  let result = [];
  let start = start24 * 2;
  let end = end24 * 2;
  for (let i = start; i < end; i++) {
    let hour24 = Math.floor(i / 2);
    let minute = (i % 2) * 30;
    let hour12 = (hour24 % 12) || 12;
    let ampm = (hour24 < 12) ? "ص" : "م";
    let minuteStr = minute === 0 ? "00" : "30";
    let hourStr = hour12.toString().padStart(2, '0');
    result.push(`${hourStr}:${minuteStr} ${ampm}`);
  }
  return result;
}

/******************************************
 * 6) دالة تهيئة مصفوفة حجوزات فارغة
 ******************************************/
function initEmptyBookings() {
  let empty = [];
  for (let d = 0; d < days.length; d++) {
    let dayArray = [];
    for (let t = 0; t < times.length; t++) {
      dayArray.push(null);
    }
    empty.push(dayArray);
  }
  return empty;
}

/******************************************
 * 7) مستمع onValue لتحديث بيانات الحجوزات والقوائم في الوقت الحقيقي
 ******************************************/
const bookingsRef = ref(database, 'bookings');
onValue(bookingsRef, (snapshot) => {
  if (snapshot.exists()) {
    let data = snapshot.val();
    bookings = normalizeBookings(data);
  } else {
    bookings = initEmptyBookings();
  }
  // تحديث القوائم وإعادة رسم الجدول تلقائيًا عند تغير البيانات
  populateTimeSelects();
  renderSchedule();
});

/******************************************
 * 8) دوال مساعدة: تحويل نوع الحجز إلى اسم كلاس ومقارنة الحجوزات
 ******************************************/
function bookingTypeToClass(bookingType) {
  if (!bookingType || typeof bookingType !== "string") return "";
  let normalized = bookingType.replace(/\s|\./g, "_");
  return "type-" + normalized;
}

function isSameBooking(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a === 'object' && typeof b === 'object') {
    return a.type === b.type && a.owner === b.owner;
  }
  return false;
}

/******************************************
 * 9) بناء الجدول وعرض الحجوزات
 ******************************************/
function renderSchedule() {
  const scheduleHeader = document.getElementById("scheduleHeader");
  const scheduleBody = document.getElementById("scheduleBody");
  scheduleHeader.innerHTML = "";
  scheduleBody.innerHTML = "";

  // إنشاء صف العناوين
  let headerRow = document.createElement("tr");
  let dayTimeTH = document.createElement("th");
  dayTimeTH.textContent = "اليوم / الوقت";
  headerRow.appendChild(dayTimeTH);
  for (let i = 0; i < times.length; i++) {
    let th = document.createElement("th");
    th.textContent = times[i];
    headerRow.appendChild(th);
  }
  scheduleHeader.appendChild(headerRow);

  // إنشاء صف لكل يوم
  for (let d = 0; d < days.length; d++) {
    let row = document.createElement("tr");
    let dayCell = document.createElement("td");
    dayCell.textContent = days[d];
    row.appendChild(dayCell);
    let dayBookings = (bookings[d] && Array.isArray(bookings[d]))
                      ? bookings[d]
                      : new Array(times.length).fill(null);
    for (let t = 0; t < times.length;) {
      if (dayBookings[t] === null || dayBookings[t] === undefined) {
        let freeTd = document.createElement("td");
        freeTd.classList.add("freeCell");
        row.appendChild(freeTd);
        t++;
      } else {
        let bookingEntry = dayBookings[t];
        let count = 1;
        while (t + count < times.length && isSameBooking(bookingEntry, dayBookings[t + count])) {
          count++;
        }
        let bookedTd = document.createElement("td");
        bookedTd.classList.add("bookedCell");
        let typeForClass = (typeof bookingEntry === "object") ? bookingEntry.type : bookingEntry;
        bookedTd.classList.add(bookingTypeToClass(typeForClass));
        bookedTd.colSpan = count;
        if (typeof bookingEntry === "object") {
          let bookingTextDiv = document.createElement("div");
          bookingTextDiv.textContent = bookingEntry.type;
          bookedTd.appendChild(bookingTextDiv);
          if (bookingEntry.owner && bookingEntry.owner.trim() !== "") {
            let ownerDiv = document.createElement("div");
            ownerDiv.classList.add("small-text");
            ownerDiv.textContent = bookingEntry.owner;
            bookedTd.appendChild(ownerDiv);
          }
          bookedTd.setAttribute("title", `تفاصيل الحجز: ${bookingEntry.type}${bookingEntry.owner ? " - " + bookingEntry.owner : ""}`);
        } else {
          bookedTd.textContent = bookingEntry;
          bookedTd.setAttribute("title", `تفاصيل الحجز: ${bookingEntry}`);
        }
        row.appendChild(bookedTd);
        t += count;
      }
    }
    scheduleBody.appendChild(row);
  }
}

/******************************************
 * 10) تعبئة القوائم المنسدلة للأوقات
 ******************************************/
function populateTimeSelects() {
  const startTimeSelect = document.getElementById("startTimeSelect");
  const endTimeSelect = document.getElementById("endTimeSelect");
  startTimeSelect.innerHTML = "";
  endTimeSelect.innerHTML = "";
  for (let i = 0; i < times.length; i++) {
    let optionStart = document.createElement("option");
    optionStart.value = i;
    optionStart.text = times[i];
    startTimeSelect.appendChild(optionStart);

    let optionEnd = document.createElement("option");
    optionEnd.value = i;
    optionEnd.text = times[i];
    endTimeSelect.appendChild(optionEnd);
  }
}

/******************************************
 * 11) عملية الحجز باستخدام معاملة (Transaction)
 ******************************************/
function bookSlot() {
  const dayIndex = parseInt(document.getElementById("daySelect").value);
  const startIndex = parseInt(document.getElementById("startTimeSelect").value);
  const endIndex = parseInt(document.getElementById("endTimeSelect").value);
  const bookingType = document.getElementById("bookingTypeSelect").value;
  const meetingOwner = document.getElementById("meetingOwner").value.trim();

  if (endIndex <= startIndex) {
    alert("وقت الانتهاء يجب أن يكون بعد وقت البدء.");
    return;
  }

  const bookingsRef = ref(database, 'bookings');
  runTransaction(bookingsRef, (currentData) => {
    if (currentData === null) {
      currentData = initEmptyBookings();
    } else {
      currentData = normalizeBookings(currentData);
    }
    const dayData = currentData[dayIndex];
    // التأكد من عدم وجود تعارض في الفترة المطلوبة
    for (let i = startIndex; i < endIndex; i++) {
      if (dayData[i] !== null) {
        return; // إلغاء المعاملة إذا كان هناك تعارض
      }
    }
    const bookingEntry = {
      type: bookingType,
      owner: meetingOwner
    };
    for (let i = startIndex; i < endIndex; i++) {
      dayData[i] = bookingEntry;
    }
    return currentData;
  }).then(function(result) {
    if (result.committed) {
      let updatedData = result.snapshot.val();
      bookings = normalizeBookings(updatedData);
      renderSchedule();
      alert("تم الحجز بنجاح!");
      document.getElementById("meetingOwner").value = "";
    } else {
      alert("لا يمكن الحجز؛ هناك وقت محجوز ضمن النطاق المطلوب.");
    }
  }).catch(function(error) {
    console.error("Transaction failed: ", error);
  });
}

/******************************************
 * 12) تفريغ الجدول
 ******************************************/
function clearSchedule() {
  if (!confirm("هل أنت متأكد من تفريغ الجدول؟ سيُمسح كل الحجز.")) {
    return;
  }
  const emptyData = initEmptyBookings();
  const bookingsRef = ref(database, 'bookings');
  set(bookingsRef, emptyData)
    .then(() => {
      bookings = emptyData;
      renderSchedule();
      alert("تم تفريغ الجدول بنجاح!");
    })
    .catch((error) => {
      console.error("خطأ في تفريغ الجدول:", error);
    });
}

/******************************************
 * جعل الدوال المستخدمة في onclick متاحة على النطاق العام
 ******************************************/
window.bookSlot = bookSlot;
window.clearSchedule = clearSchedule;

/******************************************
 * إضافة مستمع للفوتر المخفي لتفعيل عملية تفريغ الجدول عند النقر المزدوج
 ******************************************/
document.addEventListener("DOMContentLoaded", () => {
  const footer = document.getElementById("hidden-footer");
  if (footer) {
    footer.addEventListener("dblclick", () => {
      if (confirm("هل أنت متأكد من تفريغ الجدول؟")) {
        clearSchedule();
      }
    });
  }
});
