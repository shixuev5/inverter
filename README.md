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

## 环境变量配置

**重要安全提示**：**不要将敏感信息（如 maketoken、密码等）硬编码到代码中或提交到 GitHub！**

### 1. 本地开发环境变量

1. 复制 `.env.example` 文件为 `.env`：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填写您的实际值：
   ```
   # API 配置
   MAKETOKEN=your_maketoken_here
   SERIAL_NUM=your_serial_number_here
   ```

3. `.env` 文件已被添加到 `.gitignore` 中，不会被提交到 GitHub。

### 2. 生产环境变量（Cloudflare Workers Secrets）

在生产环境中，应使用 Cloudflare Workers 的 Secrets 功能来存储敏感信息：

```bash
# 添加环境变量
npm run secret:put MAKETOKEN
npm run secret:put SERIAL_NUM

# 查看已添加的 Secrets
npm run secret:list

# 删除 Secrets
npm run secret:delete MAKETOKEN
```

### 定时任务配置

Worker 已配置为**每小时自动执行一次**。定时任务配置在 `wrangler.toml` 文件中：

```toml
[triggers]
crons = ["0 * * * *"]  # UTC 时间每小时执行一次
```

您可以根据需要调整 cron 表达式，例如：
- `*/30 * * * *` - 每 30 分钟执行一次
- `0 8-18 * * *` - 每天早上 8 点到下午 6 点每小时执行一次

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
