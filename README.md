# 逆变器控制 Cloudflare Worker

这个 Cloudflare Worker 用于查询逆变器状态并根据 SOC（电池荷电状态）和电池馈网状态自动调整逆变器设置。

## 功能特点

1. **查询 SOC** - 获取电池荷电状态
2. **查询电池馈网状态** - 检查电池馈网功能是否开启
3. **智能判断** - 根据 SOC 和电池馈网状态决定是否需要调整
4. **自动控制** - 自动执行相应操作（开启/关闭电池馈网，开启削峰填谷）
5. **响应格式化** - 提供清晰的操作结果

## 安装依赖

```bash
npm install
```

## 开发模式

```bash
npm run dev
```

## 部署到 Cloudflare

```bash
npm run deploy
```

## API 配置

在 `worker.js` 文件中，您可以修改以下配置：

```javascript
// API 配置
const API_CONFIG = {
    BASE_URL: 'https://server-cn.growatt.com/tcpSet.do',
    HEADERS: {
        'maketoken': '97e91ae5a7fb3b38f44c7221cff8b37c5',
        'permissionskey': 'oss_cn_'
    }
};

// 设备配置
const DEVICE_CONFIG = {
    SERIAL_NUM: 'NQ2QF5JOK7'
};
```

## 使用方法

### 1. 查询状态并执行操作

发送 GET 请求到 Worker 部署的 URL，Worker 会自动执行以下操作：

- 查询 SOC
- 查询电池馈网状态
- 判断是否需要调整
- 执行相应操作
- 返回结果

### 2. 响应格式

成功响应：
```json
{
    "success": true,
    "action": 1,
    "output": "开启电池馈网成功\n开启削峰填谷成功"
}
```

失败响应：
```json
{
    "success": false,
    "msg": "处理请求失败"
}
```

## 操作逻辑

- **SOC ≤ 30% 且电池馈网开启**：关闭电池馈网
- **SOC ≥ 40% 且电池馈网关闭**：开启电池馈网和削峰填谷
- **其他情况**：不进行任何操作

## 技术栈

- Cloudflare Workers
- JavaScript (ES6+)
- Fetch API

## 部署要求

- Cloudflare 账户
- Wrangler CLI

## 许可证

MIT
