# THANH BÌNH BĐS CMS

## 1. Cập nhật Firestore Rules
Firebase Console → Firestore Database → Règles, dán nội dung file `firestore.rules`, rồi bấm Publier.

## 2. Đưa lên GitHub
Sao chép toàn bộ file trong thư mục này vào repository `thanhbinhbds`, Commit và Push.
Cloudflare Pages sẽ tự triển khai.

## 3. Đăng nhập quản trị
Mở: https://thanhbinhbds.id.vn/admin/
Dùng email và mật khẩu đã tạo trong Firebase Authentication.

## 4. Thêm ảnh
Bản này dùng URL ảnh hoặc đường dẫn file ảnh đã có trong website. Ví dụ:
- assets/images/dat-nen-dien-tho-1.jpg
- https://.../anh.jpg
Mỗi dòng trong ô “Danh sách ảnh” là một ảnh.

## 5. Dữ liệu cũ
Xóa document `auto-id` rỗng trong collection `batdongsan` nếu muốn. Trang quản trị sẽ tạo document đúng tự động.
