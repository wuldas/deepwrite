# PC 同步版本选择界面验证

2026-09-11。使用实际 `DeviceSyncPage.vue`、`useDeviceSync`、全局样式、外观主题与内存 IPC 响应；不读取真实作品或调用网盘。

- `light.png`：1440×1000，浅色。
- `compact.png`：1000×720，紧凑窗口。
- `dark.png`：1200×900，深色。
- `large-accent.png`：1000×800，18px UI 字号和自定义强调色。
- `dark-accent.png`：1000×800，深色和自定义强调色。
- `no-preview.png`：尚未生成冲突卡片时的单项选择。
- `conflict.png`、`conflict-large.png`、`conflict-dark.png`：滚动至单项冲突处理卡片。

验证通过：旧按钮消失，批量/单项采用远端/本地传递正确方向和目标，执行前保存当前编辑，完成后刷新，运行中禁用按钮，各视口无横向溢出。同步内容结果由引擎测试验证；此浏览器预览不代替真实网盘双端往返验收。
