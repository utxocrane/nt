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

// 导出函数
module.exports = { commitFile,updateGiteeFile };