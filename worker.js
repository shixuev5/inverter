/**
 * Cloudflare Worker 实现逆变器状态查询和控制
 */

// 基础 URL 配置
const BASE_URL = 'https://server-cn.growatt.com/tcpSet.do';

/**
 * 发送 API 请求的通用函数
 * 注意：必须传入 env 参数以获取 Token
 */
async function sendApiRequest(bodyParams, env) {
    try {
        // 动态从 env 中获取配置
        const headers = {
            'maketoken': env.MAKETOKEN, // 这里直接读取 env 对象
            'permissionskey': "oss_cn_"
        };

        // 简单的日志检查
        // console.log(`使用 Token: ${headers.maketoken}`);

        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...headers
            },
            body: new URLSearchParams(bodyParams)
        });

        return await response.json();
    } catch (error) {
        console.error('API 请求失败:', error);
        return { success: false, msg: '请求失败' };
    }
}

/**
 * 查询 SOC（电池荷电状态）
 */
async function querySOC(env) {
    const bodyParams = {
        'action': 'readStorageParam',
        'paramId': 'set_any_reg',
        'serialNum': env.SERIAL_NUM, // 从 env 读取序列号
        'startAddr': 1018,
        'endAddr': 1018
    };

    return sendApiRequest(bodyParams, env);
}

/**
 * 查询电池馈网状态
 */
async function queryBatteryFeed(env) {
    const bodyParams = {
        'action': 'readStorageParam',
        'serialNum': env.SERIAL_NUM,
        'paramId': 'storage_spf5000_uw_bat_feed_en',
        'startAddr': '-1',
        'endAddr': '-1'
    };

    return sendApiRequest(bodyParams, env);
}

/**
 * 开启电池馈网
 */
async function enableBatteryFeed(env) {
    const bodyParams = {
        'action': 'storageSPF5000Set',
        'serialNum': env.SERIAL_NUM,
        'type': 'storage_spf5000_uw_bat_feed_en',
        'param1': '1'
    };

    return sendApiRequest(bodyParams, env);
}

/**
 * 关闭电池馈网
 */
async function disableBatteryFeed(env) {
    const bodyParams = {
        'action': 'storageSPF5000Set',
        'serialNum': env.SERIAL_NUM,
        'type': 'storage_spf5000_uw_bat_feed_en',
        'param1': '0'
    };

    return sendApiRequest(bodyParams, env);
}

/**
 * 开启削峰填谷
 */
async function enablePeakShaving(env) {
    const bodyParams = {
        'action': 'storageSPF5000Set',
        'serialNum': env.SERIAL_NUM,
        'type': 'storage_spf5000_uti_peak_shaving_set',
        'param1': '1'
    };

    return sendApiRequest(bodyParams, env);
}

/**
 * 状态判断逻辑 (纯逻辑，不需要 env)
 */
function determineAction(socRes, batRes) {
    let action = -1;

    if (socRes.success && batRes.success) {
        const soc = Number(socRes.msg);
        const bat = Number(batRes.msg);

        // 注意：Growatt 返回的 msg 可能是字符串，需要确保转换正确
        if (soc <= 25 && bat == 1) { // 假设开启状态 bat 返回 '1' 或 1
            // 电量 <= 25% 且 馈网开启(1) -> 关闭馈网
            action = 0;
        } else if (soc >= 35 && bat == 0) { // 假设关闭状态 bat 返回 '0' 或 0
            // 电量 >= 35% 且 馈网关闭(0) -> 开启馈网
            action = 1;
        }
    } else {
        console.error("无法获取有效状态，跳过逻辑判断");
    }

    return action;
}

/**
 * 执行相应的操作
 */
async function executeAction(action, env) {
    const messages = [];

    if (action === 1) {
        // 开启电池馈网和削峰填谷
        const batRes = await enableBatteryFeed(env);
        const peekRes = await enablePeakShaving(env);

        messages.push(batRes.success ? '开启电池馈网成功' : `开启电池馈网失败: ${batRes.msg}`);
        messages.push(peekRes.success ? '开启削峰填谷成功' : `开启削峰填谷失败: ${peekRes.msg}`);
    } else if (action === 0) {
        // 关闭电池馈网
        const batCloseRes = await disableBatteryFeed(env);
        messages.push(batCloseRes.success ? '关闭电池馈网成功' : `关闭电池馈网失败: ${batCloseRes.msg}`);
    } else {
        messages.push('不进行任何操作');
    }

    return messages.join('\n');
}

/**
 * 核心业务逻辑函数
 * 接收 env 参数
 */
async function processInverterLogic(env) {
    // 检查环境变量是否存在
    if (!env.MAKETOKEN || !env.SERIAL_NUM) {
        return { 
            error: "环境变量缺失: 请检查 MAKETOKEN 和 SERIAL_NUM" 
        };
    }

    // 1. 查询 SOC
    const socRes = await querySOC(env);
    console.log('SOC 查询结果:', JSON.stringify(socRes));

    // 2. 查询电池馈网状态
    const batRes = await queryBatteryFeed(env);
    console.log('电池馈网查询结果:', JSON.stringify(batRes));

    // 3. 状态判断
    const action = determineAction(socRes, batRes);
    console.log('决定执行的操作:', action);

    // 4. 执行相应操作
    const output = await executeAction(action, env);
    console.log('操作结果:', output);

    return { socRes, batRes, action, output };
}

/**
 * 导出 Module Worker
 */
export default {
    // HTTP 请求处理
    async fetch(request, env, ctx) {
        try {
            const result = await processInverterLogic(env);

            return new Response(JSON.stringify({
                success: true,
                ...result
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.error('处理请求失败:', error);
            return new Response(JSON.stringify({
                success: false,
                msg: error.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },

    // 定时任务处理
    async scheduled(event, env, ctx) {
        console.log('定时任务触发:', event.cron);
        try {
            await processInverterLogic(env);
        } catch (error) {
            console.error('定时任务执行失败:', error);
        }
    }
};
