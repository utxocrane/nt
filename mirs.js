const {createRetryAxios}=require('./lib/common')
const axios=require('axios')

async function a(){
	const a = createRetryAxios({
    maxRetries: 0,          // 0 表示无限重试
    retryDelay: 1000,       // 初始延迟1秒
    retryExponent: 1.5,     // 指数底数1.5
    timeout: 2000
	});
	
	console.log((await a.get('https://fineproxy.org/data/free-proxies/cn.json')).data)
}

a()