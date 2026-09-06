V6 高清原图版网页包

核心变化：
1. 用户本轮上传的高清 PNG 原图原字节保留，没有做降采样或 sprite 压缩。
2. with-images.html 改为直接引用 assets/images 下的原图。
3. 9/28 使用 2 张应县木塔 + 2 张悬空寺原图，消除悬空寺下方大空白。
4. 9/29、10/1、10/2、10/3 等段落使用高清图重新排版。
5. 删除纯摄影建议，但保留旅行内容与图片。
6. 天气表现在所有行都有静态参考值；weather-progressive.js 在日期进入预报窗口后自动覆盖为逐日预报。
7. .github/workflows/pages.yml 已改成直接部署静态 HTML + 高清 assets，不再从 .site-src/.b64 或 sprite 重建图片。

部署到现有仓库时：把本包内容覆盖到仓库根目录，确认 assets/images 和 .github/workflows/pages.yml 一并提交即可。

V7：高清原图保持原像素尺寸；PNG照片以 WebP q96 编码部署，主要用于降低网络体积，不改变网页展示分辨率。多图区域已做左右平齐与尺寸统一。
