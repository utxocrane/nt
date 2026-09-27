const axios = require('axios');

//github
async function commitFile(token, owner, repo, path, content, message, branch = 'main', deleteIfExists = true,socksUrl=null) {
  try {
    // 文件内容（base64编码）
    const contentEncoded = Buffer.from(content).toString('base64');
	let socksAgent = undefined
	//if(socksUrl) socksAgent = new SocksProxyAgent(socksUrl) //走代理

    // 构建请求URL
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    
    // 如果需要先删除
    if (deleteIfExists) {
      try {
        // 先获取文件信息（包括SHA）
        const getFileResponse = await axios.get(url, {
		  httpsAgent:socksAgent,
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          params: { ref: branch }
        });
        
        // 如果文件存在，先删除
        if (getFileResponse.data) {
          console.log('找到现有文件，准备删除...');
          
          await axios.delete(url, {
			httpsAgent:socksAgent,
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            },
            data: {
              message: `删除文件以重新创建: ${path}`,
              sha: getFileResponse.data.sha,
              branch: branch
            }
          });
          
          console.log('文件删除成功，准备创建新文件');
        }
      } catch (error) {
        // 文件不存在（404），继续创建新文件
        if (error.response && error.response.status === 404) {
          console.log('文件不存在，直接创建');
        } else {
          throw error;
        }
      }
    }

    // 创建新文件（删除后不需要sha）
    const requestBody = {
      message: message,
      content: contentEncoded,
      branch: branch
    };

    // 发送创建请求
    const response = await axios.put(url, requestBody, {
	  httpsAgent:socksAgent,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    //console.log('文件提交成功！');
    
    return {
      success: true,
      action: 'created',
      data: response.data
    };
    
  } catch (error) {
    console.error('提交失败:', error.response ? error.response.data : error.message);
    return {
      success: false,
      error: error.response ? error.response.data : error.message
    };
  }
}

//gitee
async function updateGiteeFile(giteeToken,giteeUrl,content) {
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    try {
        // --- 第1步：获取文件的 sha（删除前必须） ---
        console.log('🔍 正在获取文件信息...');
        const getResp = await axios.get(giteeUrl, {
            params: { access_token:giteeToken }
        });
        const sha = getResp.data.sha;
        console.log(`✅ 获取到 SHA: ${sha}`);

        // --- 第2步：删除文件 ---
        console.log('🗑️ 正在删除原文件...');
        await axios.delete(giteeUrl, {
            data: {
                access_token: giteeToken,
                sha: sha,
                message: '删除文件以便重建'
            }
        });
        console.log('✅ 删除成功');

        // --- 第3步：重新创建文件 ---
        console.log('📝 正在创建新文件...');
        const createResp = await axios.post(giteeUrl, {
            access_token: giteeToken,
            content: base64Content,
            message: 'via api'
        });
        console.log('✅ 文件创建成功！');
        console.log(`📁 链接: ${createResp.data.content.html_url}`);

    } catch (error) {
        console.error('❌ 操作失败:');
        if (error.response) {
            console.error(`状态码: ${error.response.status}`);
            console.error(`错误详情: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(error.message);
        }
    }
}

/**
 * 创建带自动重试功能的 Axios 实例
 * @param {Object} options - 配置选项
 * @param {number} options.maxRetries - 最大重试次数，0 表示无限重试，默认 3
 * @param {number} options.retryDelay - 基础延迟时间（毫秒），默认 1000
 * @param {number} options.retryExponent - 指数退避的底数，默认 1.5
 * @param {number} options.maxDelay - 单次延迟上限（毫秒），0 表示不限制，默认 0
 * @param {Function} options.retryCondition - 判断是否应重试的函数
 * @param {Function} options.onRetry - 重试前的回调（支持 async）
 * @param {...any} options.axiosConfig - 其他 Axios 配置参数
 * @returns {import('axios').AxiosInstance} Axios 实例
 */
function createRetryAxios(options = {}) {
    const {
        maxRetries = 3,           // 0 表示无限重试
        retryDelay = 1000,        // 基础延迟（毫秒）
        retryExponent = 1.5,      // 指数底数
        maxDelay = 0,             // 单次延迟上限，0 不限制
        retryCondition = defaultRetryCondition,
        onRetry = null,
        ...axiosConfig
    } = options;

    const instance = axios.create(axiosConfig);

    // 默认重试条件：网络错误 或 5xx
    function defaultRetryCondition(error) {
        return !error.response ||
               (error.response.status >= 500 && error.response.status < 600);
    }

    // 计算指数退避延迟
    function calculateDelay(retryCount) {
        let delay = retryDelay * Math.pow(retryExponent, retryCount - 1);
        if (maxDelay > 0 && delay > maxDelay) {
            delay = maxDelay;
        }
        return delay;
    }

    instance.interceptors.response.use(
        response => response,
        async (error) => {
            const config = error.config;

            // 请求被取消，直接抛出
            if (axios.isCancel(error)) {
                return Promise.reject(error);
            }

            config._retryCount = config._retryCount || 0;

            // 达到最大重试次数
            if (maxRetries !== 0 && config._retryCount >= maxRetries) {
                return Promise.reject(error);
            }

            // 不满足重试条件
            if (!retryCondition(error)) {
                return Promise.reject(error);
            }

            config._retryCount += 1;
            const delay = calculateDelay(config._retryCount);

            // 触发重试回调（支持 async）
            if (onRetry) {
                await onRetry({
                    error,
                    retryCount: config._retryCount,
                    maxRetries,
                    delay,
                    config,
                });
            }

            await new Promise(resolve => setTimeout(resolve, delay));

            // 重新发起请求
            return instance(config);
        }
    );

    return instance;
}

// 导出函数
module.exports = { commitFile,updateGiteeFile,createRetryAxios };