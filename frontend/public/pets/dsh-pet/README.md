# dsh-pet animation assets

Source: https://github.com/PC2005-cloud/dsh-pet

Imported from version 0.3.7, commit `e17e89be92aaa7b71c4f3e9e89995a23a781d725`.
Upstream MIT license is preserved in `LICENSE`.

| Local file | Original animation |
| --- | --- |
| idle.webm | 待机呼吸休闲.webm |
| sleep.webm | 原地小憩沉眠.webm |
| drag.webm | 被鼠标拖拽悬空反馈.webm |
| happy.webm | 点击回应-开心跃动.webm |
| wave.webm | 点击回应-元气挥手.webm |
| bubbles.webm | 鲸鱼吐泡泡特效.webm |

The WebM files retain their original 640×360 transparent VP9 video. `idle.png`
and `sleep.png` are transparent first-frame exports decoded with libvpx-vp9.

The workbench uses a local Vue integration of these animations, not the DSH
plugin runtime or standalone Electron application. No DSH installation or AI
request is required. Click, drag, sleep, bubbles, keyboard movement, visibility
and normalized position preferences are managed by the workbench components.
Existing whale preferences are read if no dsh-pet preferences have been saved.

Animated playback pauses while the pet is hidden/suspended or the document is
in the background. Reduced-motion, WebKit (including Safari/iOS), unsupported
VP9 and playback-error cases use the transparent PNG instead. This avoids
opaque video backgrounds on browsers without VP9 alpha support.
