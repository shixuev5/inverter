/**
 * Cloudflare Worker 实现逆变器状态查询和控制
 * 功能：
 * 1. 查询 SOC（电池荷电状态）
 * 2. 查询电池馈网状态
 * 3. 根据 SOC 和电池馈网状态判断是否需要调整
 * 4. 执行相应操作（开启/关闭电池馈网，开启削峰填谷）
 * 5. 格式化输出结果
 */

// API 配置（使用环境变量）
const API_CONFIG = {
    BASE_URL: 'https://server-cn.growatt.com/tcpSet.do',
    HEADERS: {
        'maketoken': (typeof MAKETOKEN !== 'undefined' ? MAKETOKEN : 'default_token'),
        'permissionskey': "oss_cn_"
    }
};

// 设备配置（使用环境变量）
const DEVICE_CONFIG = {
    SERIAL_NUM: (typeof SERIAL_NUM !== 'undefined' ? SERIAL_NUM : 'default_serial_num')
};

/**
 * 发送 API 请求的通用函数
 */
async function sendApiRequest(bodyParams) {
    try {
        const response = await fetch(API_CONFIG.BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...API_CONFIG.HEADERS
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
async function querySOC() {
    const bodyParams = {
        'action': 'getDeviceData',
        'serialNum': DEVICE_CONFIG.SERIAL_NUM,
        'paramId': 'storage_soc'
    };

    return sendApiRequest(bodyParams);
}

/**
 * 查询电池馈网状态
 */
async function queryBatteryFeed() {
    const bodyParams = {
        'action': 'readStorageParam',
        'serialNum': DEVICE_CONFIG.SERIAL_NUM,
        'paramId': 'storage_spf5000_uw_bat_feed_en',
        'startAddr': '-1',
        'endAddr': '-1'
    };

    return sendApiRequest(bodyParams);
}

/**
 * 开启电池馈网
 */
async function enableBatteryFeed() {
    const bodyParams = {
        'action': 'storageSPF5000Set',
        'serialNum': DEVICE_CONFIG.SERIAL_NUM,
        'type': 'storage_spf5000_uw_bat_feed_en',
        'param1': '1'
    };

    return sendApiRequest(bodyParams);
}

/**
 * 关闭电池馈网
 */
async function disableBatteryFeed() {
    const bodyParams = {
        'action': 'storageSPF5000Set',
        'serialNum': DEVICE_CONFIG.SERIAL_NUM,
        'type': 'storage_spf5000_uw_bat_feed_en',
        'param1': '0'
    };

    return sendApiRequest(bodyParams);
}

/**
 * 开启削峰填谷
 */
async function enablePeakShaving() {
    const bodyParams = {
        'action': 'storageSPF5000Set',
        'serialNum': DEVICE_CONFIG.SERIAL_NUM,
        'type': 'storage_spf5000_ut_peak_shaving_set',
        'param1': '1'
    };

    return sendApiRequest(bodyParams);
}

/**
 * 状态判断逻辑
 */
function determineAction(socRes, batRes) {
    let action = -1;

    if (socRes.success && batRes.success) {
        const soc = Number(socRes.msg);
        const bat = Number(batRes.msg);

        if (soc <= 30 && bat) {
            // 电量小于等于30%且电池馈网开启，则关闭电池馈网
            action = 0;
        } else if (soc >= 40 && !bat) {
            // 电量大于等于40%且电池馈网关闭，则开启电池馈网和削峰填谷
            action = 1;
        }
    }

    return action;
}

/**
 * 执行相应的操作
 */
async function executeAction(action) {
    const messages = [];

    if (action === 1) {
        // 开启电池馈网和削峰填谷
        const batRes = await enableBatteryFeed();
        const peekRes = await enablePeakShaving();

        messages.push(batRes.success ? '开启电池馈网成功' : '开启电池馈网失败');
        messages.push(peekRes.success ? '开启削峰填谷成功' : '开启削峰填谷失败');
    } else if (action === 0) {
        // 关闭电池馈网
        const batCloseRes = await disableBatteryFeed();
        messages.push(batCloseRes.success ? '关闭电池馈网成功' : '关闭电池馈网失败');
    } else {
        messages.push('不进行任何操作');
    }

    return messages.join('\n');
}

/**
 * 核心业务逻辑函数（供 HTTP 请求和定时任务共享）
 */
async function processInverterLogic() {
    // 1. 查询 SOC
    const socRes = await querySOC();
    console.log('SOC 查询结果:', socRes);

    // 2. 查询电池馈网状态
    const batRes = await queryBatteryFeed();
    console.log('电池馈网查询结果:', batRes);

    // 3. 状态判断
    const action = determineAction(socRes, batRes);
    console.log('决定执行的操作:', action);

    // 4. 执行相应操作
    const output = await executeAction(action);
    console.log('操作结果:', output);

    return { socRes, batRes, action, output };
}

/**
 * Cloudflare Worker HTTP 请求处理函数
 */
async function handleRequest() {
    try {
        const { action, output } = await processInverterLogic();

        // 返回 JSON 响应
        return new Response(JSON.stringify({
            success: true,
            action: action,
            output: output
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('处理请求失败:', error);
        return new Response(JSON.stringify({
            success: false,
            msg: '处理请求失败'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Cloudflare Workers 定时任务处理函数
 */
async function handleScheduled(event) {
    console.log('定时任务触发:', event.cron);

    try {
        await processInverterLogic();
        return new Response('定时任务执行完成');
    } catch (error) {
        console.error('定时任务执行失败:', error);
        return new Response('定时任务执行失败', { status: 500 });
    }
}

// 导出 Module Worker 格式（包含定时任务支持）
export default {
    fetch: handleRequest,
    scheduled: handleScheduled
};
