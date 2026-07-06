# App Food Việt Nam

Website tĩnh (HTML/CSS/JS thuần, không build step) cho dịch vụ tư vấn/hỗ trợ độc lập
giúp chủ quán chuẩn bị hồ sơ đăng ký gian hàng trên các app giao đồ ăn tại Việt Nam
(GrabFood, ShopeeFood, BeFood, Xanh SM). Không phải kênh chính thức, đối tác, đại lý
hay bên được ủy quyền của bất kỳ nền tảng nào.

**Domain:** https://appfoodvietnam.com

## Cấu trúc

Repo root chính là web root — mỗi thư mục con (`dang-ky/`, `dich-vu/`, `bao-gia/`,
`gioi-thieu/`, `cau-hoi-thuong-gap/`, `chinh-sach/`, `lien-he/`, `cam-on/`) chứa
1 `index.html` tương ứng route đó. `assets/` gồm `css/`, `js/`, `fonts/` (self-host,
không phụ thuộc CDN ngoài) và `img/`.

## Deploy

Site tĩnh thuần — không cần build, không cần Node/npm ở production. Deploy bằng cách
trỏ document root của hosting (Hostinger) vào chính thư mục repo này.

## Form đăng ký tư vấn

Form gọi tới 1 Google Apps Script Web App endpoint (đã cấu hình sẵn trong thuộc tính
`data-endpoint` của mỗi `<form>`). Source backend không nằm trong repo này.
