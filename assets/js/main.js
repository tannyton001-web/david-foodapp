/* App Food Việt Nam — main.js
   Nav, scroll reveal, nút nổi Call/Zalo, form đăng ký tư vấn (endpoint Apps Script).
   Quy tắc cứng: không lưu PII vào localStorage/sessionStorage/URL/console/dataLayer. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----- Header: đổi nền khi cuộn ----- */
  var header = document.querySelector(".site-header");
  function onScrollHeader() {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  if (header) {
    onScrollHeader();
    window.addEventListener("scroll", onScrollHeader, { passive: true });
  }

  /* ----- Menu mobile -----
     Khóa scroll bằng position:fixed trên body (đáng tin cậy hơn overflow:hidden
     đơn thuần trên iOS Safari — bản overflow:hidden cũ vẫn để lọt touch-scroll
     ở một số phiên bản). Ghi lại scrollY trước khi khóa, trả đúng vị trí khi
     đóng menu để không bị nhảy trang. */
  var navToggle = document.querySelector(".nav-toggle");
  if (navToggle) {
    var scrollYTruocKhiMoMenu = 0;
    var dangMoMenu = false;
    function moMenu() {
      if (dangMoMenu) return;
      dangMoMenu = true;
      scrollYTruocKhiMoMenu = window.scrollY || window.pageYOffset;
      document.body.style.position = "fixed";
      document.body.style.top = "-" + scrollYTruocKhiMoMenu + "px";
      document.body.style.width = "100%";
      /* Ép reflow trước khi thêm class mở menu — tránh trường hợp trình duyệt
         mobile (đặc biệt Safari/iOS) bắt đầu transition opacity của .main-nav
         dựa trên layout cũ (trước khi scroll-lock của body được commit), có
         thể khiến overlay composite sai vị trí ngay sau khi vừa cuộn. */
      void document.body.offsetHeight;
      document.body.classList.add("nav-open");
      navToggle.setAttribute("aria-expanded", "true");
    }
    function dongMenu() {
      if (!dangMoMenu) return;
      dangMoMenu = false;
      document.body.classList.remove("nav-open");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollYTruocKhiMoMenu);
      navToggle.setAttribute("aria-expanded", "false");
    }
    navToggle.addEventListener("click", function () {
      if (dangMoMenu) dongMenu(); else moMenu();
    });
    document.querySelectorAll(".main-nav a").forEach(function (a) {
      a.addEventListener("click", dongMenu);
    });
  }

  /* ----- Scroll reveal ----- */
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ----- Nút nổi Call/Zalo ----- */
  var floating = document.querySelector(".floating-cta");
  var form = document.querySelector("[data-lead-form]");
  var footer = document.querySelector(".site-footer");
  if (floating) {
    var showAt = floating.hasAttribute("data-show-now") ? 0 : 320;
    var onScrollFab = function () {
      floating.classList.toggle("is-visible", window.scrollY >= showAt);
    };
    onScrollFab();
    window.addEventListener("scroll", onScrollFab, { passive: true });

    /* Không che form hoặc footer: 1 trong 2 vào khung nhìn thì tạm ẩn nút nổi */
    if ((form || footer) && "IntersectionObserver" in window) {
      var fabMute = { form: false, footer: false };
      var updateFabMute = function () {
        floating.classList.toggle("is-muted", fabMute.form || fabMute.footer);
      };
      if (form) {
        new IntersectionObserver(function (entries) {
          fabMute.form = entries[0].isIntersecting;
          updateFabMute();
        }, { threshold: 0.12 }).observe(form);
      }
      if (footer) {
        new IntersectionObserver(function (entries) {
          fabMute.footer = entries[0].isIntersecting;
          updateFabMute();
        }, { threshold: 0.12 }).observe(footer);
      }
    }
  }

  /* ================= FORM ĐĂNG KÝ TƯ VẤN =================
     Payload phải khớp đúng hợp đồng dữ liệu với backend:
     - Payload apps dùng LABEL đúng whitelist endpoint ("Xanh SM", không phải "Xanh SM Ngon").
     - dataLayer + /cam-on/ dùng KEY (grabfood, shopeefood, befood, xanhsm).
     - Success duy nhất: ok === true && lead_saved === true && conversion_eligible === true. */
  if (!form) return;

  var ENDPOINT = form.getAttribute("data-endpoint");
  var FORM_LOCATION = form.getAttribute("data-form-location") || "form";

  var inputs = {
    ten_quan: form.querySelector("#ten-quan"),
    so_dien_thoai: form.querySelector("#so-dien-thoai"),
    ten_chu_quan: form.querySelector("#ten-chu-quan"),
    dia_chi_quan: form.querySelector("#dia-chi")
  };
  var TEN_MUC = {
    apps: "lựa chọn ứng dụng",
    ten_quan: "tên quán",
    so_dien_thoai: "số điện thoại",
    ten_chu_quan: "tên chủ quán",
    dia_chi_quan: "địa chỉ quán"
  };
  var appAlert = form.querySelector(".form-alert");
  var appBoxes = form.querySelectorAll('input[name="apps"]');
  var submitBtn = form.querySelector('button[type="submit"]');
  var btnText = submitBtn.querySelector(".btn-text");
  var btnTextGoc = btnText.textContent;
  var statusBox = form.querySelector("[data-form-status]");
  var statusText = statusBox.querySelector("[data-status-text]");

  var attempted = false;
  var isSubmitting = false;

  /* Chọn sẵn app từ query (?app=grabfood) — chỉ đọc key, không đọc PII từ URL */
  var preselect = new URLSearchParams(window.location.search).get("app");
  if (preselect) {
    var box = form.querySelector('input[name="apps"][data-key="' + preselect.replace(/[^a-z]/g, "") + '"]');
    if (box) box.checked = true;
  }

  /* Phone strict — khớp endpoint: chỉ trim đầu/cuối, không normalize +84,
     không strip ký tự giữa chuỗi; nhận đúng /^0\d{9}$/, chặn 10 số lặp. */
  function phoneHopLe(v) {
    return /^0\d{9}$/.test(v) && !/^(\d)\1{9}$/.test(v);
  }

  function loiCuaField(name) {
    if (name === "apps") {
      return form.querySelector('input[name="apps"]:checked') ? null : "Chọn ít nhất 1 ứng dụng.";
    }
    var v = inputs[name].value.trim();
    if (name === "so_dien_thoai") {
      if (!v) return "Nhập số điện thoại.";
      if (!phoneHopLe(v)) return "SĐT gồm 10 số, bắt đầu bằng 0.";
      return null;
    }
    if (!v) {
      return { ten_quan: "Nhập tên quán.", ten_chu_quan: "Nhập tên chủ quán.", dia_chi_quan: "Nhập địa chỉ quán." }[name];
    }
    return null;
  }

  /* State máy 3 trạng thái cho field (chỉ trình bày — không đổi validate/payload):
     1. Untouched/chưa submit: neutral (attempted=false, không thêm class nào).
     2. Invalid: has-error (đỏ đất) + message, is-valid luôn bị gỡ trước.
     3. Valid: is-valid (xanh) ỔN ĐỊNH — giữ nguyên tới khi field bị sửa thành
        sai lại, KHÔNG tự mờ/tắt theo thời gian (khác bản cũ dùng setTimeout
        1.5s — đó chính là nguyên nhân user thấy "điền đúng xong lại như lỗi":
        xanh tắt về neutral rồi dễ bị hiểu nhầm là quay lại đỏ). */
  function veLoiField(name, msg) {
    if (name === "apps") {
      if (appAlert) appAlert.classList.toggle("is-visible", !!msg);
      return;
    }
    var input = inputs[name];
    var wrap = input.closest(".form-field");
    wrap.classList.toggle("has-error", !!msg);
    if (msg) {
      wrap.classList.remove("is-valid");
      input.setAttribute("aria-invalid", "true");
      var errText = wrap.querySelector(".field-error span");
      if (errText) errText.textContent = msg;
    } else {
      input.removeAttribute("aria-invalid");
      wrap.classList.toggle("is-valid", attempted);
    }
  }

  /* Validate tất cả, trả danh sách field lỗi theo thứ tự DOM */
  var THU_TU = ["apps", "ten_quan", "so_dien_thoai", "ten_chu_quan", "dia_chi_quan"];
  function validateAll() {
    var bad = [];
    THU_TU.forEach(function (name) {
      var msg = loiCuaField(name);
      veLoiField(name, msg);
      if (msg) bad.push(name);
    });
    return bad;
  }

  /* SĐT: chỉ cho nhập chữ số, tối đa 10 — chặn cả gõ lẫn dán ký tự lạ.
     KHÔNG tự chuyển +84 → 0 (giữ đúng rule strict); người dùng dán +84... sẽ
     bị lọc còn chữ số rồi tự sửa theo lỗi hiển thị. Đăng ký trước listener
     re-validate bên dưới để value đã sạch khi kiểm. */
  inputs.so_dien_thoai.addEventListener("input", function () {
    var digits = this.value.replace(/\D/g, "").slice(0, 10);
    if (this.value !== digits) this.value = digits;
  });

  function danhSachLoiHienTai() {
    return THU_TU.filter(function (name) { return loiCuaField(name); });
  }

  /* Cập nhật lại summary theo tổng số lỗi CÒN LẠI — không đợi bấm gửi lần 2.
     Không shake lại (chỉ shake 1 lần lúc bấm gửi fail), tránh giật khi gõ. */
  function capNhatSummaryTheoLoiConLai() {
    if (!attempted) return;
    var bad = danhSachLoiHienTai();
    if (!bad.length) {
      anStatus();
    } else if (statusBox.classList.contains("is-visible") && statusBox.classList.contains("is-error")) {
      statusText.textContent = bad.length === 1
        ? "Chưa gửi được — kiểm tra lại " + TEN_MUC[bad[0]] + "."
        : "Chưa gửi được — cần bổ sung " + bad.length + " mục được đánh dấu.";
    }
  }

  /* "Reward early": sau lần bấm gửi đầu, field đang lỗi/valid được re-validate
     qua NHIỀU loại sự kiện — bắt đủ mọi cách giá trị có thể đổi: gõ tay, xóa,
     dán, and phím tắt, tab qua field khác, và autofill/gợi ý bàn phím (iPhone
     gợi ý số điện thoại đã lưu, "AutoFill" trên Safari...). Trước đây chỉ nghe
     "input" nên có trường hợp autofill không bắn đúng sự kiện chuẩn khiến lỗi
     không tự xóa dù giá trị đã hợp lệ. */
  var CAC_SU_KIEN_KIEM_LAI = ["input", "change", "blur", "keyup", "compositionend"];
  function kiemTraLaiField(name) {
    if (attempted) veLoiField(name, loiCuaField(name));
    capNhatSummaryTheoLoiConLai();
  }
  /* Autofill/gợi ý bàn phím đôi khi không bắn sự kiện chuẩn ngay lập tức (đặc
     biệt Safari iOS) — xếp lịch kiểm lại vài lần ngắn sau khi field có tương
     tác, không phụ thuộc hoàn toàn vào 1 sự kiện duy nhất. */
  function kiemTraTreField(name) {
    [50, 150, 300].forEach(function (ms) {
      setTimeout(function () { kiemTraLaiField(name); }, ms);
    });
  }
  Object.keys(inputs).forEach(function (name) {
    CAC_SU_KIEN_KIEM_LAI.forEach(function (evt) {
      inputs[name].addEventListener(evt, function () { kiemTraLaiField(name); });
    });
    /* paste: trình duyệt chèn nội dung dán XONG mới cập nhật value — đợi 1 tick */
    inputs[name].addEventListener("paste", function () {
      setTimeout(function () { kiemTraLaiField(name); }, 0);
    });
    inputs[name].addEventListener("focus", function () { kiemTraTreField(name); });
    inputs[name].addEventListener("input", function () { kiemTraTreField(name); });
  });
  appBoxes.forEach(function (box) {
    box.addEventListener("change", function () {
      if (attempted) veLoiField("apps", loiCuaField("apps"));
      capNhatSummaryTheoLoiConLai();
    });
  });

  function hienStatus(loai, msg) {
    statusBox.classList.remove("is-visible", "is-error", "is-info");
    statusText.textContent = msg;
    statusBox.classList.add(loai === "info" ? "is-info" : "is-error");
    /* reflow để animation shake chạy lại được */
    void statusBox.offsetWidth;
    statusBox.classList.add("is-visible");
  }
  function anStatus() {
    statusBox.classList.remove("is-visible", "is-error", "is-info");
    statusText.textContent = "";
  }

  function setDangGui(dang) {
    isSubmitting = dang;
    submitBtn.disabled = dang;
    submitBtn.classList.toggle("is-loading", dang);
    submitBtn.setAttribute("aria-busy", dang ? "true" : "false");
    if (dang) btnText.textContent = "Đang gửi...";
  }

  function focusFieldDau(name) {
    var el = name === "apps" ? form.querySelector('input[name="apps"]') : inputs[name];
    if (el) el.focus();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (isSubmitting) return;
    attempted = true;

    var bad = validateAll();
    if (bad.length) {
      /* Tầng 2 — summary dưới nút gửi. Không fetch, không dataLayer, không redirect. */
      hienStatus("error", bad.length === 1
        ? "Chưa gửi được — kiểm tra lại " + TEN_MUC[bad[0]] + "."
        : "Chưa gửi được — cần bổ sung " + bad.length + " mục được đánh dấu.");
      focusFieldDau(bad[0]);
      return;
    }

    anStatus();
    setDangGui(true);

    var appLabels = Array.prototype.map.call(
      form.querySelectorAll('input[name="apps"]:checked'),
      function (b) { return b.value; }
    );
    var appKeys = Array.prototype.map.call(
      form.querySelectorAll('input[name="apps"]:checked'),
      function (b) { return b.getAttribute("data-key"); }
    );

    var payload = {
      ten_quan: inputs.ten_quan.value.trim(),
      so_dien_thoai: inputs.so_dien_thoai.value.trim(),
      ten_chu_quan: inputs.ten_chu_quan.value.trim(),
      dia_chi_quan: inputs.dia_chi_quan.value.trim(),
      apps: appLabels,
      page_url: window.location.href,
      website: (form.querySelector('input[name="website"]') || { value: "" }).value
    };

    /* Timeout ≥15s (Apps Script cold start 1–5s); timeout xử lý như failure/retry */
    var controller = "AbortController" in window ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, 20000);

    /* KHÔNG set Content-Type (tránh CORS preflight), KHÔNG no-cors, phải đọc JSON body */
    fetch(ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    })
      .then(function (r) { return r.json(); })
      .then(function (body) {
        if (timer) clearTimeout(timer);
        if (body && body.ok === true && body.lead_saved === true && body.conversion_eligible === true) {
          thanhCong(appKeys);
        } else if (body && body.duplicate === true) {
          /* Soft success: không dataLayer, không conversion, không redirect, không xóa form */
          setDangGui(false);
          btnText.textContent = btnTextGoc;
          hienStatus("info", "SĐT này đã được đăng ký trước đó. Chúng tôi sẽ liên hệ bạn qua số này — không cần gửi lại.");
        } else {
          guiLoi();
        }
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        guiLoi();
      });
  });

  /* Failure/retry: giữ nguyên dữ liệu trong DOM, không lưu đâu khác */
  function guiLoi() {
    setDangGui(false);
    btnText.textContent = "Gửi lại";
    hienStatus("error", "Chưa gửi được. Thông tin vẫn giữ, bấm Gửi lại.");
  }

  /* Success duy nhất: push dataLayer (chỉ keys + page_path + form_location, cấm PII)
     rồi redirect /cam-on/?apps=<keys>. Trang cảm ơn không chứa conversion code. */
  function thanhCong(appKeys) {
    window.dataLayer = window.dataLayer || [];
    var daChuyen = false;
    function chuyenTrang() {
      if (daChuyen) return;
      daChuyen = true;
      window.location.href = "/cam-on/?apps=" + appKeys.join(",");
    }
    window.dataLayer.push({
      event: "lead_form_submit_success",
      apps: appKeys,
      page_path: window.location.pathname,
      form_location: FORM_LOCATION,
      eventCallback: chuyenTrang,
      eventTimeout: 2000
    });
    /* GTM lỗi tải/bị chặn (ad-blocker...): không có google_tag_manager thì chuyển trang ngay,
       không chặn luồng người dùng chờ event callback không bao giờ tới. */
    if (!window.google_tag_manager) chuyenTrang();
  }
})();
